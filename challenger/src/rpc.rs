//! JSON-RPC client + RPC-backed lazy DB (spec 001 R3.5 witness discovery).
//!
//! Adapted from `host/src/rpc.rs` (same LazyDb semantics: every account/slot is an `eth_getProof`
//! at a fixed block, MPT-verified against that block's stateRoot the moment it is fetched; the set
//! touched IS the witness). Differences from the host copy, all operational:
//!   - the endpoint is a parameter (`SWORN_RPC_URL`), not the Moderato constant, so the same code
//!     runs against the local e2e chain;
//!   - every call is bounded (per-request timeout, ≤ 4 retries) and fails with an error instead of
//!     panicking, and an optional overall deadline turns a slow capture into an error, not a stall.
use alloy_primitives::{Address, B256, Bytes, U256, keccak256};
use revm::{
    database_interface::Database,
    state::{AccountInfo, Bytecode},
};
use serde_json::{Value, json};
use spike_core::{Abort, AccountWitness, DbFault, StorageWitness, account_exists, verify_account, verify_slot};
use std::{
    cell::Cell,
    collections::BTreeMap,
    rc::Rc,
    str::FromStr,
    time::{Duration, Instant},
};

pub const MODERATO_RPC: &str = "https://rpc.moderato.tempo.xyz";

/// `SWORN_RPC_URL`, else Moderato's public RPC.
pub fn rpc_url_from_env() -> String {
    std::env::var("SWORN_RPC_URL").unwrap_or_else(|_| MODERATO_RPC.to_string())
}

#[derive(Clone)]
pub struct Rpc {
    agent: ureq::Agent,
    pub url: String,
    pub calls: Rc<Cell<usize>>,
    deadline: Option<Instant>,
}

impl std::fmt::Debug for Rpc {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Rpc({})", self.url)
    }
}

impl Rpc {
    pub fn new(url: &str) -> Self {
        Self {
            agent: ureq::AgentBuilder::new()
                .timeout_connect(Duration::from_secs(10))
                .timeout(Duration::from_secs(20))
                .build(),
            url: url.to_string(),
            calls: Default::default(),
            deadline: None,
        }
    }
    /// Every request after `deadline` fails immediately.
    pub fn with_deadline(mut self, d: Instant) -> Self {
        self.deadline = Some(d);
        self
    }
    fn post(&self, body: &Value) -> Result<Value, String> {
        let mut last = String::new();
        for attempt in 0..4 {
            if self.deadline.is_some_and(|d| Instant::now() > d) {
                return Err("deadline exceeded".into());
            }
            self.calls.set(self.calls.get() + 1);
            match self.agent.post(&self.url).set("content-type", "application/json").send_json(body.clone()) {
                Ok(r) => return r.into_json::<Value>().map_err(|e| e.to_string()),
                Err(ureq::Error::Status(code @ (429 | 500..=599), _)) => last = format!("http {code}"),
                Err(ureq::Error::Transport(t)) => last = t.to_string(),
                Err(e) => return Err(e.to_string()),
            }
            std::thread::sleep(Duration::from_millis(250 << attempt));
        }
        Err(format!("rpc failed after retries: {last}"))
    }
    /// `Err(error object)` on JSON-RPC error or transport failure.
    pub fn call(&self, method: &str, params: Value) -> Result<Value, Value> {
        let r = self
            .post(&json!({"jsonrpc":"2.0","id":1,"method":method,"params":params}))
            .map_err(|e| json!({"transport": e}))?;
        if let Some(e) = r.get("error") {
            return Err(e.clone());
        }
        Ok(r["result"].clone())
    }
    pub fn req(&self, method: &str, params: Value) -> Result<Value, String> {
        self.call(method, params).map_err(|e| format!("{method}: {e}"))
    }
    pub fn batch(&self, reqs: &[(&str, Value)]) -> Result<Vec<Result<Value, Value>>, String> {
        if reqs.is_empty() {
            return Ok(vec![]);
        }
        let body: Vec<Value> = reqs
            .iter()
            .enumerate()
            .map(|(i, (m, p))| json!({"jsonrpc":"2.0","id":i,"method":m,"params":p}))
            .collect();
        let r = self.post(&Value::Array(body))?;
        let arr = r.as_array().ok_or_else(|| format!("batch: not an array: {r}"))?;
        let mut out: Vec<Result<Value, Value>> = vec![Err(Value::Null); reqs.len()];
        for item in arr {
            let i = item["id"].as_u64().ok_or("batch id")? as usize;
            if i < out.len() {
                out[i] = match item.get("error") {
                    Some(e) => Err(e.clone()),
                    None => Ok(item["result"].clone()),
                };
            }
        }
        Ok(out)
    }
    pub fn block_number(&self) -> Result<u64, String> {
        hu(&self.req("eth_blockNumber", json!([]))?)
    }
}

