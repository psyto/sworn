//! Sworn host (spec 001 §R3 + §R3.7).
//!
//!   spike-host ac1                 AC-1: ≥6 questions at the latest block, guest(core)=host, vs RPC
//!   spike-host ac2 <count>         AC-2: replay first-tx TIP-20 transfers on MPT-verified B−1 state
//!   spike-host ac2-reverts <count> [lookback]   AC-2 on recent REVERTED real txs (ac2_reverts.rs)
//!
//! Read-only RPC only. Every witness is discovered by running the SAME executor over an RPC-backed
//! lazy DB (R3.5) whose every account/slot is an `eth_getProof` at N verified against N's stateRoot.
mod ac2_reverts;
mod rpc;

use alloy_consensus::transaction::SignerRecoverable;
use alloy_eips::{Decodable2718, eip2935::HISTORY_STORAGE_ADDRESS, eip4788::BEACON_ROOTS_ADDRESS};
use alloy_evm::FromTxWithEncoded;
use alloy_primitives::{Address, B256, Bytes, U256, address, keccak256};
use alloy_sol_types::{SolCall, SolValue};
use revm::{
    DatabaseCommit,
    context::{Context, Transaction, result::ExecutionResult},
    database::State,
    handler::SystemCallEvm,
    MainContext,
};
use rpc::*;
use serde_json::{Value, json};
use spike_core::*;
use std::{collections::BTreeMap, fs, time::Instant};
use tempo_chainspec::TempoHardfork;
use tempo_primitives::{TempoTxEnvelope, transaction::calc_gas_balance_spending};
use tempo_revm::{TempoEvm, TempoTxEnv};

const FEE_MANAGER: Address = address!("0xfeec000000000000000000000000000000000000");
const SYSTEM_ADDRESS: Address = address!("0xfffffffffffffffffffffffffffffffffffffffe");
const TRANSFER_TOPIC: B256 =
    alloy_primitives::b256!("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef");

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("ac1") => ac1(),
        Some("ac2") => ac2(args.get(2).map(|s| s.parse().unwrap()).unwrap_or(30)),
        Some("ac2-reverts") => ac2_reverts::ac2_reverts(
            args.get(2).map(|s| s.parse().unwrap()).unwrap_or(5),
            args.get(3).map(|s| s.parse().unwrap()).unwrap_or(60),
        ),
        _ => {
            eprintln!("usage: spike-host ac1 | ac2 <count> | ac2-reverts <count> [lookback]");
            std::process::exit(2)
        }
    }
}

fn out_dir(p: &str) -> String {
    let d = format!("{}/../out/{p}", env!("CARGO_MANIFEST_DIR"));
    fs::create_dir_all(&d).unwrap();
    d
}
fn hexb(b: &[u8]) -> String {
    format!("0x{}", alloy_primitives::hex::encode(b))
}
fn answer_json(a: &Answer) -> Value {
    json!({
        "success": a.success, "returnDataHash": a.returnDataHash, "gasUsed": a.gasUsed,
        "feeCharged": a.feeCharged.to_string(), "receiver": a.receiver,
        "receiverBefore": a.receiverBefore.to_string(), "receiverAfter": a.receiverAfter.to_string(),
    })
}
fn question_json(q: &Question) -> Value {
    json!({
        "chainId": q.chainId, "blockNumber": q.blockNumber, "blockHash": q.blockHash, "from": q.from,
        "token": q.token, "data": q.data, "feeToken": q.feeToken, "gasLimit": q.gasLimit,
    })
}

// ================================================================================================
// AC-1
// ================================================================================================

struct Case {
    name: &'static str,
    from: Address,
    token: Address,
    data: Vec<u8>,
    fee_token: Address,
}

const HOLDER: Address = address!("0x67187698f30418a78a2f3f197569da694f03d655");
const PLAIN_RECEIVER: Address = address!("0x8624b22d64678985aaee78abff7643e58e69076c");
/// ReceivePolicyUpdated(senderPolicyId = 0 = REJECT_ALL) at block 37914995 (eth_getLogs, 0x403C…).
const BLOCKING_RECEIVER: Address = address!("0x384314c543c3cbe50d3f148f7da97d5f8be928ec");
/// "DUSD": transferPolicyId = 0 (REJECT_ALL) via TransferPolicyUpdate; HOLDER holds 1e7.
const DUSD: Address = address!("0x20c0000000000000000000005c58fc053c52e0d1");
fn tok(i: u8) -> Address {
    let mut b = [0u8; 20];
    b[0] = 0x20;
    b[1] = 0xc0;
    b[19] = i;
    Address::from(b)
}

fn balance_of_rpc(rpc: &Rpc, token: Address, who: Address, n: u64) -> U256 {
    let data = [&[0x70, 0xa0, 0x82, 0x31][..], &who.abi_encode()].concat();
    hu256(&rpc.req("eth_call", json!([{"to": token, "data": hexb(&data)}, hx(n)])))
}

