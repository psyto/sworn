//! Shared by `sworn-answer`, `sworn-witness` and `sworn-challenge` (spec 002 §1).
//!
//! - `rpc`: RPC client + LazyDb (witness discovery, R3.5), adapted from host/src/rpc.rs.
//! - JSON codecs for the R3.1/R3.7 `Question` / `Answer` (§2 wire format: integers as decimal
//!   strings, bytes as 0x-hex).
//! - `capture`: run core's executor over the LazyDb at q.blockNumber, then re-run the GUEST path
//!   (`spike_core::run`) natively on the captured witness — so a saved witness is known to replay.
//! - Sworn ABI helpers and a minimal legacy-transaction signer (key from an env var only).
pub mod rpc;

use alloy_consensus::{SignableTransaction, TxEnvelope, TxLegacy};
use alloy_eips::eip2718::Encodable2718;
use alloy_primitives::{Address, B256, Bytes, TxKind, U256, keccak256};
use alloy_signer::SignerSync;
use alloy_signer_local::PrivateKeySigner;
use alloy_sol_types::SolValue;
use rpc::*;
use serde_json::{Value, json};
use spike_core::{Answer, Input, Question, answer_question, bind_header, run};
use std::{str::FromStr, time::{Duration, Instant}};

// ------------------------------------------------------------------------------------------------
// JSON (§2): integers as decimal strings; parsing also accepts JSON numbers and 0x-hex strings.
// ------------------------------------------------------------------------------------------------

pub fn question_json(q: &Question) -> Value {
    json!({
        "chainId": q.chainId.to_string(), "blockNumber": q.blockNumber.to_string(), "blockHash": q.blockHash,
        "from": q.from, "token": q.token, "data": q.data, "feeToken": q.feeToken, "gasLimit": q.gasLimit.to_string(),
    })
}
pub fn answer_json(a: &Answer) -> Value {
    json!({
        "success": a.success, "returnDataHash": a.returnDataHash, "gasUsed": a.gasUsed.to_string(),
        "feeCharged": a.feeCharged.to_string(), "receiver": a.receiver,
        "receiverBefore": a.receiverBefore.to_string(), "receiverAfter": a.receiverAfter.to_string(),
    })
}

pub fn ju256(v: &Value, f: &str) -> Result<U256, String> {
    let x = &v[f];
    if let Some(n) = x.as_u64() {
        return Ok(U256::from(n));
    }
    let s = x.as_str().ok_or_else(|| format!("field {f}: missing or not a string/number"))?;
    if let Some(h) = s.strip_prefix("0x") {
        U256::from_str_radix(h, 16).map_err(|e| format!("{f}: {e}"))
    } else {
        U256::from_str_radix(s, 10).map_err(|e| format!("{f}: {e}"))
    }
}
pub fn ju64(v: &Value, f: &str) -> Result<u64, String> {
    let u = ju256(v, f)?;
    u64::try_from(u).map_err(|_| format!("{f}: does not fit u64"))
}
pub fn jparse<T: FromStr>(v: &Value, f: &str) -> Result<T, String>
where
    T::Err: std::fmt::Display,
{
    let s = v[f].as_str().ok_or_else(|| format!("field {f}: missing or not a string"))?;
    T::from_str(s).map_err(|e| format!("{f}: {e}"))
}

pub fn parse_question(v: &Value) -> Result<Question, String> {
    Ok(Question {
        chainId: ju64(v, "chainId")?,
        blockNumber: ju64(v, "blockNumber")?,
        blockHash: jparse(v, "blockHash")?,
        from: jparse(v, "from")?,
        token: jparse(v, "token")?,
        data: jparse(v, "data")?,
        feeToken: jparse(v, "feeToken")?,
        gasLimit: ju64(v, "gasLimit")?,
    })
}
pub fn parse_answer(v: &Value) -> Result<Answer, String> {
    Ok(Answer {
        success: v["success"].as_bool().ok_or("field success: not a bool")?,
        returnDataHash: jparse(v, "returnDataHash")?,
        gasUsed: ju64(v, "gasUsed")?,
        feeCharged: ju256(v, "feeCharged")?,
        receiver: jparse(v, "receiver")?,
        receiverBefore: ju256(v, "receiverBefore")?,
        receiverAfter: ju256(v, "receiverAfter")?,
    })
}

