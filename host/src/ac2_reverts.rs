//! AC-2 on REVERTING real transactions (spec 001 §R3.6 AC-2, extended 2026-10-04).
//!
//!   spike-host ac2-reverts <count> [lookback]
//!
//! The 40/40 replay (`spike-host ac2`) only ever met successful first-in-block transfers. This mode finds
//! real Moderato transactions whose receipt has status 0 — scanning the last `lookback` blocks (default
//! 60; state proofs are served only ~250 blocks ≈ 2.5 min behind head at ~1.7 blocks/s; a block >150
//! behind head is skipped, and a proof-window error is reported as skipped, never as a match or
//! mismatch) and then following the head — and replays
//! each one with Tempo's own engine (TempoTxEnv::from_encoded_tx → tempo-revm) on the state after B−1,
//! every read MPT-verified against B−1's stateRoot (the same LazyDb as AC-2). A reverted tx need not be
//! first in its block, so B's pre-execution changes and then EVERY earlier tx of B are executed and
//! committed first, in order (each also checked against its own receipt's status and gasUsed).
//!
//! Compared with the receipt: status, gasUsed, logs (address, topics, data, exact), fee token, fee
//! charged (from effectiveGasPrice), and post balances read at B (MPT-verified against B's stateRoot)
//! of the fee payer in the fee token and, for a TIP-20 transfer, of sender and receiver in the token.
//! A balance is compared only if no later tx in B names that owner (else it is listed as not
//! attributable). The revert reason (ours) is compared with debug_traceTransaction(callTracer): the
//! revert data must be byte-identical; a halt must be reported as an error by the tracer too.
//!
//! Runs until `count` reverted TIP-20 transfers were replayed (other reverted txs are replayed too, at
//! most 2 per (target class, selector)), or 60 min. Writes out/ac2_reverts/ac2_reverts.json.
//! Read-only RPC. Nothing is sent.
use super::*;
use std::collections::{BTreeSet, HashMap};

fn tx_calls(tx: &Value) -> Vec<(Option<Address>, Bytes)> {
    if let Some(calls) = tx.get("calls").and_then(|c| c.as_array()) {
        return calls.iter().map(|c| (c.get("to").filter(|v| !v.is_null()).map(hp), hp(c.get("input").or(c.get("data")).unwrap_or(&json!("0x"))))).collect();
    }
    vec![(tx.get("to").filter(|v| !v.is_null()).map(hp), hp(&tx["input"]))]
}

fn class_of(tx: &Value) -> String {
    let calls = tx_calls(tx);
    let (to, data) = &calls[0];
    let cls = match to {
        None => "create".to_string(),
        Some(a) if a.as_slice()[..12] == [0x20, 0xc0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] => "tip20".into(),
        Some(a) if a.as_slice()[..2] == [0xfe, 0xec] => "feeManager".into(),
        Some(a) if a.as_slice()[..2] == [0xde, 0xc0] => "dex".into(),
        Some(a) if a.as_slice()[..2] == [0x40, 0x3c] => "tip403".into(),
        Some(_) => "other".into(),
    };
    let sel = if data.len() >= 4 { alloy_primitives::hex::encode(&data[..4]) } else { "none".into() };
    format!("{cls}:0x{sel}{}", if calls.len() > 1 { format!("(+{} calls)", calls.len() - 1) } else { String::new() })
}

