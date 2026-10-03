//! Runs the Sworn guest ELF in SP1: execute (cycles) or prove.
//! Usage: spike-runner <elf> <input.bin> execute|core|compressed|groth16 [fixture_out.json]
//! `<input.bin>.expected` holds the publicValues the native host computed (guest must equal it).
use sp1_sdk::{blocking::{ProveRequest, Prover, ProverClient}, HashableKey, ProvingKey, SP1Stdin};
use std::time::Instant;

fn hex(b: &[u8]) -> String {
    format!("0x{}", b.iter().map(|x| format!("{x:02x}")).collect::<String>())
}

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
    println!("publicValues match native host: {}", if ok { "PASS" } else { "FAIL" });
    assert!(ok);
    let t = Instant::now();
    let pk = client.setup(elf.as_slice().into()).expect("setup");
    println!("setup wall: {:?}", t.elapsed());
    let vkey = pk.verifying_key().bytes32();
    println!("vkey(bytes32): {vkey}");
    if mode == "execute" {
        return;
    }
    let t = Instant::now();
    let proof = match mode {
        "core" => client.prove(&pk, stdin).core().run(),
        "compressed" => client.prove(&pk, stdin).compressed().run(),
        "groth16" => client.prove(&pk, stdin).groth16().run(),
        _ => panic!("mode"),
    }
    .expect("prove");
    let wall = t.elapsed();
    println!("PROVE {mode} wall: {wall:?}");
    let pv_ok = proof.public_values.as_slice() == expected.as_slice();
    println!("proof pv match: {pv_ok}");
    let t = Instant::now();
    client.verify(&proof, pk.verifying_key(), None).expect("verify");
    println!("verify ok ({:?})", t.elapsed());
    if let Some(out) = a.get(4) {
        let j = format!(
            "{{\n \"vkey\": \"{vkey}\",\n \"publicValues\": \"{}\",\n \"proof\": \"{}\",\n \"mode\": \"{mode}\",\n \"prove_wall_secs\": {},\n \"sp1_sdk\": \"6.3.1\"\n}}\n",
            hex(proof.public_values.as_slice()),
            hex(&proof.bytes()),
            wall.as_secs_f64()
        );
        std::fs::write(out, j).unwrap();
        println!("fixture written: {out}");
    }
}
