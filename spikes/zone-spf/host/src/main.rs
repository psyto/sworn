//! Spec 003 native host. Every digest/public-values computation here goes through
//! `sworn_zone_attest::execute` — the same function the SP1 guest calls.
//!
//!   sworn-zone-host extract-genesis <case.json> <out.genesis.json>
//!       Write the exact bytes of the case's `genesis` JSON value (the pinned artifact).
//!   sworn-zone-host input <case.json> <genesis.json> <verifier> <dest-chain-id> <out.bin> [summary.json]
//!       Frame the guest input, run it natively, write <out.bin>, <out.bin>.expected (the 64 public-value
//!       bytes the guest must commit) and an optional summary (attestation fields, digest, verify args).
//!       If the native run rejects, <out.bin>.expected holds the marker `NATIVE-REJECTED` and exit is 3.
//!   sworn-zone-host mutations <case.json> <genesis.json> <verifier> <dest-chain-id> <zkvm-out.bin>
//!       AC-Z1: the six PublicInputs mutations (each must be rejected by prove_zone_batch), the
//!       one-genesis-byte change (must change genesisArtifactHash and the digest), a wrong
//!       verifier_config. Writes the expected_withdrawal_batch_index mutation as a zkVM input.
//!   sworn-zone-host golden <out.json>
//!       AC-Z2: write the golden vector shared with Solidity.
use alloy_primitives::{Address, hex};
use serde::Deserialize;
use serde_json::{json, value::RawValue};
use sworn_zone_attest as za;

#[derive(Deserialize)]
struct Case<'a> {
    #[serde(borrow)]
    genesis: &'a RawValue,
    #[serde(borrow)]
    witness: &'a RawValue,
}

fn read(p: &str) -> Vec<u8> {
    std::fs::read(p).unwrap_or_else(|e| panic!("read {p}: {e}"))
}

fn h(b: &[u8]) -> String {
    format!("0x{}", hex::encode(b))
}

fn witness_json(case_bytes: &[u8]) -> Vec<u8> {
    let case: Case = serde_json::from_slice(case_bytes).expect("case json");
    case.witness.get().as_bytes().to_vec()
}

fn frame(genesis: &[u8], witness: &[u8], verifier: Address, cfg: &[u8], chain: u64) -> Vec<u8> {
    za::encode_input(genesis, witness, verifier, cfg, chain)
}

fn run_framed(bytes: &[u8]) -> Result<za::Outcome, za::Error> {
    za::execute(za::decode_input(bytes)?)
}