pub fn ac2_reverts(target: usize, lookback: u64) {
    let rpc = Rpc::new();
    let mut results: Vec<Value> = vec![];
    let mut skipped: Vec<Value> = vec![];
    let mut per_class: HashMap<String, usize> = HashMap::new();
    let mut transfers = 0usize;
    let t_start = Instant::now();
    let head0 = rpc.block_number();
    let mut next = head0.saturating_sub(lookback);
    let mut scanned = 0u64;
    println!("ac2-reverts: target {target} reverted TIP-20 transfers; scanning from block {next} (head {head0}, lookback {lookback}) then following head");
    while transfers < target && t_start.elapsed().as_secs() < 3600 {
        let head = rpc.block_number();
        if next > head {
            std::thread::sleep(std::time::Duration::from_millis(400));
            continue;
        }
        let b = next;
        next += 1;
        if head - b > 150 {
            skipped.push(json!({"block": b, "reason": format!("fell out of the proof window (head {head})")}));
            continue;
        }
        scanned += 1;
        let blk = fetch_block(&rpc, b, true);
        let rcs = match rpc.call("eth_getBlockReceipts", json!([hx(b)])) {
            Ok(v) => v,
            Err(e) => {
                skipped.push(json!({"block": b, "reason": format!("eth_getBlockReceipts: {e}")}));
                continue;
            }
        };
        let txs = blk.json["transactions"].as_array().unwrap().clone();
        let rcs = rcs.as_array().cloned().unwrap_or_default();
        for (i, tx) in txs.iter().enumerate() {
            let Some(rc) = rcs.iter().find(|r| r["transactionHash"] == tx["hash"]) else { continue };
            if hu(&rc["status"]) != 0 {
                continue;
            }
            let cls = class_of(tx);
            let is_transfer = tip20_transfer_of(tx).is_some();
            if !is_transfer {
                let n = per_class.entry(cls.clone()).or_default();
                if *n >= 2 {
                    continue;
                }
                *n += 1;
            }
            let r = replay_at(&rpc, &blk, &txs, &rcs, i);
            match r {
                Ok(mut v) => {
                    v["class"] = json!(cls);
                    let ok = v["mismatches"].as_array().unwrap().is_empty();
                    println!(
                        "B={b} idx={i} tx={} class={cls} {} status ours={} gas={} fee={} reason={} prior_txs={} balances_checked={} mismatches={}",
                        v["tx"], if ok { "MATCH" } else { "MISMATCH" }, v["status"], v["gasUsed"], v["fee"], v["reason"],
                        v["priorTxs"], v["post"].as_array().map(|a| a.len()).unwrap_or(0), v["mismatches"]
                    );
                    results.push(v);
                    if is_transfer {
                        transfers += 1;
                    }
                }
                Err(e) if e.starts_with("EXCLUDE") || e.contains("maximum proof window") => {
                    println!("B={b} idx={i} excluded: {e}");
                    skipped.push(json!({"block": b, "index": i, "tx": tx["hash"], "reason": e}));
                }
                Err(e) => {
                    println!("B={b} idx={i} tx={} class={cls} ERROR (counted as mismatch): {e}", tx["hash"]);
                    results.push(json!({"block": b, "index": i, "tx": tx["hash"], "class": cls, "mismatches": [e]}));
                    if is_transfer {
                        transfers += 1;
                    }
                }
            }
            write_out(&results, &skipped, scanned, false);
        }
    }
    write_out(&results, &skipped, scanned, true);
    let matched = results.iter().filter(|v| v["mismatches"].as_array().unwrap().is_empty()).count();
    let tr: Vec<&Value> = results.iter().filter(|v| v["class"].as_str().is_some_and(|c| c.starts_with("tip20:0xa9059cbb") || c.starts_with("tip20:0x95777d59"))).collect();
    println!(
        "AC-2 reverts: matched {matched} / {} reverted txs ({} TIP-20 transfers, {} matched) (scanned {scanned} blocks, skipped {})",
        results.len(), tr.len(), tr.iter().filter(|v| v["mismatches"].as_array().unwrap().is_empty()).count(), skipped.len()
    );
}

fn write_out(results: &[Value], skipped: &[Value], scanned: u64, done: bool) {
    let matched = results.iter().filter(|v| v["mismatches"].as_array().unwrap().is_empty()).count();
    fs::write(format!("{}/ac2_reverts.json", out_dir("ac2_reverts")), serde_json::to_string_pretty(&json!({
        "done": done, "matched": matched, "total": results.len(), "scanned_blocks": scanned,
        "skipped": skipped, "results": results})).unwrap()).unwrap();
}