pub fn hx(n: u64) -> String {
    format!("0x{n:x}")
}
pub fn hu(v: &Value) -> Result<u64, String> {
    let s = v.as_str().ok_or_else(|| format!("not a hex string: {v}"))?;
    u64::from_str_radix(s.trim_start_matches("0x"), 16).map_err(|e| format!("{s}: {e}"))
}
pub fn hu256(v: &Value) -> Result<U256, String> {
    let s = v.as_str().ok_or_else(|| format!("not a hex string: {v}"))?;
    U256::from_str_radix(s.trim_start_matches("0x"), 16).map_err(|e| format!("{s}: {e}"))
}
pub fn hp<T: FromStr>(v: &Value) -> Result<T, String>
where
    T::Err: std::fmt::Display,
{
    let s = v.as_str().ok_or_else(|| format!("not a string: {v}"))?;
    T::from_str(s).map_err(|e| format!("{s}: {e}"))
}
fn bytes_list(v: &Value) -> Result<Vec<Bytes>, String> {
    v.as_array().ok_or("not a list")?.iter().map(hp::<Bytes>).collect()
}

/// Header of block N: raw RLP whose keccak is the block hash (checked here).
pub struct BlockRef {
    pub number: u64,
    pub hash: B256,
    pub raw_header: Bytes,
    pub json: Value,
}
pub fn fetch_block(rpc: &Rpc, n: u64) -> Result<BlockRef, String> {
    let r = rpc.batch(&[
        ("debug_getRawHeader", json!([hx(n)])),
        ("eth_getBlockByNumber", json!([hx(n), false])),
    ])?;
    let raw: Bytes = hp(r[0].as_ref().map_err(|e| format!("debug_getRawHeader {n}: {e}"))?)?;
    let json = r[1].clone().map_err(|e| format!("eth_getBlockByNumber {n}: {e}"))?;
    if json.is_null() {
        return Err(format!("block {n} not found"));
    }
    let hash: B256 = hp(&json["hash"])?;
    if keccak256(&raw) != hash {
        return Err(format!("raw header hash mismatch at {n}: keccak {} != {hash}", keccak256(&raw)));
    }
    Ok(BlockRef { number: n, hash, raw_header: raw, json })
}

#[derive(Debug)]
pub struct LazyDb {
    pub rpc: Rpc,
    pub block: u64,
    pub state_root: B256,
    pub accounts: BTreeMap<Address, AccountWitness>,
    codes: BTreeMap<B256, Bytecode>,
}

fn parse_proof(p: &Value, code: Bytes) -> Result<AccountWitness, String> {
    let storage = p["storageProof"]
        .as_array()
        .ok_or("storageProof")?
        .iter()
        .map(|s| Ok(StorageWitness { slot: hu256(&s["key"])?, value: hu256(&s["value"])?, proof: bytes_list(&s["proof"])? }))
        .collect::<Result<Vec<_>, String>>()?;
    Ok(AccountWitness {
        address: hp(&p["address"])?,
        nonce: hu(&p["nonce"])?,
        balance: hu256(&p["balance"])?,
        storage_root: hp(&p["storageHash"])?,
        code_hash: hp(&p["codeHash"])?,
        code,
        account_proof: bytes_list(&p["accountProof"])?,
        storage,
    })
}

