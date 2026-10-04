# Adversarial review — spec 003 (ZK verifier for Tempo Zone batches, IVerifier-shaped)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read files.
Read: `docs/specs/003-zone-verifier.md` (the spec under review), `spikes/zone-spf/guest/src/main.rs` (top 25
lines), `spikes/zone-spf/zones/crates/prover/src/protocol.rs` (lines 1-150), `spikes/zone-spf/zones/crates/contracts/src/runtime/interfaces/IZone.sol`
(lines 300-350), `spikes/zone-spf/zones/crates/spf/src/types.rs` (lines 50-100). You may grep
`spikes/zone-spf/zones/crates/spf/src` to check how `prove_zone_batch` uses `public_inputs`. Do not read
other large trees. Answer in ≤ 800 words.

Questions:
1. Soundness: does the digest bind everything a portal relies on? Can a prover produce a valid proof
   for a batch/inputs combination that the SPF would not accept (e.g. do `public_inputs` actually constrain
   execution inside `prove_zone_batch`, or are some fields merely passed through)? Is
   `chainSpecHash = keccak256(genesis_bytes)` a sound pin, given hardfork config lives in the genesis JSON?
2. Is the EIP-712 struct encoding (19 fields, no domain) unambiguous and implementable identically in
   Rust (alloy `sol!`) and Solidity? Any replay across verifier deployments / zones / chains left open?
3. Are deviations D1-D3 honestly scoped, and is anything missing from the "may not claim" list?
4. Do the acceptance criteria actually catch a broken implementation (e.g. a contract that ignores one field)?

BLOCKER / MAJOR / MINOR; separate verified (with file:line) from inferred. End with exactly one line:
`VERDICT: APPROVE` or `VERDICT: CHANGES`.
