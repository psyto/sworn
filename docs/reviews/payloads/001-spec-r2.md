# Adversarial review — spec 001 r2 "Bonded answers" (round 2), plus a prize-probability estimate

You are an independent adversarial reviewer. **Break this spec; do not polish it.** Work from files,
not from claims. Read-only.

Working directory `/Users/hiroyusai/src/tempo-spike`. Read:
- `docs/specs/001-bonded-answers.md` — r2 under review (its §0 maps every r1 finding)
- `docs/reviews/001-spec-r1.md` — your round-1 review (VERDICT: CHANGES, 5 BLOCKER)
- the spike: `core/src/lib.rs`, `program/src/main.rs`, `host/src/main.rs`, `runner/src/main.rs`,
  `witness/`, `out/`
- vendored Tempo `tempo/` at `61c979a` — esp. `crates/revm/src/handler.rs` (fee token / fee
  collection), `crates/precompiles/src/tip20/`, `receive_policy_guard/`, `tip403_registry/`,
  `crates/primitives` (Tempo tx types, 2D nonces / nonce precompile, fee payer, access keys)

## Context (fixed)

Objective: a prize in Colosseum's Crypto World's Fair, **Tempo track** ($100K / 10 winners; rules:
"products that integrate with the Tempo blockchain"). Moderato testnet only (founder ruling).
Deadline 2026-10-12 23:59 PT (9 days). Rubric (rules §8): functionality/code quality, potential
impact/TAM, novelty, UX, open-source/composability, business plan; web FAQ adds founder-market fit,
insight, communication, viability, traction. The 16 listed track judges are not from Tempo. Founder's
edge: Reth/Revm/Alloy/Foundry. Visible Tempo-track entries (public GitHub, 2026-10-03): ~7, mostly
TypeScript payment/invoice apps; `held` = escrow with human/resolver disputes. CWF registrations:
8,150. Tempo-track submission count unknown.

## Part A — the spec

1. Does r2 actually close each r1 BLOCKER? Verify against source, not against §0's table.
2. **Honest-server safety (most important).** With fees, nonce and balance checks on: can a correct
   answer still be proven "different" because the guest's execution model diverges from what the RPC /
   chain would do — fee-token resolution order (tx field vs user/validator preference), fee payer,
   2D nonces / nonce precompile, `timestampMillis`, basefee of N vs N+1, gas limit vs `tx_gas_limit_cap`,
   access keys, keychain? Is §3.2's "defined hypothetical" well-defined enough that the server and the
   guest compute the same thing? Is AC-2 (replay real txs from `prestateTracer` prestate) a sound
   equivalence test, given that a tx's prestate inside a block is not a block-boundary state and the
   prestate tracer's output is unproven?
3. `reserve()` design: does it close the unbond race, coverage>bond, stale-hash and withheld-witness
   problems? New attacks: server reserves for a block whose answer it knows the client cannot witness
   in time (e.g. N already ~250 blocks old at reserve), front-running, griefing via `release`,
   reservation digest collisions, a client colluding with a challenger, the dishonest server simply
   never reserving (then what does the client have?).
4. `receiverDelta` when receiver == from, receiver == fee payer, token == fee token, receive policy
   guard, transferWithMemo. Any way to get a correct-answer slash.
5. AC holes a lazy implementation could pass while the claim is false.

## Part B — the prize estimate (be adversarial both ways)

Claude estimated, explicitly as a guess not a measurement: any-prize ≈ 25–30% (range 15–40%), from
P(Tempo track top 10) ≈ 0.6 × 0.40 + 0.4 × 0.15 ≈ 0.30 × 0.9 (testnet-eligibility haircut) ≈ 27%,
plus general pool 2–5% and Public Goods 2–4%; assumptions: total submissions 1,000–1,500 (15–20% of
8,150 registrants), Tempo-track submissions 40–120 (center 70), P(finish r2 incl. AC-8 + videos by
10-12) ≈ 0.6; criteria view: strong on functionality/novelty/open-source/founder-market fit, medium UX,
weak TAM/business/traction. A prior Codex estimate (2026-09-22) put the previous entry (Confide, Solana
track) at 4.8% any-prize. Attack every assumption; give your own range with stated assumptions; name
the single variable that moves it most and the cheapest action that would raise it.

Cite `file:line`. Classify BLOCKER / MAJOR / MINOR; separate verified from inferred. End with exactly
one line: `VERDICT: APPROVE` or `VERDICT: CHANGES`.
