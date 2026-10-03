//! sworn-answer — the server's answering code (spec 002 §1).
//!
//!   echo '{"from":..,"token":..,"receiver":..,"amount":"500000000","memo":null,"feeToken":..,"gasLimit":"300000"}' \
//!     | sworn-answer [--lie receiverAfter]
//!
//! At the latest block N: build the R3.2 Question, apply R3.3 (refuse), check the LIVE fork
//! schedule against the guest's (R3.7; refuse on mismatch or an activation within MAX_AGE of N),
//! execute fees-on over an RPC-backed, MPT-verified lazy DB and replay the captured witness through
//! the guest path natively (an honest answer is therefore provable at N), and print
//! `{ok, question, answer, mode, ...}`.
//!
//! `--lie receiverAfter` is FOR THE DISHONEST DEMO ONLY: the printed answer claims the receiver is
//! credited `amount` (or, if that is the truth, nothing). The output says so (`mode`, `lie`).
//! Env: SWORN_RPC_URL. Exit: 0 ok, 3 refused, 1 error.
use alloy_primitives::{Address, B256};
use alloy_sol_types::SolCall;
use serde_json::{Value, json};
use spike_core::{MODERATO_CHAIN_ID, Question, bind_header, check_question, transferCall, transferWithMemoCall};
use sworn_answerer::*;
use sworn_challenger::{rpc::*, *};
use std::time::{Duration, Instant};

enum Fail {
    Refused(String),
    Error(String),
}
impl From<String> for Fail {
    fn from(e: String) -> Self {
        Fail::Error(e)
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let lie = match args.iter().position(|a| a == "--lie") {
        Some(i) => match args.get(i + 1).map(String::as_str) {
            Some("receiverAfter") => true,
            other => {
                println!("{}", json!({"ok": false, "error": format!("--lie supports only receiverAfter, got {other:?}")}));
                std::process::exit(1)
            }
        },
        None => false,
    };
    let t0 = Instant::now();
    match answer(lie, t0) {
        Ok(v) => println!("{v}"),
        Err(Fail::Refused(r)) => {
            println!("{}", json!({"ok": false, "refused": true, "reason": r}));
            std::process::exit(3)
        }
        Err(Fail::Error(e)) => {
            println!("{}", json!({"ok": false, "error": e}));
            std::process::exit(1)
        }
    }
}

fn answer(lie: bool, t0: Instant) -> Result<Value, Fail> {
    let req = read_json("-")?;
    let from: Address = jparse(&req, "from")?;
    let token: Address = jparse(&req, "token")?;
    let receiver: Address = jparse(&req, "receiver")?;
    let amount = ju256(&req, "amount")?;
    let fee_token: Address = jparse(&req, "feeToken")?;
    let gas_limit = if req.get("gasLimit").is_some_and(|v| !v.is_null()) { ju64(&req, "gasLimit")? } else { 300_000 };
    let data = match req.get("memo").filter(|m| !m.is_null()) {
        Some(_) => transferWithMemoCall { to: receiver, amount, memo: jparse::<B256>(&req, "memo")? }.abi_encode(),
        None => transferCall { to: receiver, amount }.abi_encode(),
    };

    let rpc = Rpc::new(&rpc_url_from_env()).with_deadline(t0 + Duration::from_secs(60));
    let chain = hu(&rpc.req("eth_chainId", json!([]))?)?;
    if chain != MODERATO_CHAIN_ID {
        return Err(Fail::Refused(format!("RPC chain id {chain} != {MODERATO_CHAIN_ID} (the guest answers only about Moderato-config chains)")));
    }
    let n = rpc.block_number()?;
    let blk = fetch_block(&rpc, n)?;
    let header = bind_header(&blk.raw_header, blk.hash).map_err(|e| format!("header: {e}"))?;
    let q = Question {
        chainId: MODERATO_CHAIN_ID,
        blockNumber: n,
        blockHash: blk.hash,
        from,
        token,
        data: data.into(),
        feeToken: fee_token,
        gasLimit: gas_limit,
    };
    // R3.3 (the state-free part; the rest are witness/proof properties checked by `capture`).
    check_question(&q).map_err(|e| Fail::Refused(format!("R3.3: {e}")))?;
    // R3.7 live hardfork drift.
    let live = parse_live_schedule(&rpc.req("tempo_forkSchedule", json!([]))?)?;
    let ts = header.inner.timestamp;
    check_fork_schedule(&live, ts).map_err(Fail::Refused)?;

    // Execute + capture + guest replay (fees on).
    let c = capture(&rpc, &q).map_err(|e| if e.starts_with("abort") { Fail::Refused(e) } else { Fail::Error(e) })?;
    let truth = c.answer.clone();
    let mut a = truth.clone();
    let mut lie_note = Value::Null;
    if lie {
        let credited = truth.receiverBefore + amount;
        a.receiverAfter = if truth.receiverAfter != credited { credited } else { truth.receiverBefore };
        // A lie that happens to equal the truth would be no lie: guaranteed different here.
        assert_ne!(a.receiverAfter, truth.receiverAfter);
        lie_note = json!({"field": "receiverAfter", "claimed": a.receiverAfter.to_string(),
            "true": truth.receiverAfter.to_string(),
            "note": "DISHONEST DEMO: this answer is deliberately wrong so that it can be challenged"});
    }
    Ok(json!({
        "ok": true,
        "mode": if lie { "dishonest-demo" } else { "honest" },
        "question": question_json(&q),
        "answer": answer_json(&a),
        "lie": lie_note,
        "invalid": c.invalid,
        "blockTimestamp": ts.to_string(),
        "forkSchedule": {"checked": live.len(), "activationGuardSecs": ACTIVATION_GUARD_SECS},
        "witness": {"accounts": c.accounts, "slots": c.slots, "rpcCalls": c.rpc_calls},
        "elapsedMs": t0.elapsed().as_millis() as u64,
    }))
}