fn ac1() {
    let rpc = Rpc::new();
    let n = rpc.block_number();
    let blk = fetch_block(&rpc, n, false);
    let header = bind_header(&blk.raw_header, blk.hash).unwrap();
    let state_root = header.inner.state_root;
    let whole3 = balance_of_rpc(&rpc, tok(3), HOLDER, n);
    let bal2 = balance_of_rpc(&rpc, tok(2), HOLDER, n);
    let x = |to: Address, amt: U256| transferCall { to, amount: amt }.abi_encode();
    let cases = vec![
        Case { name: "ordinary", from: HOLDER, token: tok(1), data: x(PLAIN_RECEIVER, U256::from(1_000_000u64)), fee_token: tok(1) },
        Case { name: "receive_policy_blocked", from: HOLDER, token: tok(1), data: x(BLOCKING_RECEIVER, U256::from(1_000_000u64)), fee_token: tok(1) },
        Case { name: "tip403_rejected", from: HOLDER, token: DUSD, data: x(PLAIN_RECEIVER, U256::from(1u64)), fee_token: tok(0) },
        Case { name: "insufficient_balance", from: HOLDER, token: tok(2), data: x(PLAIN_RECEIVER, bal2 + U256::from(1)), fee_token: tok(2) },
        Case { name: "insufficient_balance_other_fee_token", from: HOLDER, token: tok(2), data: x(PLAIN_RECEIVER, bal2 + U256::from(1)), fee_token: tok(1) },
        Case { name: "whole_balance_in_fee_token", from: HOLDER, token: tok(3), data: x(PLAIN_RECEIVER, whole3), fee_token: tok(3) },
        Case {
            name: "transfer_with_memo",
            from: HOLDER,
            token: tok(1),
            data: transferWithMemoCall { to: PLAIN_RECEIVER, amount: U256::from(7u64), memo: B256::repeat_byte(0x5a) }.abi_encode(),
            fee_token: tok(1),
        },
        Case { name: "invalid_fee_token_dusd", from: HOLDER, token: tok(1), data: x(PLAIN_RECEIVER, U256::from(1u64)), fee_token: DUSD },
    ];
    println!("AC-1 at block {n} hash {} (T={:?})", blk.hash, moderato_hardfork_at(header.inner.timestamp));
    let fixtures = out_dir("fixtures");
    let inputs = out_dir("inputs");
    let mut report = vec![];
    let mut vectors = vec![];
    let (mut matched, mut unvalidated, mut mismatched, mut notexpr) = (0, 0, 0, 0);
    let base_fee = header.inner.base_fee_per_gas.unwrap();
    for c in &cases {
        let t0 = Instant::now();
        let q = Question {
            chainId: MODERATO_CHAIN_ID,
            blockNumber: n,
            blockHash: blk.hash,
            from: c.from,
            token: c.token,
            data: c.data.clone().into(),
            feeToken: c.fee_token,
            gasLimit: 300_000,
        };
        // ---- witness discovery (R3.5): same executor, RPC-backed lazy DB at N
        let mut lazy = LazyDb::new(rpc.clone(), n, state_root);
        let host = answer_question(&header, blk.hash, &q, &mut lazy, true).expect("host abort");
        let discovered = t0.elapsed();
        let nslots = lazy.slot_count();
        let witness = lazy.into_witness();
        let nacc = witness.len();
        // ---- guest path, natively: MPT-verified closed witness
        let input = Input { raw_header: blk.raw_header.clone(), accounts: witness, question: q.abi_encode().into() };
        let (pv, _, guest_a) = run(&input).expect("guest abort");
        assert_eq!(guest_a, host.answer, "guest != host for {}", c.name);
        let enc = bincode::serialize(&input).unwrap();
        fs::write(format!("{inputs}/{}.bin", c.name), &enc).unwrap();
        fs::write(format!("{inputs}/{}.bin.expected", c.name), &pv).unwrap();
        // ---- fees-off run of the same core (explains RPC differences; never the guest)
        let mut lazy_off = LazyDb::new(rpc.clone(), n, state_root);
        let off = answer_question(&header, blk.hash, &q, &mut lazy_off, false).expect("off abort");

        // ---- AC-1a: the same R3.2 fields through the RPC (legacy-typed request: no `feeToken`,
        // because `feeToken` turns the RPC request into an AA env, which R3.2 is not; fees are
        // not charged on the RPC path either way — measured, see out/ac1_run1.log).
        let nonce = rpc_nonce(&rpc, c.from, n);
        let call = json!({"from": c.from, "to": c.token, "data": q.data, "gas": hx(q.gasLimit),
            "gasPrice": hx(base_fee), "nonce": hx(nonce), "value": "0x0"});
        let ct = rpc.call("debug_traceCall", json!([call, hx(n), {"tracer": "callTracer"}]));
        let diff = rpc.call("debug_traceCall", json!([call, hx(n), {"tracer": "prestateTracer", "tracerConfig": {"diffMode": true}}]));
        let ec = rpc.call("eth_call", json!([call, hx(n)]));
        let rpc_before = balance_of_rpc(&rpc, c.token, guest_a.receiver, n);
        let slot = tip20_balance_slot(guest_a.receiver);
        let (rpc_view, rpc_note) = rpc_answer(&ct, &diff, &ec, c.token, slot, rpc_before, &q, guest_a.receiver);
        let rpc_charges_fee = diff.as_ref().map(|d| diff_touches_fee(d, c.fee_token)).unwrap_or(false);
        assert!(!rpc_charges_fee, "RPC charged a fee — AC-1a assumption broken");

        let fields = ["success", "returnDataHash", "gasUsed", "receiverBefore", "receiverAfter"];
        let mut cmp = serde_json::Map::new();
        let mut off_ok = true;
        for f in fields {
            let o = field(&off.answer, f);
            let r = rpc_view.get(f).cloned().unwrap_or(Value::Null);
            off_ok &= o == r;
            cmp.insert(f.into(), json!({"guest_fees_off": o, "rpc": r, "eq": o == r, "guest_fees_on": field(&guest_a, f)}));
        }
        // AC-1b: fees-on deltas are not visible to the RPC. They are validated by AC-2 (real-tx
        // replay vs receipts) and, for invalid-by-fee, by the pinned unit test. Never "passed" here.
        let fees_on_differs = fields.iter().any(|f| field(&guest_a, f) != field(&off.answer, f));
        let ac1b = if host.invalid.is_some() {
            "invalid-by-fee: pinned by unit test tests::invalid_by_fee_is_proven_not_aborted"
        } else if fees_on_differs {
            "fees-on differs from fees-off: UNVALIDATED by RPC (validated only to the extent AC-2 covers it)"
        } else {
            "fees-on equals fees-off on all RPC-visible fields; feeCharged UNVALIDATED by RPC (AC-2 covers it)"
        };
        cmp.insert("feeCharged".into(), json!({"guest_fees_on": guest_a.feeCharged.to_string(),
            "rpc": "not expressible: RPC eth_call/debug_traceCall path does not charge fees", "counted": false}));
        // The RPC cannot express R3.2's (legacy env, explicit feeToken ≠ token): a legacy request
        // gets fee_token = None and Tempo resolves it (preference, else the called token). Such a
        // case is NOT counted; we additionally run the RPC-expressible env and report it.
        // Which fee token would Tempo resolve for the RPC's env (fee_token = None)? Read it from the
        // fee-collection Transfer(from -> FeeManager) log of a fees-on run of that env.
        let resolved = {
            let mut lz = LazyDb::new(rpc.clone(), n, state_root);
            let v = answer_question_env(&header, blk.hash, &q, &mut lz, true, false).expect("resolve abort");
            v.logs.iter().find(|l| l.topics().len() == 3 && l.topics()[0] == TRANSFER_TOPIC
                && l.topics()[1] == c.from.into_word() && l.topics()[2] == FEE_MANAGER.into_word()).map(|l| l.address)
        };
        let expressible = resolved == Some(c.fee_token);
        println!("   RPC-env resolved fee token: {resolved:?} (q.feeToken {})", c.fee_token);
        let mut variant = Value::Null;
        if !expressible {
            let mut lz = LazyDb::new(rpc.clone(), n, state_root);
            let v = answer_question_env(&header, blk.hash, &q, &mut lz, false, false).expect("variant abort");
            let ok = fields.iter().all(|f| field(&v.answer, f) == rpc_view.get(f).cloned().unwrap_or(Value::Null));
            variant = json!({"env": "fees off, fee_token=None (RPC-resolved)", "answer": answer_json(&v.answer), "matches_rpc": ok});
            println!("   variant (fee_token=None, fees off) matches RPC: {ok}  gas={}", v.answer.gasUsed);
        }
        let status = if !expressible {
            notexpr += 1;
            "AC-1a NOT EXPRESSIBLE (fee token the RPC env resolves != q.feeToken) — not counted"
        } else if off_ok {
            matched += 1;
            "AC-1a MATCHED"
        } else {
            mismatched += 1;
            "AC-1a MISMATCH"
        };
        cmp.insert("rpc_expressible_variant".into(), variant);
        if fees_on_differs || host.invalid.is_some() {
            unvalidated += 1;
        }
        println!("   AC-1b: {ac1b}");
        println!(
            "[{}] {status}\n   guest(fees on) = {:?}\n   invalid={:?} witness: {nacc} accounts {nslots} slots, discovery {:?}, rpc calls so far {}\n   rpc: {rpc_note}",
            c.name, guest_a, host.invalid, discovered, rpc.calls.get()
        );
        report.push(json!({"case": c.name, "status": status, "question": question_json(&q),
            "answer": answer_json(&guest_a), "invalid": host.invalid, "compare": cmp,
            "rpc_note": rpc_note, "ac1b": ac1b, "answer_fees_off": answer_json(&off.answer), "witness_accounts": nacc, "witness_slots": nslots,
            "discovery_ms": discovered.as_millis() as u64, "public_values": hexb(&pv)}));
        let mut wrong = guest_a.clone();
        wrong.receiverAfter = guest_a.receiverBefore + U256::from(1_000_000u64);
        if wrong == guest_a {
            wrong.receiverAfter += U256::from(1);
        }
        vectors.push(json!({"case": c.name, "q": question_json(&q), "a": answer_json(&guest_a),
            "q_abi": hexb(&q.abi_encode()), "a_abi": hexb(&guest_a.abi_encode()),
            "publicValues": hexb(&pv), "wrongClaimedAnswer": answer_json(&wrong),
            "wrongClaimedAnswer_abi": hexb(&wrong.abi_encode())}));
    }
    println!("AC-1a (fees off vs RPC): matched {matched} / {} counted ; mismatched {mismatched} ; not expressible (uncounted) {notexpr} of {} cases. AC-1b fees-on cases not RPC-validatable: {unvalidated}", matched + mismatched, cases.len());
    fs::write(format!("{}/ac1.json", out_dir("ac1")), serde_json::to_string_pretty(&json!({
        "block": n, "blockHash": blk.hash, "matched": matched, "unvalidated": unvalidated,
        "mismatched": mismatched, "not_expressible": notexpr, "total": cases.len(), "cases": report}))
        .unwrap()).unwrap();
    fs::write(format!("{fixtures}/vectors.json"), serde_json::to_string_pretty(&json!({
        "GUEST_VERSION": GUEST_VERSION, "GUEST_VERSION_LABEL": GUEST_VERSION_LABEL,
        "encoding": "publicValues = abi.encode(bytes32 GUEST_VERSION, bytes32 blockHash, Question q, Answer a)",
        "block": n, "vectors": vectors})).unwrap()).unwrap();
}

