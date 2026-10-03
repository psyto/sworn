//! sworn-witness — capture the witness for (q, N) the moment a reservation is seen (spec 001 R3.5,
//! spec 002 §3.5). The public RPC keeps proofs ~250 blocks (~150 s); this must finish well inside.
//!
//!   sworn-witness --in <response.json | question.json | -> --out <witness.json> [--deadline-secs 120]
//!
//! `--in` is the §2 server response (its `.question` is used) or a bare Question JSON.
//! Env: SWORN_RPC_URL (default Moderato public RPC).
//! stdout: one JSON line `{ok, out, elapsedMs, trueAnswer, ...}`; on failure `{ok:false, error}`
//! and exit 1 — the SDK then reports the answer as UNPROTECTED.
use serde_json::json;
use sworn_challenger::{rpc::*, *};
use std::time::{Duration, Instant};

fn arg(args: &[String], k: &str) -> Option<String> {
    args.iter().position(|a| a == k).and_then(|i| args.get(i + 1).cloned())
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let t0 = Instant::now();
    let r = (|| -> Result<serde_json::Value, String> {
        let inp = arg(&args, "--in").ok_or("usage: sworn-witness --in <file|-> --out <witness.json> [--deadline-secs N]")?;
        let out = arg(&args, "--out").ok_or("--out required")?;
        let deadline = arg(&args, "--deadline-secs").map(|s| s.parse::<u64>().map_err(|e| e.to_string())).transpose()?.unwrap_or(120);
        let v = read_json(&inp)?;
        let qv = if v.get("question").is_some() { &v["question"] } else { &v };
        let q = parse_question(qv)?;
        let url = rpc_url_from_env();
        let rpc = Rpc::new(&url).with_deadline(t0 + Duration::from_secs(deadline));
        let c = capture(&rpc, &q)?;
        let elapsed = t0.elapsed();
        let latest = rpc.block_number().unwrap_or(0);
        let doc = json!({
            "kind": "sworn-witness-v1",
            "rpc": url,
            "question": question_json(&q),
            "trueAnswer": answer_json(&c.answer),
            "invalid": c.invalid,
            "publicValues": hexb(&c.public_values),
            "accounts": c.accounts, "slots": c.slots, "rpcCalls": c.rpc_calls,
            "elapsedMs": elapsed.as_millis() as u64,
            "capturedAtLatestBlock": latest.to_string(),
            "input": serde_json::to_value(&c.input).map_err(|e| e.to_string())?,
        });
        std::fs::write(&out, serde_json::to_string_pretty(&doc).unwrap()).map_err(|e| format!("{out}: {e}"))?;
        Ok(json!({
            "ok": true, "out": out, "elapsedMs": elapsed.as_millis() as u64,
            "blockNumber": q.blockNumber.to_string(), "blocksBehindAtEnd": latest.saturating_sub(q.blockNumber),
            "accounts": c.accounts, "slots": c.slots, "rpcCalls": c.rpc_calls,
            "trueAnswer": answer_json(&c.answer), "invalid": c.invalid,
        }))
    })();
    match r {
        Ok(v) => println!("{v}"),
        Err(e) => {
            println!("{}", json!({"ok": false, "error": e, "elapsedMs": t0.elapsed().as_millis() as u64}));
            std::process::exit(1);
        }
    }
}
