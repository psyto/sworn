//! Host: witness JSON -> Input; run spike-core natively; compare with RPC eth_call (Gate H).
//! Usage: spike-host <witness.json> <out_input.bin>
use alloy_primitives::{Address, B256, Bytes, U256};
use serde_json::Value;
use spike_core::*;
use std::str::FromStr;

fn h<T: FromStr>(v: &Value) -> T where T::Err: std::fmt::Debug { T::from_str(v.as_str().unwrap()).unwrap() }
fn u(v: &Value) -> U256 { U256::from_str_radix(v.as_str().unwrap().trim_start_matches("0x"), 16).unwrap() }
fn bytes_list(v: &Value) -> Vec<Bytes> { v.as_array().unwrap().iter().map(h::<Bytes>).collect() }

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let w: Value = serde_json::from_str(&std::fs::read_to_string(&args[1]).unwrap()).unwrap();
    let accounts = w["accounts"].as_array().unwrap().iter().map(|a| {
        let p = &a["proof"];
        AccountWitness {
            address: h(&a["address"]),
            nonce: u(&p["nonce"]).to(),
            balance: u(&p["balance"]),
            storage_root: h(&p["storageHash"]),
            code_hash: h(&p["codeHash"]),
            code: h(&a["code"]),
            account_proof: bytes_list(&p["accountProof"]),
            storage: p["storageProof"].as_array().unwrap().iter().map(|s| StorageWitness {
                slot: u(&s["key"]), value: u(&s["value"]), proof: bytes_list(&s["proof"]),
            }).collect(),
        }
    }).collect::<Vec<_>>();
    let caller: Address = h(&w["call"]["from"]);
    let nonce = accounts.iter().find(|a| a.address == caller).map(|a| a.nonce).unwrap_or(0);
    let input = Input {
        nonce,
        block_hash: h(&w["block_hash"]),
        raw_header: h(&w["raw_header"]),
        accounts,
        caller: h::<Address>(&w["call"]["from"]),
        to: h(&w["call"]["to"]),
        data: h(&w["call"]["data"]),
        gas_limit: 16_000_000,
    };
    let enc = bincode::serialize(&input).unwrap();
    let nslots: usize = input.accounts.iter().map(|a| a.storage.len()).sum();
    let proof_bytes: usize = input.accounts.iter().map(|a| a.account_proof.iter().map(|n| n.len()).sum::<usize>()
        + a.storage.iter().map(|s| s.proof.iter().map(|n| n.len()).sum::<usize>()).sum::<usize>()).sum();
    println!("witness: accounts={} slots={} proof_node_bytes={} input_bincode_bytes={}", input.accounts.len(), nslots, proof_bytes, enc.len());
    std::fs::write(&args[2], &enc).unwrap();
    let t = std::time::Instant::now();
    let out = run(&input);
    println!("native run: {:?}", t.elapsed());
    std::fs::write(format!("{}.expected", &args[2]), bincode::serialize(&out).unwrap()).unwrap();
    println!("output: {out:#?}");
    let r = &w["rpc_eth_call_result"];
    let (rpc_ok, rpc): (bool, Bytes) = if r.is_string() { (true, h(r)) } else { (false, h(&r["revert"]["data"])) };
    println!("rpc success  : {rpc_ok}");
    let _: B256 = input.block_hash;
    println!("rpc eth_call : {rpc}");
    println!("tempo-revm   : {}", out.output);
    if out.success == rpc_ok && out.output == rpc { println!("GATE H: PASS (identical)"); } else { println!("GATE H: FAIL"); std::process::exit(1); }
}