fn rpc_nonce(rpc: &Rpc, a: Address, n: u64) -> u64 {
    hu(&rpc.req("eth_getTransactionCount", json!([a, hx(n)])))
}

fn field(a: &Answer, f: &str) -> Value {
    match f {
        "success" => json!(a.success),
        "returnDataHash" => json!(a.returnDataHash),
        "gasUsed" => json!(a.gasUsed),
        "receiverBefore" => json!(a.receiverBefore.to_string()),
        "receiverAfter" => json!(a.receiverAfter.to_string()),
        _ => unreachable!(),
    }
}

/// What the RPC says for the answer fields it can express.
fn rpc_answer(
    ct: &Result<Value, Value>,
    diff: &Result<Value, Value>,
    ec: &Result<Value, Value>,
    token: Address,
    slot: U256,
    before: U256,
    _q: &Question,
    _receiver: Address,
) -> (BTreeMap<&'static str, Value>, String) {
    let mut m = BTreeMap::new();
    m.insert("receiverBefore", json!(before.to_string()));
    let mut note = String::new();
    match ct {
        Ok(t) => {
            let ok = t.get("error").is_none();
            m.insert("success", json!(ok));
            m.insert("gasUsed", json!(hu(&t["gasUsed"])));
            note += &format!("callTracer ok={ok} gasUsed={} err={:?}; ", hu(&t["gasUsed"]), t.get("error"));
        }
        Err(e) => {
            // The RPC rejected the transaction before execution.
            m.insert("success", json!(false));
            m.insert("returnDataHash", json!(keccak256([])));
            m.insert("gasUsed", json!(0));
            note += &format!("callTracer rejected: {e}; ");
        }
    }
    // Return bytes from eth_call: result on success, `error.data` on revert, empty on halt.
    let ret: Bytes = match ec {
        Ok(v) => hp(v),
        Err(e) => e.get("data").filter(|d| d.is_string()).map(hp).unwrap_or_default(),
    };
    m.insert("returnDataHash", json!(keccak256(&ret)));
    if let (Ok(t), Ok(_)) = (ct, ec) {
        if t.get("error").is_some() {
            note += "WARN callTracer error but eth_call ok; ";
        }
    }
    let after = match diff {
        Ok(d) => {
            let key = format!("0x{}", alloy_primitives::hex::encode(slot.to_be_bytes::<32>()));
            let tk = format!("{token:#x}");
            let post = d["post"].get(&tk).and_then(|a| a["storage"].get(&key)).map(hu256);
            post.unwrap_or(before)
        }
        Err(_) => before,
    };
    m.insert("receiverAfter", json!(after.to_string()));
    note += &format!("eth_call={}", match ec { Ok(v) => v.to_string(), Err(e) => e.to_string() });
    (m, note)
}

