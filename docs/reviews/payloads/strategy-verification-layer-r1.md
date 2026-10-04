# Adversarial review — reposition Sworn as "Tempo's verification layer" (investor lens)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read files
(use your read tools/commands freely to read), but do not browse and do not modify anything. Read at most:
`README.md`, `video/PITCH.md`, `video/DEMO.md`, `_submission/cwf-form.md`, `deployments/moderato.json`,
`docs/reviews/positioning-r1.md`. Answer in ≤ 900 words.

## Context (fixed)
Colosseum Crypto World's Fair, Tempo track (track winners chosen separately; Moderato qualifies). The
founder's reading — treat as given: **judges evaluate as investors; future business potential matters more
than completeness at submission.** Deadline 2026-10-12 23:59 PT. Founder: solo; Reth/Revm/Alloy/Foundry
expertise (rethlab courses; rdk; earlier project Reckn placed 3rd for Uniswap Foundation at ETHGlobal Tokyo).
Founder's personal yardstick: whether it can work as a one-person company.

## Facts (verified by the orchestrator)
- Sworn runs Tempo's own EVM (`tempo-revm`, 3 patches) inside SP1: AC-2 40/40 real Moderato txs match receipts;
  Groth16 6–9 min locally; Sworn.sol on Moderato verifies it; two live takes slashed a lying provider.
- The current product question (a TIP-20 transfer's outcome at block N, fees on) is reproducible free by any
  client via `eth_simulateV1` (measured 2026-10-04, incl. fee charging and PolicyForbids rejection). Your
  previous review: `docs/reviews/positioning-r1.md` (BLOCKER: current answer not scarce; Zones-answers pivot
  overclaims).
- Tempo docs, "Tempo Zone proving and settlement" (reviewed by Tempo 2026-09-23 at zones `ac49071f`, tempo
  `3c4db7f843`), quoted: *"The Zones Solidity reference verifier still returns `true` without checking
  execution. Tempo also implements a native Nitro attestation verifier activated by T13. At the reviewed
  commit, its approved enclave measurements are unset, so it rejects proofs."* *"A signature quorum
  authenticates the submitted commitments; it does not independently prove correct execution."* Batches go
  through `ZonePortal.submitBatch` (fields incl. `blockTransition` prev→next zone block hash, `verifierConfig`
  `0x01` = Nitro policy, `proof`), and the portal calls a configured `IVerifier.verify(...)`. The SPF
  (`prove_zone_batch(config, witness) -> BatchOutput`) "replays batches against witnessed Zone and Tempo
  state" and "is implemented as a Rust verifier".

## Proposal under review
Reposition Sworn: *"Sworn proves Tempo's own execution. Today it makes paid answers accountable; next it
proves Tempo Zone settlement and lets private accounts prove facts without revealing them."* One engine,
three applications: (1) **ZK execution proofs for Zone settlement** (the large market — every zone operator
needs trustworthy withdrawals; the verifier is a stub/TEE today); (2) private proofs-of-funds for zone
accounts against the zone block hash the portal stores; (3) accountable answers (today's demo, plus
watchtowers). In the remaining days: a 1–2 day spike to run `zone-spf` inside SP1 on a real batch (running
in parallel now); rewrite the pitch around "Tempo's verification layer"; keep the recorded demo as evidence
the engine works on the live chain; rewrite the form's building / why-now / business fields.

## What I want
1. Is (1) a real, fundable business, or a feature Tempo / Succinct / RISC Zero will ship themselves? Who is the
   paying customer (zone operators? Tempo? institutions running zones?) and does the portal design even let a
   third party's verifier be used (who chooses `verifierConfig` / the configured verifier)? What would an
   investor's first three objections be, and do the facts above answer them?
2. Does the pivot's story stay honest given the evidence actually in hand (no zone proof yet; demo shows
   accountable answers)? Which claims in the proposal overreach, and the exact wording that would not?
3. Compare with alternatives for the investor lens: (a) this proposal, (b) accountable APIs + watchtowers only,
   (c) proofs-of-funds / selective disclosure for Zones as the lead (founder has prior work in selective
   disclosure), (d) something else you can justify. Rank them for investor appeal AND for "works as a
   one-person company", and say what single piece of evidence (obtainable in ≤ 8 days) would most raise the
   ranking of the top choice.
4. What must the pitch say in its first 20 seconds under the recommended option?

BLOCKER / MAJOR / MINOR; separate verified from inferred; cite file:line where you read. End with exactly one
line: `VERDICT: PROCEED` or `VERDICT: RECONSIDER`.
