# Adversarial review — spec 001 "Bonded answers" (round 1)

You are an independent adversarial reviewer. **Break this spec; do not polish it.** Work from files,
not from this payload's or the spec's claims. Read-only. Do not edit anything.

Working directory: `/Users/hiroyusai/src/tempo-spike`. Read:
- `docs/specs/001-bonded-answers.md` — the spec under review
- `core/src/lib.rs`, `program/src/main.rs`, `host/src/main.rs`, `runner/src/main.rs` — the kill-gate spike
- `out/prove_groth16_transfer_run2.log`, `out/tempo-patches.diff`, `witness/*.json`
- `tempo/` — vendored `tempoxyz/tempo` at `61c979a` with the three patches (precompiles under
  `tempo/crates/precompiles/src/`, incl. `receive_policy_guard/`, `tip20/`, `tip403_registry/`)
- For the lessons the spec claims to have absorbed: `/Users/hiroyusai/src/reckn/docs/reviews/015-spec-r1.md`
  and `/Users/hiroyusai/src/reckn/zk-verdict/contracts/src/RecknZkEscrow.sol`

## Context (fixed; do not argue with it)

- Objective: win a prize in Colosseum's Crypto World's Fair, **Tempo track** ($100K / 10). Founder ruled
  2026-10-03 to switch the entry to this product. **Moderato testnet only** (founder ruling). Deadline
  2026-10-12 23:59 PT. Current demand is weighted low (hackathon), but judging uses Colosseum's general
  rubric: functionality/code quality, potential impact/TAM, novelty, UX, open-source/composability,
  business plan. The 16 listed judges are not from Tempo.
- Founder's stated edge: Reth/Revm/Alloy/Foundry (Paradigm's stack; Paradigm incubated Tempo).
- Research (2026-10-03): MPP spec has no refund/dispute/escrow; `tempoxyz/zones` `zone-spf` re-executes
  with tempo-revm over a witness but is "presently a normal Rust verifier rather than a `no_std` proving
  guest"; `succinctlabs/rsp` = reth in SP1, no Tempo; visible Tempo-track entries are TypeScript
  payment apps; `held` = escrow with human/resolver disputes.

## What I want

1. **Soundness of the slashing path.** Can a server answer wrongly and escape (witness games, choosing
   a block whose hash becomes unreadable, unbonding race, signing under another bondContract/vkey,
   coverage > bond)? Can a client or third party slash a **correct** answer (e.g. the guest's execution
   environment differs from the chain's — hardfork schedule hard-coded, nonce handling, gas params,
   fee-token logic, `timestampMillis`, beneficiary/coinbase, basefee — so a proof of a "different"
   result is really a proof of a mis-modelled environment)? This is the most important question: an
   honest server slashed by a guest/chain divergence kills the product. Check what the spike's guest
   actually sets for block/tx env against what Tempo does, and what the public values commit to.
2. **`receiverDelta` and receive policies (§3.2).** Does the spike or the vendored code support
   computing it correctly, including when funds go to `ReceivePolicyGuard`, fee deductions in the same
   TIP-20, and TIP-403 reverts? Is a read-only `eth_call`-style execution even the right model for "will
   this payment land" (the real tx will execute at a later block)? Say exactly what the answer can and
   cannot guarantee.
3. **Witness and windows (§3.1, §3.5).** Is "the answer ships its witness" sound given the server
   controls it? Is the client-side check feasible for a TypeScript agent? Is the 82-min/pin design
   right? Unbonding delay correct?
4. **The three vendored patches and the p384 substitute** — any risk to the TIP-20 path or to
   guest/chain equivalence? Is the "RPC runs v1.16.0-384456f, not in the public repo" drift a blocker?
5. **Prize strategy, adversarially both ways.** Under the general rubric with non-Tempo judges, is this
   strong enough to place in the Tempo track? What is the weakest point a judge will hit first? What
   single change would most raise its chance? Is the demo (§4) honest — e.g. "covered up to 500" for a
   1-cent answer: who would bond that, and does the economics survive a judge's first question?
6. Anything in the ACs (§5) that a lazy implementation could pass while the claim is false.

Cite `file:line` for every finding. Classify BLOCKER / MAJOR / MINOR. Separate "verified against
source" from "inferred". End with exactly one line: `VERDICT: APPROVE` or `VERDICT: CHANGES`.
