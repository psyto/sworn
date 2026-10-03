//! sworn-challenge — prove the true answer locally with SP1 (Groth16) and send
//! `challenge(server, q, a, publicValues, proof)` signed with SWORN_CHALLENGER_KEY (spec 002 §1).
//!
//!   sworn-challenge --witness <witness.json> --response <response.json>
//!                   [--proof-out <proof.json>] [--proof <existing proof.json>] [--dry-run]
//!
//! `--response` is the §2 server response: `question`, `answer` (the CLAIMED answer), `server`,
//! `sworn`. The witness must be for the same question. Proving reuses `runner/` (spike-runner,
//! SP1 SDK 6.3.1, ≈6.5 min, ~15 GB RAM): it executes the guest ELF, checks the publicValues equal
//! the native replay, proves Groth16 and verifies the proof before anything is sent.
//! Before sending, the call is simulated; a revert is reported by its Sworn error name (e.g.
//! `AnswerCorrect`) and NOTHING is sent (exit 2).
//! Env: SWORN_RPC_URL, SWORN_CHALLENGER_KEY, SWORN_RUNNER, SWORN_GUEST_ELF.
use alloy_primitives::{Address, Bytes};
use serde_json::{Value, json};
use spike_core::{Input, run};
use sworn_challenger::{rpc::*, *};
use std::{process::Command, time::Instant};

fn arg(args: &[String], k: &str) -> Option<String> {
    args.iter().position(|a| a == k).and_then(|i| args.get(i + 1).cloned())
}
fn repo() -> String {
    format!("{}/..", env!("CARGO_MANIFEST_DIR"))
}