fn summary(o: &za::Outcome, verifier: Address, chain: u64) -> serde_json::Value {
    let a = &o.attestation;
    json!({
        "typehash": format!("{:#x}", za::TYPEHASH),
        "zoneGuestVersion": format!("{:#x}", za::ZONE_GUEST_VERSION),
        "verifier": format!("{verifier:#x}"),
        "destinationChainId": chain,
        "parentChainId": a.parentChainId.to::<u64>(),
        "genesisArtifactHash": format!("{:#x}", o.genesis_artifact_hash),
        "verifierConfig": h(za::ZK_VERIFIER_CONFIG_V1),
        "verifierConfigHash": format!("{:#x}", a.verifierConfigHash),
        "digest": format!("{:#x}", o.digest),
        "publicValues": h(&o.public_values),
        "args": {
            "zoneId": a.zoneId,
            "tempoBlockNumber": a.tempoBlockNumber,
            "anchorBlockNumber": a.anchorBlockNumber,
            "anchorBlockHash": format!("{:#x}", a.anchorBlockHash),
            "expectedWithdrawalBatchIndex": a.expectedWithdrawalBatchIndex,
            "nextZoneHeight": a.nextZoneHeight.to::<u64>(),
            "prevBlockHash": format!("{:#x}", a.prevBlockHash),
            "nextBlockHash": format!("{:#x}", a.nextBlockHash),
            "prevProcessedHash": format!("{:#x}", a.prevProcessedHash),
            "nextProcessedHash": format!("{:#x}", a.nextProcessedHash),
            "prevDepositNumber": a.prevDepositNumber,
            "nextDepositNumber": a.nextDepositNumber,
            "prevProcessedTokenCount": a.prevProcessedTokenCount,
            "nextProcessedTokenCount": a.nextProcessedTokenCount,
            "withdrawalQueueHash": format!("{:#x}", a.withdrawalQueueHash),
        }
    })
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    match a.get(1).map(String::as_str) {
        Some("extract-genesis") => {
            let case_bytes = read(&a[2]);
            let case: Case = serde_json::from_slice(&case_bytes).expect("case json");
            let g = case.genesis.get().as_bytes();
            std::fs::write(&a[3], g).unwrap();
            println!("genesis artifact: {} bytes, keccak256 {:#x}", g.len(), alloy_primitives::keccak256(g));
        }
        Some("input") => {
            let witness = witness_json(&read(&a[2]));
            let genesis = read(&a[3]);
            let verifier: Address = a[4].parse().expect("verifier address");
            let chain: u64 = a[5].parse().expect("chain id");
            let out = &a[6];
            let bytes = frame(&genesis, &witness, verifier, za::ZK_VERIFIER_CONFIG_V1, chain);
            std::fs::write(out, &bytes).unwrap();
            let t = std::time::Instant::now();
            match run_framed(&bytes) {
                Ok(o) => {
                    println!("native execute wall: {:?}", t.elapsed());
                    std::fs::write(format!("{out}.expected"), o.public_values).unwrap();
                    let s = summary(&o, verifier, chain);
                    println!("{}", serde_json::to_string_pretty(&s).unwrap());
                    if let Some(p) = a.get(7) {
                        std::fs::write(p, serde_json::to_string_pretty(&s).unwrap() + "\n").unwrap();
                    }
                }
                Err(e) => {
                    println!("native execute wall: {:?}", t.elapsed());
                    println!("NATIVE REJECTED: {e}");
                    std::fs::write(format!("{out}.expected"), b"NATIVE-REJECTED").unwrap();
                    std::process::exit(3);
                }
            }
        }
        Some("mutations") => mutations(&a),
        Some("golden") => {
            let g = za::golden();
            let d = za::digest(&g);
            let s = json!({
                "note": "spec 003 AC-Z2 golden vector; produced by `sworn-zone-host golden`, asserted by attest/src/lib.rs and contracts/test/SwornZoneVerifier.t.sol",
                "typeString": za::TYPE_STRING,
                "typehash": format!("{:#x}", za::TYPEHASH),
                "zoneGuestVersion": format!("{:#x}", za::ZONE_GUEST_VERSION),
                "parentChainId": g.parentChainId.to::<u64>(),
                "verifier": format!("{:#x}", g.verifier),
                "verifierConfig": h(za::ZK_VERIFIER_CONFIG_V1),
                "verifierConfigHash": format!("{:#x}", g.verifierConfigHash),
                "genesisArtifactHash": format!("{:#x}", g.genesisArtifactHash),
                "destinationChainId": g.destinationChainId.to::<u64>(),
                "args": {
                    "zoneId": g.zoneId,
                    "tempoBlockNumber": g.tempoBlockNumber,
                    "anchorBlockNumber": g.anchorBlockNumber,
                    "anchorBlockHash": format!("{:#x}", g.anchorBlockHash),
                    "expectedWithdrawalBatchIndex": g.expectedWithdrawalBatchIndex,
                    "nextZoneHeight": g.nextZoneHeight.to::<u64>(),
                    "prevBlockHash": format!("{:#x}", g.prevBlockHash),
                    "nextBlockHash": format!("{:#x}", g.nextBlockHash),
                    "prevProcessedHash": format!("{:#x}", g.prevProcessedHash),
                    "nextProcessedHash": format!("{:#x}", g.nextProcessedHash),
                    "prevDepositNumber": g.prevDepositNumber,
                    "nextDepositNumber": g.nextDepositNumber,
                    "prevProcessedTokenCount": g.prevProcessedTokenCount,
                    "nextProcessedTokenCount": g.nextProcessedTokenCount,
                    "withdrawalQueueHash": format!("{:#x}", g.withdrawalQueueHash),
                },
                "digest": format!("{d:#x}"),
                "publicValues": h(&za::public_values(d)),
            });
            std::fs::write(&a[2], serde_json::to_string_pretty(&s).unwrap() + "\n").unwrap();
            println!("golden digest {d:#x} -> {}", a[2]);
        }
        _ => {
            eprintln!("usage: see the header of host/src/main.rs");
            std::process::exit(2);
        }
    }
}

