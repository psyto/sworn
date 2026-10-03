//! Read-only JSON-RPC client + RPC-backed lazy DB (spec R3.5 witness discovery).
//!
//! `LazyDb` serves the executor from `eth_getProof` at a fixed block and MPT-verifies every account
//! and slot against that block's stateRoot the moment it is fetched. The set it touched IS the
//! witness: `into_witness()` returns exactly the accounts/slots (with proofs) the run read.
use alloy_primitives::{Address, B256, Bytes, U256, keccak256};
use revm::{database_interface::Database, state::{AccountInfo, Bytecode}};
use serde_json::{Value, json};
use spike_core::{Abort, AccountWitness, DbFault, StorageWitness, account_exists, verify_account, verify_slot};
use std::{collections::BTreeMap, str::FromStr, time::Duration};

pub const RPC: &str = "https://rpc.moderato.tempo.xyz";

#[derive(Clone)]
pub struct Rpc {
    agent: ureq::Agent,
    pub calls: std::rc::Rc<std::cell::Cell<usize>>,
}

impl Rpc {
    pub fn new() -> Self {
        Self {
            agent: ureq::AgentBuilder::new().timeout(Duration::from_secs(60)).build(),
            calls: Default::default(),
        }
    }
    fn post(&self, body: &Value) -> Result<Value, String> {
        let mut last = String::new();
        for attempt in 0..6 {
            self.calls.set(self.calls.get() + 1);
            match self.agent.post(RPC).set("content-type", "application/json").send_json(body.clone()) {
                Ok(r) => return r.into_json::<Value>().map_err(|e| e.to_string()),
                Err(ureq::Error::Status(429 | 500..=599, _)) | Err(ureq::Error::Transport(_)) => {
                    last = format!("retry {attempt}");
                    std::thread::sleep(Duration::from_millis(300 << attempt));
                }
                Err(e) => return Err(e.to_string()),
            }
        }
        Err(format!("rpc failed: {last}"))
    }
    /// Returns `Err(error object as string)` on JSON-RPC error.
    pub fn call(&self, method: &str, params: Value) -> Result<Value, Value> {
        let r = self
            .post(&json!({"jsonrpc":"2.0","id":1,"method":method,"params":params}))
            .map_err(|e| json!({"transport": e}))?;
        if let Some(e) = r.get("error") {
            return Err(e.clone());
        }
        Ok(r["result"].clone())
    }
    pub fn req(&self, method: &str, params: Value) -> Value {
        self.call(method, params.clone()).unwrap_or_else(|e| panic!("{method} {params}: {e}"))
    }
    /// JSON-RPC batch; results in request order.
    pub fn batch(&self, reqs: &[(&str, Value)]) -> Vec<Result<Value, Value>> {
        if reqs.is_empty() {
            return vec![];
        }
        let body: Vec<Value> = reqs
            .iter()
            .enumerate()
            .map(|(i, (m, p))| json!({"jsonrpc":"2.0","id":i,"method":m,"params":p}))
            .collect();
        let r = self.post(&Value::Array(body)).expect("batch");
        let mut out: Vec<Result<Value, Value>> = vec![Err(Value::Null); reqs.len()];
        for item in r.as_array().expect("batch array") {
            let i = item["id"].as_u64().unwrap() as usize;
            out[i] = match item.get("error") {
                Some(e) => Err(e.clone()),
                None => Ok(item["result"].clone()),
            };
        }
        out
    }
    pub fn block_number(&self) -> u64 {
        hu(&self.req("eth_blockNumber", json!([])))
    }
}

pub fn hx(n: u64) -> String {
    format!("0x{n:x}")
}
pub fn hu(v: &Value) -> u64 {
    u64::from_str_radix(v.as_str().unwrap().trim_start_matches("0x"), 16).unwrap()
}
pub fn hu256(v: &Value) -> U256 {
    U256::from_str_radix(v.as_str().unwrap().trim_start_matches("0x"), 16).unwrap()
}
pub fn hp<T: FromStr>(v: &Value) -> T
where
    T::Err: std::fmt::Debug,
{
    T::from_str(v.as_str().unwrap_or_else(|| panic!("not a string: {v}"))).unwrap()
}
fn bytes_list(v: &Value) -> Vec<Bytes> {
    v.as_array().unwrap().iter().map(hp::<Bytes>).collect()
}