pub fn read_json(path: &str) -> Result<Value, String> {
    let s = if path == "-" {
        let mut s = String::new();
        std::io::Read::read_to_string(&mut std::io::stdin(), &mut s).map_err(|e| e.to_string())?;
        s
    } else {
        std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?
    };
    serde_json::from_str(&s).map_err(|e| format!("{path}: {e}"))
}

pub fn hexb(b: &[u8]) -> String {
    format!("0x{}", alloy_primitives::hex::encode(b))
}

// ------------------------------------------------------------------------------------------------
// Witness capture
// ------------------------------------------------------------------------------------------------

pub struct Captured {
    pub input: Input,
    pub public_values: Vec<u8>,
    pub answer: Answer,
    /// `Some(reason)` when Tempo's handler would reject the tx before execution (R3.8).
    pub invalid: Option<String>,
    pub accounts: usize,
    pub slots: usize,
    pub rpc_calls: usize,
}

/// Discover + MPT-verify the witness for `q` at `q.blockNumber`, then replay it through the guest
/// path natively. `Err` means no witness (the caller reports the answer as unprotected).
pub fn capture(rpc: &Rpc, q: &Question) -> Result<Captured, String> {
    let blk = fetch_block(rpc, q.blockNumber)?;
    if blk.hash != q.blockHash {
        return Err(format!("block {} hash is {} on this RPC, question names {}", q.blockNumber, blk.hash, q.blockHash));
    }
    let header = bind_header(&blk.raw_header, blk.hash).map_err(|e| format!("header: {e}"))?;
    let mut lazy = LazyDb::new(rpc.clone(), q.blockNumber, header.inner.state_root);
    let host = answer_question(&header, blk.hash, q, &mut lazy, true).map_err(|e| format!("abort (R3.3): {e}"))?;
    let slots = lazy.slot_count();
    let witness = lazy.into_witness();
    let accounts = witness.len();
    let input = Input { raw_header: blk.raw_header.clone(), accounts: witness, question: q.abi_encode().into() };
    let (pv, _, guest_a) = run(&input).map_err(|e| format!("guest replay abort: {e}"))?;
    if guest_a != host.answer {
        return Err(format!("guest replay {guest_a:?} != discovery {:?}", host.answer));
    }
    Ok(Captured { input, public_values: pv, answer: guest_a, invalid: host.invalid, accounts, slots, rpc_calls: rpc.calls.get() })
}

// ------------------------------------------------------------------------------------------------
// Sworn ABI
// ------------------------------------------------------------------------------------------------

const Q_T: &str = "(uint64,uint64,bytes32,address,address,bytes,address,uint64)";
const A_T: &str = "(bool,bytes32,uint64,uint256,address,uint256,uint256)";

pub fn selector(sig: &str) -> [u8; 4] {
    keccak256(sig.as_bytes())[..4].try_into().unwrap()
}

pub fn challenge_calldata(server: Address, q: &Question, a: &Answer, pv: &[u8], proof: &[u8]) -> Vec<u8> {
    let sig = format!("challenge(address,{Q_T},{A_T},bytes,bytes)");
    let args = (server, q.clone(), a.clone(), Bytes::copy_from_slice(pv), Bytes::copy_from_slice(proof)).abi_encode_params();
    [&selector(&sig)[..], &args].concat()
}
pub fn digest_of_calldata(q: &Question, a: &Answer) -> Vec<u8> {
    let sig = format!("digestOf({Q_T},{A_T})");
    [&selector(&sig)[..], &(q.clone(), a.clone()).abi_encode_params()].concat()
}