fn diff_touches_fee(d: &Value, fee_token: Address) -> bool {
    let fm_slot = tip20_balance_slot(FEE_MANAGER);
    let key = format!("0x{}", alloy_primitives::hex::encode(fm_slot.to_be_bytes::<32>()));
    d["post"].get(format!("{fee_token:#x}")).and_then(|a| a["storage"].get(&key)).is_some()
}

// ================================================================================================
// AC-2
// ================================================================================================

fn selector_ok(data: &[u8]) -> bool {
    data.len() >= 4 && (data[..4] == transferCall::SELECTOR || data[..4] == transferWithMemoCall::SELECTOR)
}

/// tx0 eligibility: a single top-level TIP-20 transfer/transferWithMemo. Returns (to, data).
fn tip20_transfer_of(tx: &Value) -> Option<(Address, Bytes)> {
    if let Some(calls) = tx.get("calls").and_then(|c| c.as_array()) {
        if calls.len() != 1 {
            return None;
        }
        let to: Address = hp(&calls[0]["to"]);
        let data: Bytes = hp(&calls[0]["input"]);
        return (to.as_slice()[..12] == [0x20, 0xc0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] && selector_ok(&data)).then_some((to, data));
    }
    let to: Address = tx.get("to").filter(|v| !v.is_null()).map(hp)?;
    let data: Bytes = hp(&tx["input"]);
    (to.as_slice()[..12] == [0x20, 0xc0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] && selector_ok(&data)).then_some((to, data))
}