/// Header of block N: (raw RLP, hash, json).
pub struct BlockRef {
    pub number: u64,
    pub hash: B256,
    pub raw_header: Bytes,
    pub json: Value,
}
pub fn fetch_block(rpc: &Rpc, n: u64, full: bool) -> BlockRef {
    let r = rpc.batch(&[
        ("debug_getRawHeader", json!([hx(n)])),
        ("eth_getBlockByNumber", json!([hx(n), full])),
    ]);
    let raw: Bytes = hp(r[0].as_ref().unwrap());
    let json = r[1].clone().unwrap();
    let hash: B256 = hp(&json["hash"]);
    assert_eq!(keccak256(&raw), hash, "raw header hash mismatch at {n}");
    BlockRef { number: n, hash, raw_header: raw, json }
}

#[derive(Debug)]
pub struct LazyDb {
    pub rpc: Rpc,
    pub block: u64,
    pub state_root: B256,
    pub accounts: BTreeMap<Address, AccountWitness>,
    codes: BTreeMap<B256, Bytecode>,
}

impl std::fmt::Debug for Rpc {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Rpc")
    }
}

fn parse_proof(p: &Value, code: Bytes) -> AccountWitness {
    AccountWitness {
        address: hp(&p["address"]),
        nonce: hu(&p["nonce"]),
        balance: hu256(&p["balance"]),
        storage_root: hp(&p["storageHash"]),
        code_hash: hp(&p["codeHash"]),
        code,
        account_proof: bytes_list(&p["accountProof"]),
        storage: p["storageProof"]
            .as_array()
            .unwrap()
            .iter()
            .map(|s| StorageWitness { slot: hu256(&s["key"]), value: hu256(&s["value"]), proof: bytes_list(&s["proof"]) })
            .collect(),
    }
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

    /// Batch prefetch (a hint only — e.g. from a prestate trace). Values come from proofs at
    /// `self.block`, never from the hint.
    pub fn prefetch(&mut self, want: &BTreeMap<Address, Vec<U256>>) -> Result<(), Abort> {
        let mut reqs = vec![];
        let mut order = vec![];
        for (a, slots) in want {
            if self.accounts.contains_key(a) {
                continue;
            }
            let keys: Vec<String> = slots.iter().map(|s| slot_hex(*s)).collect();
            reqs.push(("eth_getProof", json!([a, keys, hx(self.block)])));
            reqs.push(("eth_getCode", json!([a, hx(self.block)])));
            order.push(*a);
        }
        for chunk in reqs.chunks(40).zip(order.chunks(20)) {
            let res = self.rpc.batch(chunk.0);
            for (i, _a) in chunk.1.iter().enumerate() {
                let p = res[2 * i].clone().map_err(|e| Abort::Proof(e.to_string()))?;
                let code: Bytes = hp(res[2 * i + 1].as_ref().map_err(|e| Abort::Proof(e.to_string()))?);
                self.insert_account(parse_proof(&p, code))?;
            }
        }
        Ok(())
    }

    fn ensure_account(&mut self, a: Address) -> Result<&AccountWitness, Abort> {
        if !self.accounts.contains_key(&a) {
            let r = self.rpc.batch(&[
                ("eth_getProof", json!([a, [], hx(self.block)])),
                ("eth_getCode", json!([a, hx(self.block)])),
            ]);
            let p = r[0].clone().map_err(|e| Abort::Proof(format!("getProof {a}: {e}")))?;
            let code: Bytes = hp(r[1].as_ref().map_err(|e| Abort::Proof(e.to_string()))?);
            self.insert_account(parse_proof(&p, code))?;
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
        let sw = StorageWitness { slot: hu256(&s["key"]), value: hu256(&s["value"]), proof: bytes_list(&s["proof"]) };
        if sw.slot != slot {
            return Err(Abort::Proof(format!("slot key mismatch {a} {slot}")));
        }
        verify_slot(storage_root, a, &sw)?;
        let v = sw.value;
        self.accounts.get_mut(&a).unwrap().storage.push(sw);
        Ok(v)
    }

    /// The witness = exactly what was touched, with proofs.
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

/// Parse a prestateTracer result (non-diff) into a prefetch hint.
pub fn prestate_hint(pre: &Value) -> BTreeMap<Address, Vec<U256>> {
    let mut out = BTreeMap::new();
    if let Some(m) = pre.as_object() {
        for (a, v) in m {
            let slots = v
                .get("storage")
                .and_then(|s| s.as_object())
                .map(|s| s.keys().map(|k| U256::from_str_radix(k.trim_start_matches("0x"), 16).unwrap()).collect())
                .unwrap_or_default();
            out.insert(Address::from_str(a).unwrap(), slots);
        }
    }
    out
}