/// Replay txs[idx] of block B: B−1 state (MPT-verified), B's pre-execution changes, txs[0..idx]
/// committed in order, then txs[idx] compared with its receipt.
fn replay_at(rpc: &Rpc, blk: &BlockRef, txs: &[Value], rcs: &[Value], idx: usize) -> Result<Value, String> {
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
    let tx0 = &txs[idx];
    let txh: B256 = hp(&tx0["hash"]);
    // raw txs 0..=idx, the target's receipt, the block's prestate (hint only) and the target's call trace
    // (separate small requests: the node answers HTTP 413 to large batches)
    let raws: Vec<Result<Value, Value>> = (0..=idx).map(|i| rpc.call("eth_getRawTransactionByHash", json!([txs[i]["hash"]]))).collect();
    let pre_block = rpc.call("debug_traceBlockByNumber", json!([hx(b), {"tracer": "prestateTracer"}]));
    let call_trace = rpc.call("debug_traceTransaction", json!([txh, {"tracer": "callTracer"}]));
    let receipt_of = |h: &Value| rcs.iter().find(|r| &r["transactionHash"] == h).cloned().ok_or_else(|| format!("no receipt for {h}"));
    let receipt = receipt_of(&tx0["hash"])?;
    let mut envs = vec![];
    for i in 0..=idx {
        let raw: Bytes = hp(raws[i].as_ref().map_err(|e| format!("raw tx {i}: {e}"))?);
        let env = TempoTxEnvelope::decode_2718(&mut raw.as_ref()).map_err(|e| format!("decode tx {i}: {e}"))?;
        let sender = env.recover_signer().map_err(|e| format!("recover tx {i}: {e}"))?;
        let from: Address = hp(&txs[i]["from"]);
        if sender != from {
            return Err(format!("tx {i}: recovered sender {sender} != rpc from {from}"));
        }
        envs.push(TempoTxEnv::from_encoded_tx(&env, sender, raw.clone()));
    }
    let tx_env = envs[idx].clone();
    let from: Address = hp(&tx0["from"]);
    let fee_payer = tx_env.fee_payer().map_err(|e| format!("{e:?}"))?;

    // ---- prestate = state after B−1, MPT-verified; hint = union of prestates of txs 0..=idx
    let mut lazy = LazyDb::new(rpc.clone(), b - 1, hp_.inner.state_root);
    if let Ok(pre) = &pre_block {
        let mut hint: BTreeMap<Address, Vec<U256>> = BTreeMap::new();
        for item in pre.as_array().into_iter().flatten().take(idx + 1) {
            for (a, s) in prestate_hint(&item["result"]) {
                hint.entry(a).or_default().extend(s);
            }
        }
        // one account per request and ≤ 32 slots of it (larger JSON-RPC batches get HTTP 413);
        // anything not prefetched is read lazily, with the same MPT verification
        for (a, mut slots) in hint {
            slots.sort();
            slots.dedup();
            slots.truncate(32);
            lazy.prefetch(&BTreeMap::from([(a, slots)])).map_err(|e| e.to_string())?;
        }
    }
    let tracked = Tracked::new(lazy);
    let fault = tracked.fault.clone();
    let mut state = State::builder().with_database(tracked).build();
    let block = block_env(&hb);
    let mut cfg = cfg_env(spec, true);
    cfg.disable_eip3607 = false;
    cfg.disable_block_gas_limit = false;

    // ---- B's pre-execution changes (same as AC-2)
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
    let mut mm: Vec<String> = vec![];
    // ---- earlier txs of B, committed in order; each checked against its own receipt (status, gas)
    for (i, env) in envs[..idx].iter().enumerate() {
        let out = spike_core::transact(&mut state, cfg.clone(), block.clone(), env.clone());
        if let Some(a) = fault.borrow().clone() {
            return Err(format!("witness fault in prior tx {i}: {a}"));
        }
        let out = out.map_err(|e| format!("prior tx {i} rejected: {e:?}"))?;
        let rc = receipt_of(&txs[i]["hash"])?;
        let (ps, pg) = (out.result.is_success(), out.result.tx_gas_used());
        if ps != (hu(&rc["status"]) == 1) || pg != hu(&rc["gasUsed"]) {
            mm.push(format!("prior tx {i} {}: ours status={ps} gas={pg}, receipt status={} gas={}", txs[i]["hash"], hu(&rc["status"]), hu(&rc["gasUsed"])));
        }
        state.commit(out.state);
    }
    // ---- the reverted tx
    let base_fee = hb.inner.base_fee_per_gas.unwrap_or_default();
    let eff_price = tx_env.effective_gas_price(base_fee as u128);
    let out = spike_core::transact(&mut state, cfg.clone(), block.clone(), tx_env.clone());
    if let Some(a) = fault.borrow().clone() {
        return Err(format!("witness fault: {a}"));
    }
    let out = out.map_err(|e| format!("tx rejected: {e:?}"))?;
    let replay_ms = t0.elapsed().as_millis() as u64;
    let (ok, logs, reason, revert_data) = match &out.result {
        ExecutionResult::Success { logs, .. } => (true, logs.clone(), "success".to_string(), None),
        ExecutionResult::Revert { logs, output, .. } => {
            let sel = if output.len() >= 4 { format!("0x{}", alloy_primitives::hex::encode(&output[..4])) } else { "empty".into() };
            (false, logs.clone(), format!("revert {sel} ({} bytes)", output.len()), Some(output.clone()))
        }
        ExecutionResult::Halt { logs, reason, .. } => (false, logs.clone(), format!("halt {reason:?}"), None),
    };
    let gas = out.result.tx_gas_used();
    let r_status = hu(&receipt["status"]) == 1;
    if ok != r_status {
        mm.push(format!("status ours={ok} receipt={r_status}"));
    }
    let r_gas = hu(&receipt["gasUsed"]);
    if gas != r_gas {
        mm.push(format!("gasUsed ours={gas} receipt={r_gas}"));
    }
    let r_logs = receipt["logs"].as_array().unwrap();
    let ours: Vec<(Address, Vec<B256>, Bytes)> = logs.iter().map(|l| (l.address, l.topics().to_vec(), l.data.data.clone())).collect();
    let theirs: Vec<(Address, Vec<B256>, Bytes)> = r_logs
        .iter()
        .map(|l| (hp(&l["address"]), l["topics"].as_array().unwrap().iter().map(hp).collect(), hp(&l["data"])))
        .collect();
    if ours != theirs {
        mm.push(format!("logs differ: ours {} receipt {}", ours.len(), theirs.len()));
    }
    // revert reason vs the node's own call trace
    let trace = call_trace.as_ref().ok().cloned().unwrap_or(Value::Null);
    let t_err = trace["error"].as_str().unwrap_or("").to_string();
    let t_out: Bytes = trace.get("output").filter(|v| !v.is_null()).map(hp).unwrap_or_default();
    match (&revert_data, out.result.is_halt()) {
        (Some(d), _) if trace.is_object() && *d != t_out => mm.push(format!("revert data ours={d} trace={t_out}")),
        (_, true) if trace.is_object() && t_err.is_empty() => mm.push("ours halted, trace reports no error".into()),
        _ => {}
    }
    // fee token + fee charged
    let r_fee_token: Address = hp(&receipt["feeToken"]);
    let r_eff: u128 = hu(&receipt["effectiveGasPrice"]) as u128;
    let r_fee = calc_gas_balance_spending(r_gas, r_eff);
    let fee_log = logs.iter().find(|l| {
        l.topics().len() == 3 && l.topics()[0] == TRANSFER_TOPIC && l.topics()[1] == fee_payer.into_word() && l.topics()[2] == FEE_MANAGER.into_word()
    });
    let (our_fee_token, our_fee_logged) = fee_log.map(|l| (l.address, U256::from_be_slice(&l.data.data))).unwrap_or_default();
    let our_fee = calc_gas_balance_spending(gas, eff_price);
    if our_fee_token != r_fee_token {
        mm.push(format!("feeToken ours={our_fee_token} receipt={r_fee_token}"));
    }
    if our_fee != r_fee || our_fee_logged != r_fee || eff_price != r_eff {
        mm.push(format!("fee ours(calc)={our_fee} ours(log)={our_fee_logged} receipt={r_fee} effPrice ours={eff_price} receipt={r_eff}"));
    }
    // post balances at B — only owners no later tx in B names (else not attributable to this tx)
    let mut checks: BTreeSet<(Address, Address)> = BTreeSet::new();
    checks.insert((r_fee_token, fee_payer));
    let transfer = tip20_transfer_of(tx0);
    if let Some((token, data)) = &transfer {
        checks.insert((*token, from));
        checks.insert((*token, decode_receiver(data)));
    }
    let later: Vec<String> = txs[idx + 1..].iter().map(|t| t.to_string().to_lowercase()).collect();
    let mut post_report = vec![];
    let mut not_attributable = vec![];
    for (tk, who) in checks {
        let needle = format!("{who:x}");
        if later.iter().any(|s| s.contains(needle.trim_start_matches("0x"))) {
            not_attributable.push(json!({"token": tk, "owner": who}));
            continue;
        }
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
    Ok(json!({"block": b, "index": idx, "priorTxs": idx, "tx": txh, "type": tx0["type"], "from": from, "feePayer": fee_payer,
        "gasLimit": hu(&tx0["gas"]), "transfer": transfer.as_ref().map(|(t, d)| json!({"token": t, "receiver": decode_receiver(d)})),
        "status": ok, "reason": reason, "traceError": t_err, "gasUsed": gas, "fee": our_fee.to_string(), "feeToken": our_fee_token,
        "witness_accounts": lazy.accounts.len(), "witness_slots": lazy.slot_count(), "replay_ms": replay_ms,
        "post": post_report, "postNotAttributable": not_attributable, "mismatches": mm}))
}
