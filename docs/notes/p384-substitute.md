# The p384 substitute in the Sworn guest: why it stays (2026-10-04)

**What it is.** `patches/tempo.patch` (SPIKE-PATCH-2) swaps the AWS-LC (C) backend of Tempo's
`nitro-attestation` crate for a pure-Rust RustCrypto `p384` + `sha2` backend on the zkVM target only,
exported under the same name `AwsLcP384` so callers do not change:
`patches/tempo.patch:10-15` (Cargo target split), `:19-34` (`lib.rs` `#[path = "rustcrypto_p384.rs"]` on
`target_os = "zkvm"`), `:143-172` (the new `rustcrypto_p384.rs`). It is needed only to *compile* the
guest. AWS-LC is C and does not build for `riscv64im-succinct-zkvm-elf`.

**It is linked into the guest.** `tempo-precompiles` depends on `tempo-nitro-attestation` with
`features = ["aws-lc"]` unconditionally (`tempo/crates/precompiles/Cargo.toml:33`), and the guest uses
`tempo-precompiles` through `core` (`core/Cargo.toml:10`). The built ELF
(`program/target/elf-compilation/riscv64im-succinct-zkvm-elf/release/tempo-spike-guest`, sha256
`b5a8b83a…1588`, 2026-10-03) contains `tempo_nitro_attestation` symbols and 60 `p384` strings.
Spec 001 Q5 had decided to feature-gate it **out** (`docs/specs/001-bonded-answers.md:197`, `:332`).
That was never done.

**Why it stays.** Removing it changes the guest ELF, so it changes the SP1 verifying key. Sworn pins
the key as a constant, with no setter and no constructor argument:
`contracts/src/Sworn.sol:62` `GUEST_VKEY = 0x00727936…7fa9`. A rebuilt guest would produce proofs that the
deployed Sworn (`deployments/moderato.json`, codehash `0x9082…5563`) rejects (`challenge` → `verifyProof`
against the pinned key). Changing the patch therefore
means a new Sworn deployment, a new bond and a new demo. That costs a lot and buys nothing, for the two
reasons below.

**Why it is not on the path the guest proves (T11).** The substitute is reachable only through
`AwsLcP384` in the zone verifier precompile. Its only call is
`tempo/crates/precompiles/src/zone_verifier/attestation.rs:35`
(`verify_parsed(…, &AwsLcP384)`). Two independent facts keep the guest away from it:

1. **The precompile does not exist on the guest's schedule.** ZoneVerifier is installed only when
   `spec.is_t13()` (`tempo/crates/precompiles/src/lib.rs:258`). The guest takes its fork schedule from
   Moderato's genesis config (`core/src/lib.rs:113-127`). That config has `t11Time` and `t12Time` and no
   `t13Time` (`tempo/crates/chainspec/src/genesis/moderato.json:37-38`), so under the guest the
   address is not a precompile at any block. Moderato runs T11 today; T12 activates 2026-10-08
   14:00 UTC. The answerer refuses on any schedule change (spec 002 S-4), so a future T13 cannot reach
   the guest unnoticed.
2. **The guest executes only a TIP-20 transfer.** A question must target a `0x20c0…` TIP-20 precompile
   with `transfer` or `transferWithMemo` calldata. Otherwise Sworn refuses to reserve
   (`contracts/src/Sworn.sol:296-307`, `_checkGuestWouldAnswer`) and the guest aborts (R3.3). The TIP-20
   precompile never calls ZoneVerifier.

So no proven execution runs a single p384 instruction. The substitute is dead code in the ELF. It only
affects the binary's identity, which is why it is not touched.

**When it should go.** Remove it together with the next deliberate guest change that redeploys Sworn
anyway, for example the T12 re-check. Remove it by gating the `aws-lc` feature of
`tempo-nitro-attestation` out of the guest build, not by keeping a substitute crypto backend. That
redeploy then records a new `GUEST_VKEY`.