fn fields_differing(t: &spike_core::Answer, c: &spike_core::Answer) -> Vec<&'static str> {
    let mut v = vec![];
    if t.success != c.success { v.push("success") }
    if t.returnDataHash != c.returnDataHash { v.push("returnDataHash") }
    if t.gasUsed != c.gasUsed { v.push("gasUsed") }
    if t.feeCharged != c.feeCharged { v.push("feeCharged") }
    if t.receiver != c.receiver { v.push("receiver") }
    if t.receiverBefore != c.receiverBefore { v.push("receiverBefore") }
    if t.receiverAfter != c.receiverAfter { v.push("receiverAfter") }
    v
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let r = (|| -> Result<(Value, i32), String> {
        let wp = arg(&args, "--witness").ok_or("usage: sworn-challenge --witness <w.json> --response <resp.json> [--proof-out p.json] [--proof p.json] [--dry-run]")?;
        let rp = arg(&args, "--response").ok_or("--response required")?;
        let w = read_json(&wp)?;
        let resp = read_json(&rp)?;
        let q = parse_question(&resp["question"])?;
        let claimed = parse_answer(&resp["answer"])?;
        let server: Address = jparse(&resp, "server")?;
        let sworn: Address = jparse(&resp, "sworn")?;
        if parse_question(&w["question"])? != q {
            return Err("witness is for a different question than the response".into());
        }
        let input: Input = serde_json::from_value(w["input"].clone()).map_err(|e| format!("witness input: {e}"))?;
        // The guest path, natively, on exactly the bytes we will prove.
        let (pv, pq, truth) = run(&input).map_err(|e| format!("guest aborts on this witness (no proof possible): {e}"))?;
        if pq != q {
            return Err("witness input question != response question".into());
        }
        let differ = fields_differing(&truth, &claimed);
        eprintln!("[sworn-challenge] true answer: {}", answer_json(&truth));
        eprintln!("[sworn-challenge] claimed:     {}", answer_json(&claimed));
        eprintln!("[sworn-challenge] fields that differ: {differ:?}");

        // ---- proof
        let t0 = Instant::now();
        let proof_path = match arg(&args, "--proof") {
            Some(p) => p,
            None => {
                let out = arg(&args, "--proof-out").unwrap_or_else(|| format!("{wp}.proof.json"));
                let bin = format!("{out}.input.bin");
                std::fs::write(&bin, bincode::serialize(&input).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
                std::fs::write(format!("{bin}.expected"), &pv).map_err(|e| e.to_string())?;
                let runner = std::env::var("SWORN_RUNNER").unwrap_or_else(|_| format!("{}/runner/target/release/spike-runner", repo()));
                let elf = std::env::var("SWORN_GUEST_ELF").unwrap_or_else(|_| {
                    format!("{}/program/target/elf-compilation/riscv64im-succinct-zkvm-elf/release/tempo-spike-guest", repo())
                });
                eprintln!("[sworn-challenge] proving Groth16 locally: {runner} {elf} {bin} groth16 {out}");
                let st = Command::new(&runner).args([&elf, &bin, "groth16", &out]).stdout(std::io::stderr()).status().map_err(|e| format!("{runner}: {e}"))?;
                if !st.success() {
                    return Err(format!("prover failed: {st}"));
                }
                out
            }
        };
        let prove_secs = t0.elapsed().as_secs_f64();
        let fx = read_json(&proof_path)?;
        let ppv: Bytes = jparse(&fx, "publicValues")?;
        let proof: Bytes = jparse(&fx, "proof")?;
        if ppv.as_ref() != pv.as_slice() {
            return Err("proof publicValues != native replay of the witness".into());
        }
        let data = challenge_calldata(server, &q, &claimed, &pv, &proof);
        let rpc = Rpc::new(&rpc_url_from_env());
        let base = json!({"proof": proof_path, "proveWallSecs": prove_secs, "fieldsDiffering": differ,
            "trueAnswer": answer_json(&truth), "vkey": fx["vkey"]});
        if args.iter().any(|a| a == "--dry-run") {
            let from = signer_from_env("SWORN_CHALLENGER_KEY").map(|s| s.address()).unwrap_or(Address::ZERO);
            let res = rpc.call("eth_call", json!([{"from": from, "to": sworn, "data": hexb(&data)}, "latest"]));
            let mut out = base;
            out["dryRun"] = match &res {
                Ok(_) => json!({"reverted": false}),
                Err(e) => json!({"reverted": true, "error": revert_data(e).map(|d| decode_error(&d)).unwrap_or(e.to_string())}),
            };
            eprintln!("[sworn-challenge] dry-run (eth_call only, nothing sent): {}", out["dryRun"]);
            return Ok((out, if res.is_ok() { 0 } else { 2 }));
        }
        let signer = signer_from_env("SWORN_CHALLENGER_KEY")?;
        eprintln!("[sworn-challenge] submitting challenge to {sworn} from {}", signer.address());
        match send_call(&rpc, &signer, sworn, data) {
            Ok(s) => {
                let status = s.receipt["status"].as_str().unwrap_or("?").to_string();
                let slashed_topic = alloy_primitives::keccak256("Slashed(address,bytes32,address,uint256)");
                let slashed = s.receipt["logs"].as_array().map(|l| {
                    l.iter().any(|x| x["topics"][0].as_str().is_some_and(|t| t.parse::<alloy_primitives::B256>().ok() == Some(slashed_topic)))
                }).unwrap_or(false);
                let mut out = base;
                out["ok"] = json!(status == "0x1");
                out["txHash"] = json!(s.hash);
                out["status"] = json!(status);
                out["gasUsed"] = s.receipt["gasUsed"].clone();
                out["slashedEvent"] = json!(slashed);
                out["challenger"] = json!(signer.address());
                Ok((out, if status == "0x1" { 0 } else { 1 }))
            }
            Err(e) => {
                let mut out = base;
                out["ok"] = json!(false);
                out["error"] = json!(e);
                Ok((out, 2))
            }
        }
    })();
    match r {
        Ok((v, code)) => {
            println!("{v}");
            std::process::exit(code)
        }
        Err(e) => {
            println!("{}", json!({"ok": false, "error": e}));
            std::process::exit(1);
        }
    }
}
