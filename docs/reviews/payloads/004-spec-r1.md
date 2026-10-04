# Adversarial review — spec 004 (TEE + ZK for Tempo Zone batches, design proposal)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read files.
Read: `docs/specs/004-tee-plus-zk.md` (under review), `docs/specs/003-zone-verifier.md` §1-§5,
`spikes/zone-spf/zones/crates/contracts/src/runtime/tempo/ZonePortal.sol` (grep around submitBatch,
processWithdrawals, _verifySettlement, pause), `spikes/zone-spf/zones/crates/contracts/src/runtime/interfaces/IZone.sol`
(lines 300-350), `docs/research/moderato-zone-feasibility-20261004.md`. Do not read other large trees.
Answer in ≤ 800 words.

Questions:
1. Are the §1 facts right (cite file:line)? In particular: does the sequencer really choose verifierConfig
   per batch, and is settlement vs. payout really two steps such that option B is a small portal change?
2. Does option B actually achieve G1-G4? Find attacks: e.g. a sequencer that never posts ZK, a ZK proof for a
   different batch, ordering/reorg of the withdrawal queue, aggregation ranges, the "late past a bound"
   exception, griefing via finalizeWithZk, or deposit/bounce-back paths that move money without
   processWithdrawals.
3. Is anything claimed as done or measured that is not? Is the "proposal for Tempo, not deployable by
   Sworn alone" framing honest and consistent?
4. What is the single most important missing piece for this to be credible to Tempo's engineers?

BLOCKER / MAJOR / MINOR; separate verified (with file:line) from inferred. End with exactly one line:
`VERDICT: APPROVE` or `VERDICT: CHANGES`.
