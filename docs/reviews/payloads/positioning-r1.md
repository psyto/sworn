# Adversarial review — Sworn's positioning after "the client can simulate it itself"

Read-only. Break this proposal; do not polish it. Working directory: /Users/hiroyusai/src/sworn.

## Context (fixed)
Sworn is the founder's entry to Colosseum's Crypto World's Fair, **Tempo track** (track winners chosen
separately from the general shortlist; Moderato testnet qualifies). Deadline 2026-10-12 23:59 PT. Videos
are recorded (pitch 106.5 s, demo 169.2 s) and await the founder's voice. Read `README.md`,
`video/PITCH.md`, `video/DEMO.md`, `_submission/cwf-form.md`, `docs/specs/001-bonded-answers.md` §R3.

## What was just measured (2026-10-04, public Moderato RPC, by the orchestrator)
1. `eth_simulateV1` with `"validation": true`, `maxFeePerGas` set and `"feeToken": 0x20c0…0000` on a
   TIP-20 `transfer`: status 0x1, gasUsed 39,942, logs show the transfer **and a 24-unit fee transfer to the
   fee manager 0xfeec…** — i.e. the RPC charges fees in the given fee token.
2. The same with the AC-1 "invalid_fee_token_dusd" question (from 0x6718…d655, feeToken
   0x20c0…5c58fc053c52e0d1): the RPC returns `-32003 TIP20 token error: PolicyForbids(PolicyForbids)`
   — it rejects the invalid-by-fee transaction, as Sworn's guest does.
3. Earlier AC-1 (`out/ac1_run1.log`, `out/ac1_run3.log`) compared only against `eth_call`, which charges no
   fees; its "the RPC cannot express the fee token" was true of `eth_call` only.
4. Tempo docs, `tempo.xyz/developers/docs/guide/private-zones` (read today): *"Tempo Zones give applications
   a private account ledger connected to Tempo. You use a Zone's RPC to read private balances … The public
   Tempo portal holds backing assets while a Zone operator runs the private account ledger. Deposits,
   withdrawals, and signed settlement commitments connect the two chains."* The sandbox is *"an earlier
   testnet deployment … the current permissioned runtime uses encrypted deposits and does not yet enable
   those transfers."* Vendored `tempo/` registers the ZoneVerifier precompile only at T13
   (`tempo/crates/precompiles/src/lib.rs`); `tempoxyz/zones` `crates/spf` re-executes Zone batches with
   tempo-revm and says it is *"presently a normal Rust verifier rather than a no_std proving guest"*.

**Conclusion drawn:** Sworn's current question ("if this TIP-20 transfer ran on the state after block N,
what would the receiver get, fees on?") is reproducible by any client for free with `eth_simulateV1`.

## The proposal under review
1. Keep the recorded demo, but **present it honestly as proof of the mechanism**: "today's question is one
   an agent could simulate itself; it is in the demo because anyone can check it."
2. **Name the real target: answers about state the asker cannot see — inside Tempo's private Zones**
   (e.g. "does this zone account hold 500?", "will this cross-zone payment be credited?"), where a ZK proof
   could make the answer trustworthy without revealing the private state. Not buildable in the window: Zones
   are a sandbox/permissioned runtime, the link to Tempo is operator-signed commitments, ZoneVerifier arrives
   at T13.
3. Change the pitch's "Next" from "a bonded-answer method any MPP seller can switch on" to "bonded answers
   about state an agent can't see — inside Tempo's private Zones"; update README roadmap and the form.
Other candidates considered and ranked lower: historical payment confirmation (falsifiable by one receipt,
but heavy log scanning is the only client cost, and it doesn't use tempo-revm), aggregates over many accounts
(completeness unprovable).

## What I want
1. Verify the measurements' logic: does `eth_simulateV1` really make Sworn's current answer worthless to a
   client, or does Sworn still add something (recourse when the agent relies on a third party's answer,
   agents that cannot reach an RPC, contracts as consumers, the bond as a signal)? Be precise and adversarial
   in both directions.
2. Attack the Zones pivot: is it technically coherent? Who would be the bonded answerer (the Zone operator?
   a third party who can see the zone?) — and how could a challenger produce a proof about state it cannot
   see? What anchors the zone state root today? Does the claim "ZK makes it trustworthy without revealing
   state" survive these questions, or does it overclaim? Is "Tempo needs this too" still honest?
3. Prize strategy: with judges not from Tempo and a recorded demo whose question is self-simulatable, which
   framing gives the best odds — (a) proposal as written, (b) keep current framing and pre-empt the
   simulation objection differently, (c) another framing you can justify from the repo? Which sentences in
   PITCH.md / DEMO.md / README / form must change, and which can stay?
4. Anything in the current videos' narration that is now false or misleading given measurement 1–2.

Cite file:line. BLOCKER / MAJOR / MINOR. Separate verified from inferred. End with exactly one line:
`VERDICT: APPROVE` or `VERDICT: CHANGES`.