fn decode_receiver(data: &[u8]) -> Address {
    if data[..4] == transferCall::SELECTOR {
        transferCall::abi_decode(data).unwrap().to
    } else {
        transferWithMemoCall::abi_decode(data).unwrap().to
    }
}

fn ac2(target: usize) {
    let rpc = Rpc::new();
    let mut results = vec![];
    let mut excluded = vec![];
    let mut seen = rpc.block_number();
    let t_start = Instant::now();
    let mut scanned = 0u64;
    while results.len() < target && t_start.elapsed().as_secs() < 3600 {
        let latest = rpc.block_number();
        if latest <= seen {
            std::thread::sleep(std::time::Duration::from_millis(300));
            continue;
        }
        // Newest first so the proof window is never at risk; skipping older unseen blocks is
        // selection (not filtering of results).
        let b = latest;
        seen = latest;
        scanned += 1;
        let blk = fetch_block(&rpc, b, true);
        let txs = blk.json["transactions"].as_array().unwrap().clone();
        let Some(tx0) = txs.first() else { continue };
        let Some((token, data)) = tip20_transfer_of(tx0) else { continue };
        let from: Address = hp(&tx0["from"]);
        let receiver = decode_receiver(&data);
        // Selection rule: no later tx in B may name sender/receiver (so balances read at B are
        // attributable to tx0). Decided BEFORE replay from tx JSON; listed if it applies.
        let needles = [format!("{from:x}"), format!("{receiver:x}")];
        let later_touch = txs[1..].iter().any(|t| {
            let s = t.to_string().to_lowercase();
            needles.iter().any(|nd| s.contains(nd.trim_start_matches("0x")))
        });
        if later_touch {
            excluded.push(json!({"block": b, "reason": "a later tx in B names tx0's sender or receiver"}));
            continue;
        }
        write_ac2(&results, &excluded, scanned, false);
        let r = replay(&rpc, &blk, tx0, token, receiver);
        match r {
            Ok(v) => {
                let ok = v["mismatches"].as_array().unwrap().is_empty();
                println!("B={b} tx0={} {} gas={} fee={} mismatches={}", v["tx"], if ok { "MATCH" } else { "MISMATCH" }, v["gasUsed"], v["fee"], v["mismatches"]);
                results.push(v);
            }
            Err(e) => {
                if e.starts_with("EXCLUDE") {
                    println!("B={b} excluded: {e}");
                    excluded.push(json!({"block": b, "reason": e}));
                } else {
                    println!("B={b} ERROR (counted as mismatch): {e}");
                    results.push(json!({"block": b, "mismatches": [e]}));
                }
            }
        }
    }
    write_ac2(&results, &excluded, scanned, true);
    let matched = results.iter().filter(|v| v["mismatches"].as_array().unwrap().is_empty()).count();
    println!("AC-2: matched {matched} / {} (scanned {scanned} head blocks, excluded {})", results.len(), excluded.len());
}

fn write_ac2(results: &[Value], excluded: &[Value], scanned: u64, done: bool) {
    let matched = results.iter().filter(|v| v["mismatches"].as_array().unwrap().is_empty()).count();
    fs::write(format!("{}/ac2.json", out_dir("ac2")), serde_json::to_string_pretty(&json!({
        "done": done, "matched": matched, "total": results.len(), "scanned_head_blocks": scanned,
        "excluded": excluded, "results": results})).unwrap()).unwrap();
}

