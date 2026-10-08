# Demo video B: Sworn (≤ 3 min, founder's voice), v6-B (real screens only), 2026-10-07

**Kept as a source recorder only.** Demo D (`DEMO-D.md`, `record-demo-d.mjs`) is cut from the clips this recorder writes to `video/takes/`; this version's own video is no longer kept.

**The idea.** Apart from a title card and a closing card, every frame is a real screen recorded while it ran: the
local Operator Console running a real proof job (its start and its verified result, with a labelled cut between), the live page making read-only
calls, Tempo's testnet explorer, and a terminal running the reproduction script and the forge tests. No diagrams,
no mock-ups.

**Status.** Silent picture + script + subtitles: `video/demo-b.mp4`, recorded by `record-demo-b.mjs` with
`DEMO_PAGE_URL` on localhost and the local Operator worker running. The proof job (about 15–20 minutes, about 20 GB
of RAM) is recorded once — no browser runs while it proves — and cached in `video/takes/demo-b/` (`FORCE_JOB=1` re-runs it). The founder adds the
narration scene by scene (`video/scenes/demo-b/`).

**Scope.** The proof job and the batch in scene 3 are Tempo's Zone integration-test fixture (development chain
1337). The settlement in scenes 4–5 is our own Zone on Moderato: one operator, not a Tempo-created Zone. Tempo's own
Zones are unchanged; holding their withdrawals until ZK finality is a proposal (spec 004).

| scene | target | picture |
|---|---:|---|
| 1 What you will see | 13 s | title card (`dintrob`) |
| 2 A real proof job | 22 s | the local Operator Console: the job started live; a labelled cut; the verified result and its real worker log |
| 3 The proof, on chain | 30 s | the page (attest), Tempo's explorer (Events), the page's live re-verify |
| 4 Our own Zone on Moderato | 22 s | the page's own-Zone section, then the payout on the explorer |
| 5 A forged batch is rejected | 14 s | the forged batch on the explorer: Failed, decoded Trace |
| 6 Anyone can re-check it | 16 s | a terminal: `export-vectors.mjs`, then `forge test --match-test OWNZONE` |
| 7 Said plainly, and next | 20 s | closing card (`dclose`) |

## Scene 1 — what you will see · ≈ 13 s

**[Title card: “Sworn: evidence for Tempo Zones.” Three lines: a real proof job; real testnet transactions; a real
test run. Footer: every screen after this card is recorded live; the recording only reads.]**

> Sworn is for Tempo Zones: private ledgers on Tempo. Every screen in this demo is real: a real proof job, real
> testnet transactions, and a real test run.

## Scene 2 — a real proof job · ≈ 22 s

**[The local Operator Console: “Start local proof job” is clicked live and the job goes from queued to proving. A
labelled cut (“the real job ran N min”; nothing recorded in between). The same panel when the job has finished:
“verified”, “New proof passed the read-only on-chain checks. Nothing was sent.”, and its real worker log.]**

> In Sworn's local console, the operator starts a proof job for a Zone batch with one withdrawal and two user
> transactions. Tempo's own Zone code runs inside a zero-knowledge VM. This is the real job; we cut from its start
> to its verified result.

## Scene 3 — the proof, on chain · ≈ 30 s

**[The page: the attest transaction for that batch and what it contains. Tempo's testnet explorer, recorded live:
the transaction and its Events tab. Back on the page, “Re-verify on chain” clicked live: the real batch → true; one
field changed → InvalidProof(); Moderato's pre-T13 reference verifier with an equivalent malformed batch → true.]**

> A contract on Moderato checked that proof against the inputs Tempo's verifier interface expects. Here is the
> transaction on Tempo's explorer. Back on the page, live: the real batch verifies, and with one field changed it
> reverts. Moderato's current prototype verifier accepts even a malformed batch.

## Scene 4 — our own Zone on Moderato · ≈ 22 s

**[The page's own-Zone section, read live: the portal and its verifier, three “✓ settled” batches, the payout,
“Re-verify on chain” clicked live. Then the payout on the explorer: “Private Zone Withdrawal 0.5 PathUSD”.]**

> Now our own Zone on Moderato. Its portal called this verifier in each of three batches, and only after the last
> proof passed did our sequencer pay the withdrawal: zero point five pathUSD, here on the explorer.

## Scene 5 — a forged batch is rejected · ≈ 14 s

**[The forged batch on the explorer, recorded live: status Failed, from our sequencer to our portal; its decoded
Trace: signature verification recovers our sequencer, SwornZoneVerifier reverts InvalidProof, the SP1 verifier
reverts ProofInvalid.]**

> Then our sequencer, with a valid signature, submitted a forged batch replaying a real proof. The explorer's trace
> shows the verifier rejecting it.

## Scene 6 — anyone can re-check it · ≈ 16 s

**[A terminal, recorded while the commands run: `export-vectors.mjs` takes each live batch's verify call from its
trace on Moderato and checks it equals the prover's record; `forge test --match-test OWNZONE` passes the three live
proofs against the real SP1 Groth16 verifier and the deployed bytecode.]**

> Anyone can re-check the three live proofs. This script takes each verify call from its transaction trace; the
> tests run each proof against the real SP1 verifier and the deployed bytecode.

## Scene 7 — said plainly, and next · ≈ 20 s

**[Closing card: the fixture is from Tempo's tests; our own Zone, one operator, not Tempo-created; Tempo's Zones
unchanged, spec 004 is a proposal; testnet, unaudited, no customers. Next: one Zone business supplies a batch. The
Sworn mark, the repo and the page.]**

> To be clear: the proof job used a batch from Tempo's tests, and the Zone that paid is our own, run by us. No
> customers yet. Next, a Zone business supplies a batch, and its reviewer decides if it's worth paying for.

## Claims and sources

Same sources as `DEMO.md` and `DEMO-A.md`, plus: the proof job is `operator/server.mjs` running
`scripts/zone-prove.sh` then `scripts/zone-attest.sh` (no `--send`); the recorder requires the job to end
`verified`. The terminal runs `spikes/own-zone/scripts/export-vectors.mjs` and `forge test --match-test OWNZONE`
while recording, and requires both to succeed and the vectors to be unchanged.

**Never claim:** that this protects withdrawals on Tempo's Zones; that our Zone is Tempo-created or a running
service; that the prototype and Sworn receive the same ABI input; that Tempo is broken; or that Sworn has
customers, revenue or a production deployment.