fn mutations(a: &[String]) {
    let case_bytes = read(&a[2]);
    let genesis = read(&a[3]);
    let verifier: Address = a[4].parse().expect("verifier");
    let chain: u64 = a[5].parse().expect("chain id");
    let zkvm_out = &a[6];
    let witness_raw = witness_json(&case_bytes);
    let base_w: za::BatchWitness = serde_json::from_slice(&witness_raw).unwrap();
    let mut fails = 0;

    let base = run_framed(&frame(&genesis, &witness_raw, verifier, za::ZK_VERIFIER_CONFIG_V1, chain))
        .expect("baseline must verify");
    println!("baseline: OK digest {:#x} genesisArtifactHash {:#x}", base.digest, base.genesis_artifact_hash);

    // Six PublicInputs members, one at a time, witness otherwise unchanged.
    type M = (&'static str, fn(&mut za::PublicInputs));
    let muts: [M; 6] = [
        ("parent_chain_id", |p| p.parent_chain_id += 1),
        ("zone_id", |p| p.zone_id += 1),
        ("tempo_block_number", |p| p.tempo_block_number += 1),
        ("anchor_block_number", |p| p.anchor_block_number += 1),
        ("anchor_block_hash", |p| p.anchor_block_hash.0[31] ^= 1),
        ("expected_withdrawal_batch_index", |p| p.expected_withdrawal_batch_index += 1),
    ];
    for (name, f) in muts {
        let mut w = base_w.clone();
        f(&mut w.public_inputs);
        assert_ne!(w.public_inputs, base_w.public_inputs);
        let wj = serde_json::to_vec(&w).unwrap();
        let bytes = frame(&genesis, &wj, verifier, za::ZK_VERIFIER_CONFIG_V1, chain);
        match run_framed(&bytes) {
            Err(za::Error::Spf(e)) => println!("mutate {name}: REJECTED (PASS) by prove_zone_batch: {e}"),
            Err(e) => {
                println!("mutate {name}: rejected but not by prove_zone_batch (FAIL): {e}");
                fails += 1;
            }
            Ok(o) => {
                println!("mutate {name}: ACCEPTED (FAIL) digest {:#x}", o.digest);
                fails += 1;
            }
        }
        if name == "expected_withdrawal_batch_index" {
            std::fs::write(zkvm_out, &bytes).unwrap();
            std::fs::write(format!("{zkvm_out}.expected"), b"NATIVE-REJECTED").unwrap();
            println!("  zkVM input for this mutation: {zkvm_out}");
        }
    }

    // One genesis byte: the first account in alloc with `"nonce":"0x1"` gets nonce 0x2.
    let pat = br#""nonce":"0x1""#;
    let pos = genesis.windows(pat.len()).position(|w| w == pat).expect("nonce pattern") + pat.len() - 2;
    let mut g2 = genesis.clone();
    assert_eq!(g2[pos], b'1');
    g2[pos] = b'2';
    let ctx = String::from_utf8_lossy(&genesis[pos.saturating_sub(80)..pos + 2]).to_string();
    match run_framed(&frame(&g2, &witness_raw, verifier, za::ZK_VERIFIER_CONFIG_V1, chain)) {
        Ok(o) => {
            let same_output = o.output == base.output;
            let ok = o.genesis_artifact_hash != base.genesis_artifact_hash && o.digest != base.digest && same_output;
            println!(
                "genesis byte {pos} ('1'->'2' in …{ctx}): batch still verifies, BatchOutput unchanged={same_output}, genesisArtifactHash {:#x} -> {:#x}, digest {:#x} -> {:#x}: {}",
                base.genesis_artifact_hash,
                o.genesis_artifact_hash,
                base.digest,
                o.digest,
                if ok { "PASS" } else { "FAIL" }
            );
            if !ok {
                fails += 1;
            }
        }
        Err(e) => {
            println!("genesis byte {pos}: run rejected ({e}) — digest not comparable (FAIL: pick another byte)");
            fails += 1;
        }
    }

    // verifier_config != 0x02 must abort.
    match run_framed(&frame(&genesis, &witness_raw, verifier, &[0x01], chain)) {
        Err(za::Error::WrongVerifierConfig) => println!("verifier_config 0x01: REJECTED (PASS)"),
        other => {
            println!("verifier_config 0x01: not rejected as expected (FAIL): {:?}", other.map(|o| o.digest));
            fails += 1;
        }
    }

    println!("mutations: {}", if fails == 0 { "ALL PASS" } else { "FAILURES" });
    std::process::exit(if fails == 0 { 0 } else { 1 });
}