fn replay(rpc: &Rpc, blk: &BlockRef, tx0: &Value, token: Address, receiver: Address) -> Result<Value, String> {
    let b = blk.number;
    let t0 = Instant::now();
    let parent = fetch_block(rpc, b - 1, false);
    let hb = bind_header(&blk.raw_header, blk.hash).map_err(|e| e.to_string())?;
    let hp_ = bind_header(&parent.raw_header, parent.hash).map_err(|e| e.to_string())?;
    if hb.inner.parent_hash != parent.hash {
        return Err("parent hash mismatch".into());
    }
    let spec = moderato_hardfork_at(hb.inner.timestamp);
    if spec != moderato_hardfork_at(hp_.inner.timestamp) {
        return Err(format!("EXCLUDE hardfork activation at B ({spec:?})"));
    }
    let txh: B256 = hp(&tx0["hash"]);
    let res = rpc.batch(&[
        ("eth_getRawTransactionByHash", json!([txh])),
        ("eth_getTransactionReceipt", json!([txh])),
        ("debug_traceTransaction", json!([txh, {"tracer": "prestateTracer"}])),
    ]);
    let raw: Bytes = hp(res[0].as_ref().map_err(|e| e.to_string())?);
    let receipt = res[1].clone().map_err(|e| e.to_string())?;
    // ---- Tempo's own tx -> env conversion
    let env = TempoTxEnvelope::decode_2718(&mut raw.as_ref()).map_err(|e| format!("decode: {e}"))?;
    let sender = env.recover_signer().map_err(|e| format!("recover: {e}"))?;
    let from: Address = hp(&tx0["from"]);
    if sender != from {
        return Err(format!("recovered sender {sender} != rpc from {from}"));
    }
    let tx_env = TempoTxEnv::from_encoded_tx(&env, sender, raw.clone());
    let fee_payer = tx_env.fee_payer().map_err(|e| format!("{e:?}"))?;

    // ---- prestate = state after B−1, every read MPT-verified against B−1's stateRoot
    let mut lazy = LazyDb::new(rpc.clone(), b - 1, hp_.inner.state_root);
    if let Ok(pre) = &res[2] {
        lazy.prefetch(&prestate_hint(pre)).map_err(|e| e.to_string())?;
    }
    let tracked = Tracked::new(lazy);
    let fault = tracked.fault.clone();
    let mut state = State::builder().with_database(tracked).build();
    let block = block_env(&hb);
    let mut cfg = cfg_env(spec, true);
    cfg.disable_eip3607 = false; // a real block
    cfg.disable_block_gas_limit = false;

    // ---- B's pre-execution changes (tempo-evm TempoBlockExecutor::apply_pre_execution_changes)
    fn mk<'a>(
        st: &'a mut State<Tracked<LazyDb>>,
        block: &tempo_revm::TempoBlockEnv,
        cfg: &revm::context::CfgEnv<TempoHardfork>,
    ) -> TempoEvm<&'a mut State<Tracked<LazyDb>>, ()> {
        let ctx = Context::mainnet().with_db(st).with_block(block.clone()).with_cfg(cfg.clone()).with_tx(TempoTxEnv::default());
        TempoEvm::new(ctx, ())
    }
    {
        let r = mk(&mut state, &block, &cfg)
            .system_call_with_caller(SYSTEM_ADDRESS, HISTORY_STORAGE_ADDRESS, hb.inner.parent_hash.0.into())
            .map_err(|e| format!("eip2935: {e:?}"))?;
        state.commit(r.state);
    }
    if let Some(root) = hb.inner.parent_beacon_block_root {
        let r = mk(&mut state, &block, &cfg)
            .system_call_with_caller(SYSTEM_ADDRESS, BEACON_ROOTS_ADDRESS, root.0.into())
            .map_err(|e| format!("eip4788: {e:?}"))?;
        state.commit(r.state);
    }
    // Activation-boundary deployments: no-ops unless the marker code is missing.
    use tempo_contracts::precompiles as pc;
    let boundary: Vec<(TempoHardfork, Address)> = vec![
        (TempoHardfork::T2, pc::VALIDATOR_CONFIG_V2_ADDRESS),
        (TempoHardfork::T3, pc::SIGNATURE_VERIFIER_ADDRESS),
        (TempoHardfork::T3, pc::ADDRESS_REGISTRY_ADDRESS),
        (TempoHardfork::T5, pc::TIP20_CHANNEL_RESERVE_ADDRESS),
        (TempoHardfork::T6, pc::RECEIVE_POLICY_GUARD_ADDRESS),
        (TempoHardfork::T7, pc::STORAGE_CREDITS_ADDRESS),
        (TempoHardfork::T8, pc::CURRENT_COMMITTEE_ADDRESS),
        (TempoHardfork::T10, pc::ZONE_FACTORY_ADDRESS),
    ];
    for (f, a) in &boundary {
        if spec >= *f {
            use revm::Database;
            let info = state.basic(*a).map_err(|e| e.to_string())?.unwrap_or_default();
            if info.is_empty_code_hash() {
                return Err(format!("EXCLUDE activation-boundary deployment pending at {a}"));
            }
        }
    }
    // ---- tx0
    let base_fee = hb.inner.base_fee_per_gas.unwrap_or_default();
    let eff_price = tx_env.effective_gas_price(base_fee as u128);
    let out = spike_core::transact(&mut state, cfg.clone(), block.clone(), tx_env.clone());
    if let Some(a) = fault.borrow().clone() {
        return Err(format!("witness fault: {a}"));
    }
    let out = out.map_err(|e| format!("tx0 rejected: {e:?}"))?;
    let discovery = t0.elapsed();
    let (ok, logs) = match &out.result {
        ExecutionResult::Success { logs, .. } => (true, logs.clone()),
        ExecutionResult::Revert { logs, .. } => (false, logs.clone()),
        ExecutionResult::Halt { logs, .. } => (false, logs.clone()),
    };
    let gas = out.result.tx_gas_used();
    let mut mm: Vec<String> = vec![];
    let r_status = hu(&receipt["status"]) == 1;
    if ok != r_status {
        mm.push(format!("status ours={ok} receipt={r_status}"));
    }
    let r_gas = hu(&receipt["gasUsed"]);
    if gas != r_gas {
        mm.push(format!("gasUsed ours={gas} receipt={r_gas}"));
    }
    // logs: exact (address, topics, data)
    let r_logs = receipt["logs"].as_array().unwrap();
    let ours: Vec<(Address, Vec<B256>, Bytes)> = logs.iter().map(|l| (l.address, l.topics().to_vec(), l.data.data.clone())).collect();
    let theirs: Vec<(Address, Vec<B256>, Bytes)> = r_logs
        .iter()
        .map(|l| (hp(&l["address"]), l["topics"].as_array().unwrap().iter().map(hp).collect(), hp(&l["data"])))
        .collect();
    if ours != theirs {
        mm.push(format!("logs differ: ours {} receipt {}", ours.len(), theirs.len()));
    }
    // fee token + fee charged
    let r_fee_token: Address = hp(&receipt["feeToken"]);
    let r_eff: u128 = hu(&receipt["effectiveGasPrice"]) as u128;
    let r_fee = calc_gas_balance_spending(r_gas, r_eff);
    let fee_log = logs.iter().find(|l| {
        l.topics().len() == 3
            && l.topics()[0] == TRANSFER_TOPIC
            && l.topics()[1] == fee_payer.into_word()
            && l.topics()[2] == FEE_MANAGER.into_word()
    });
    let (our_fee_token, our_fee_logged) = fee_log.map(|l| (l.address, U256::from_be_slice(&l.data.data))).unwrap_or_default();
    let our_fee = calc_gas_balance_spending(gas, eff_price);
    if our_fee_token != r_fee_token {
        mm.push(format!("feeToken ours={our_fee_token} receipt={r_fee_token}"));
    }
    if our_fee != r_fee || our_fee_logged != r_fee || eff_price != r_eff {
        mm.push(format!("fee ours(calc)={our_fee} ours(log)={our_fee_logged} receipt={r_fee} effPrice ours={eff_price} receipt={r_eff}"));
    }
    // post balances at B, MPT-verified against B's stateRoot
    let mut checks: Vec<(Address, Address)> = vec![(token, from), (token, receiver)];
    if r_fee_token != token || fee_payer != from {
        checks.push((r_fee_token, fee_payer));
    }
    let mut post_report = vec![];
    for (tk, who) in checks {
        let slot = tip20_balance_slot(who);
        let ours = match out.state.get(&tk).and_then(|a| a.storage.get(&slot)) {
            Some(s) => s.present_value,
            None => {
                use revm::Database;
                state.storage(tk, slot).map_err(|e| e.to_string())?
            }
        };
        let theirs = proven_slot(rpc, tk, slot, b, hb.inner.state_root)?;
        post_report.push(json!({"token": tk, "owner": who, "ours": ours.to_string(), "atB": theirs.to_string()}));
        if ours != theirs {
            mm.push(format!("post balance {tk}/{who}: ours={ours} atB={theirs}"));
        }
    }
    let lazy = state.database.inner;
    Ok(json!({"block": b, "tx": txh, "type": tx0["type"], "token": token, "from": from, "receiver": receiver,
        "status": ok, "gasUsed": gas, "fee": our_fee.to_string(), "feeToken": our_fee_token,
        "witness_accounts": lazy.accounts.len(), "witness_slots": lazy.slot_count(),
        "replay_ms": discovery.as_millis() as u64, "post": post_report, "mismatches": mm}))
}