/// Custom errors of contracts/src/Sworn.sol (all argument-less) + the verifier's.
pub const SWORN_ERRORS: &[&str] = &[
    "ZeroAmount", "ZeroClient", "AmountTooLarge", "NoBond", "Unbonding", "InsufficientFree", "WrongChain",
    "BlockOutOfWindow", "BlockHashMismatch", "DigestUsed", "NoReservation", "Expired", "NotExpired",
    "WrongGuestVersion", "PublicBlockHashMismatch", "QuestionMismatch", "AnswerCorrect", "AlreadyUnbonding",
    "NotUnbonding", "UnbondDelayNotOver", "NothingToWithdraw", "TokenTransferFailed", "NotTip20Token",
    "BadCalldata", "VirtualReceiver", "ReceiverIsSender",
    // contracts/src/vendor/sp1-contracts/v6.1.0
    "WrongVerifierSelector(bytes4,bytes4)", "InvalidExitCode", "InvalidProof", "InvalidVkRoot",
    "PublicInputNotInField", "ProofInvalid",
];

/// Name of the custom error in revert data, if known.
pub fn decode_error(data: &str) -> String {
    let d = data.trim_start_matches("0x");
    if d.len() < 8 {
        return format!("revert (no data: {data})");
    }
    for e in SWORN_ERRORS {
        let sig = if e.contains('(') { e.to_string() } else { format!("{e}()") };
        if alloy_primitives::hex::encode(selector(&sig)) == d[..8] {
            return e.split('(').next().unwrap().to_string();
        }
    }
    format!("unknown error 0x{}", &d[..8])
}

/// Revert data from a JSON-RPC error object (`error.data` as hex or `{data: hex}`).
pub fn revert_data(e: &Value) -> Option<String> {
    e.get("data").and_then(|d| d.as_str().map(String::from).or_else(|| d.get("data").and_then(|x| x.as_str()).map(String::from)))
}

// ------------------------------------------------------------------------------------------------
// Transactions — the key only ever comes from an environment variable.
// ------------------------------------------------------------------------------------------------

pub fn signer_from_env(var: &str) -> Result<PrivateKeySigner, String> {
    let k = std::env::var(var).map_err(|_| format!("{var} is not set (keys come from env vars only)"))?;
    PrivateKeySigner::from_str(k.trim()).map_err(|_| format!("{var} is not a valid private key"))
}

pub struct Sent {
    pub hash: B256,
    pub receipt: Value,
}

/// Simulate with `eth_call` (returns the decoded revert instead of sending), then sign and send a
/// legacy transaction and wait (bounded) for its receipt.
pub fn send_call(rpc: &Rpc, signer: &PrivateKeySigner, to: Address, data: Vec<u8>) -> Result<Sent, String> {
    let from = signer.address();
    let call = json!({"from": from, "to": to, "data": hexb(&data)});
    if let Err(e) = rpc.call("eth_call", json!([call, "latest"])) {
        let name = revert_data(&e).map(|d| decode_error(&d)).unwrap_or_else(|| e.to_string());
        return Err(format!("simulation reverted: {name}"));
    }
    let chain_id = hu(&rpc.req("eth_chainId", json!([]))?)?;
    let nonce = hu(&rpc.req("eth_getTransactionCount", json!([from, "pending"]))?)?;
    let gas_price = hu(&rpc.req("eth_gasPrice", json!([]))?)? as u128;
    let est = hu(&rpc.req("eth_estimateGas", json!([call]))?)?;
    // Tempo prices state growth far above Ethereum; the node's estimate already includes it.
    let gas_limit = (est.saturating_mul(13) / 10 + 50_000).min(30_000_000);
    let tx = TxLegacy {
        chain_id: Some(chain_id),
        nonce,
        gas_price: gas_price * 2,
        gas_limit,
        to: TxKind::Call(to),
        value: U256::ZERO,
        input: data.into(),
    };
    let sig = signer.sign_hash_sync(&tx.signature_hash()).map_err(|e| e.to_string())?;
    let env: TxEnvelope = tx.into_signed(sig).into();
    let raw = env.encoded_2718();
    let hash: B256 = hp(&rpc.req("eth_sendRawTransaction", json!([hexb(&raw)]))?)?;
    let t0 = Instant::now();
    loop {
        let r = rpc.req("eth_getTransactionReceipt", json!([hash]))?;
        if !r.is_null() {
            return Ok(Sent { hash, receipt: r });
        }
        if t0.elapsed() > Duration::from_secs(90) {
            return Err(format!("no receipt for {hash} after 90 s"));
        }
        std::thread::sleep(Duration::from_millis(500));
    }
}
