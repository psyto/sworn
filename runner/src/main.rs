//! Runs the tempo-spike guest ELF in SP1: execute (cycles) or prove.
//! Usage: spike-runner <elf> <input.bin> execute|core|compressed|groth16
use sp1_sdk::{blocking::{ProveRequest, Prover, ProverClient}, ProvingKey, SP1Stdin};
use std::time::Instant;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let elf = std::fs::read(&a[1]).unwrap();
    let input = std::fs::read(&a[2]).unwrap();
    let expected = std::fs::read(format!("{}.expected", &a[2])).unwrap();
    let mode = a[3].as_str();
    let mut stdin = SP1Stdin::new();
    stdin.write_slice(&input);
    let t0 = Instant::now();
    let client = ProverClient::from_env();
    println!("client init wall: {:?}", t0.elapsed());
    let t = Instant::now();
    let (pv, report) = client.execute(elf.as_slice().into(), stdin.clone()).run().expect("execute");
    println!("execute wall: {:?}", t.elapsed());
    println!("cycles(total_instruction_count): {}", report.total_instruction_count());
    println!("report: {report}");
    let ok = pv.as_slice() == expected.as_slice();
    println!("GATE C output match vs native: {}", if ok { "PASS" } else { "FAIL" });
    if mode == "execute" { return; }
    let t = Instant::now();
    let pk = client.setup(elf.as_slice().into()).expect("setup");
    println!("setup wall: {:?}", t.elapsed());
    let t = Instant::now();
    let proof = match mode {
        "core" => client.prove(&pk, stdin).core().run(),
        "compressed" => client.prove(&pk, stdin).compressed().run(),
        "groth16" => client.prove(&pk, stdin).groth16().run(),
        _ => panic!("mode"),
    }.expect("prove");
    println!("PROVE {mode} wall: {:?}", t.elapsed());
    println!("proof pv match: {}", proof.public_values.as_slice() == expected.as_slice());
    let t = Instant::now();
    client.verify(&proof, pk.verifying_key(), None).expect("verify");
    println!("verify ok ({:?})", t.elapsed());
}