fn slot_hex(s: U256) -> String {
    format!("0x{}", alloy_primitives::hex::encode(s.to_be_bytes::<32>()))
}

impl LazyDb {
    pub fn new(rpc: Rpc, block: u64, state_root: B256) -> Self {
        Self { rpc, block, state_root, accounts: BTreeMap::new(), codes: BTreeMap::new() }
    }

    fn insert_account(&mut self, mut acc: AccountWitness) -> Result<(), Abort> {
        let slots = std::mem::take(&mut acc.storage);
        verify_account(self.state_root, &acc)?;
        for s in &slots {
            verify_slot(acc.storage_root, acc.address, s)?;
        }
        acc.storage = slots;
        self.codes.insert(acc.code_hash, Bytecode::new_raw(acc.code.clone()));
        self.accounts.insert(acc.address, acc);
        Ok(())
    }

    fn ensure_account(&mut self, a: Address) -> Result<&AccountWitness, Abort> {
        if !self.accounts.contains_key(&a) {
            let r = self
                .rpc
                .batch(&[("eth_getProof", json!([a, [], hx(self.block)])), ("eth_getCode", json!([a, hx(self.block)]))])
                .map_err(Abort::Proof)?;
            let p = r[0].clone().map_err(|e| Abort::Proof(format!("getProof {a}: {e}")))?;
            let code: Bytes = hp(r[1].as_ref().map_err(|e| Abort::Proof(e.to_string()))?).map_err(Abort::Proof)?;
            self.insert_account(parse_proof(&p, code).map_err(Abort::Proof)?)?;
        }
        Ok(&self.accounts[&a])
    }

    fn ensure_slot(&mut self, a: Address, slot: U256) -> Result<U256, Abort> {
        let acc = self.ensure_account(a)?;
        if let Some(s) = acc.storage.iter().find(|s| s.slot == slot) {
            return Ok(s.value);
        }
        let storage_root = acc.storage_root;
        let p = self
            .rpc
            .call("eth_getProof", json!([a, [slot_hex(slot)], hx(self.block)]))
            .map_err(|e| Abort::Proof(format!("getProof {a} {slot}: {e}")))?;
        let s = &p["storageProof"][0];
        let sw = StorageWitness {
            slot: hu256(&s["key"]).map_err(Abort::Proof)?,
            value: hu256(&s["value"]).map_err(Abort::Proof)?,
            proof: bytes_list(&s["proof"]).map_err(Abort::Proof)?,
        };
        if sw.slot != slot {
            return Err(Abort::Proof(format!("slot key mismatch {a} {slot}")));
        }
        verify_slot(storage_root, a, &sw)?;
        let v = sw.value;
        self.accounts.get_mut(&a).unwrap().storage.push(sw);
        Ok(v)
    }

    pub fn into_witness(self) -> Vec<AccountWitness> {
        self.accounts.into_values().collect()
    }
    pub fn slot_count(&self) -> usize {
        self.accounts.values().map(|a| a.storage.len()).sum()
    }
}

impl Database for LazyDb {
    type Error = DbFault;
    fn basic(&mut self, a: Address) -> Result<Option<AccountInfo>, DbFault> {
        let acc = self.ensure_account(a).map_err(DbFault)?;
        let exists = account_exists(acc.nonce, acc.balance, acc.code_hash, acc.storage_root);
        Ok(exists.then(|| AccountInfo {
            balance: acc.balance,
            nonce: acc.nonce,
            code_hash: acc.code_hash,
            code: Some(Bytecode::new_raw(acc.code.clone())),
            ..Default::default()
        }))
    }
    fn code_by_hash(&mut self, h: B256) -> Result<Bytecode, DbFault> {
        self.codes.get(&h).cloned().ok_or(DbFault(Abort::MissingCode(h)))
    }
    fn storage(&mut self, a: Address, s: U256) -> Result<U256, DbFault> {
        self.ensure_slot(a, s).map_err(DbFault)
    }
    fn block_hash(&mut self, n: u64) -> Result<B256, DbFault> {
        Err(DbFault(Abort::BlockHashRead(n)))
    }
}