fn proven_slot(rpc: &Rpc, a: Address, slot: U256, n: u64, state_root: B256) -> Result<U256, String> {
    let key = format!("0x{}", alloy_primitives::hex::encode(slot.to_be_bytes::<32>()));
    let p = rpc.call("eth_getProof", json!([a, [key], hx(n)])).map_err(|e| e.to_string())?;
    let acc = AccountWitness {
        address: a,
        nonce: hu(&p["nonce"]),
        balance: hu256(&p["balance"]),
        storage_root: hp(&p["storageHash"]),
        code_hash: hp(&p["codeHash"]),
        code: Bytes::new(),
        account_proof: p["accountProof"].as_array().unwrap().iter().map(hp).collect(),
        storage: vec![],
    };
    // code is not needed for the leaf; verify the account leaf using its code hash directly
    let mut acc_chk = acc.clone();
    acc_chk.code = Bytes::new();
    verify_account_leaf(state_root, &acc_chk)?;
    let s = &p["storageProof"][0];
    let sw = StorageWitness { slot: hu256(&s["key"]), value: hu256(&s["value"]), proof: s["proof"].as_array().unwrap().iter().map(hp).collect() };
    verify_slot(acc.storage_root, a, &sw).map_err(|e| e.to_string())?;
    Ok(sw.value)
}

/// Account-leaf check without needing the code bytes (B's post-state read).
fn verify_account_leaf(state_root: B256, acc: &AccountWitness) -> Result<(), String> {
    use alloy_trie::{Nibbles, TrieAccount, proof::verify_proof};
    let exists = account_exists(acc.nonce, acc.balance, acc.code_hash, acc.storage_root);
    let leaf = TrieAccount { nonce: acc.nonce, balance: acc.balance, storage_root: acc.storage_root, code_hash: acc.code_hash };
    verify_proof(state_root, Nibbles::unpack(keccak256(acc.address)), exists.then(|| alloy_rlp::encode(leaf)), acc.account_proof.iter())
        .map_err(|e| format!("B account proof {}: {e:?}", acc.address))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn load(name: &str) -> Input {
        let p = format!("{}/../out/inputs/{name}.bin", env!("CARGO_MANIFEST_DIR"));
        bincode::deserialize(&fs::read(&p).unwrap_or_else(|_| panic!("missing fixture {p} (run `spike-host ac1`)"))).unwrap()
    }

    /// R3.8: a transaction Tempo's handler rejects before execution (fee collection fails with
    /// TIP-403 PolicyForbids on the DUSD fee token) is PROVEN as the invalid Answer, not aborted.
    #[test]
    fn invalid_by_fee_is_proven_not_aborted() {
        let input = load("invalid_fee_token_dusd");
        let (pv, q, a) = run(&input).expect("must not abort");
        assert_eq!(a.success, false);
        assert_eq!(a.returnDataHash, keccak256([]));
        assert_eq!(a.gasUsed, 0);
        assert_eq!(a.feeCharged, U256::ZERO);
        assert_eq!(a.receiverAfter, a.receiverBefore);
        assert_eq!(decode_public_values(&pv).unwrap(), (GUEST_VERSION, q.blockHash, q.clone(), a.clone()));
        // pin the handler error
        let header = bind_header(&input.raw_header, q.blockHash).unwrap();
        let db = build_witness_db(header.inner.state_root, &input.accounts).unwrap();
        let out = answer_question(&header, q.blockHash, &q, db, true).unwrap();
        let err = out.invalid.expect("handler must reject");
        assert!(err.contains("CollectFeePreTx") && err.contains("PolicyForbids"), "{err}");
    }

    /// The saved witness of a real question replays to the saved publicValues (guest = host).
    #[test]
    fn witness_replays_to_expected_public_values() {
        for name in ["ordinary", "receive_policy_blocked", "whole_balance_in_fee_token", "transfer_with_memo"] {
            let input = load(name);
            let expected = fs::read(format!("{}/../out/inputs/{name}.bin.expected", env!("CARGO_MANIFEST_DIR"))).unwrap();
            assert_eq!(run(&input).unwrap().0, expected, "{name}");
        }
    }

    /// Tampering any witness value fails closed (MPT proof failure → abort).
    #[test]
    fn abort_bad_proof() {
        let mut input = load("ordinary");
        let acc = input.accounts.iter_mut().find(|a| !a.storage.is_empty()).unwrap();
        acc.storage[0].value += U256::from(1);
        assert!(matches!(run(&input), Err(Abort::Proof(_))));
    }

    /// Dropping a witnessed slot the execution needs → abort (missing witness), never an answer.
    #[test]
    fn abort_missing_slot() {
        let mut input = load("ordinary");
        let tk = input_token(&input);
        let acc = input.accounts.iter_mut().find(|a| a.address == tk).unwrap();
        acc.storage.clear();
        assert!(matches!(run(&input), Err(Abort::MissingStorage(..))), "{:?}", run(&input).map(|r| r.2));
    }
    fn input_token(i: &Input) -> Address {
        Question::abi_decode(&i.question).unwrap().token
    }

    /// header.number != q.blockNumber → abort (R3.3/R3.7).
    #[test]
    fn abort_block_number_mismatch() {
        let mut input = load("ordinary");
        let mut q = Question::abi_decode(&input.question).unwrap();
        q.blockNumber += 1;
        input.question = q.abi_encode().into();
        assert!(matches!(run(&input), Err(Abort::BlockNumber { .. })));
    }

    /// keccak(rawHeader) != q.blockHash → abort.
    #[test]
    fn abort_block_hash_mismatch() {
        let mut input = load("ordinary");
        let mut q = Question::abi_decode(&input.question).unwrap();
        q.blockHash = B256::repeat_byte(7);
        input.question = q.abi_encode().into();
        assert!(matches!(run(&input), Err(Abort::HeaderHash { .. })));
    }
}
