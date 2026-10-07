# Demo video A: Sworn (≤ 3 min, founder's voice), v6-A (real screens where it matters), 2026-10-07

**What changed from v5.6 (`DEMO.md`).** It opens with what Sworn is and what the viewer will see. The operator
console is the real local page, not a mock-up. Every explorer view is Tempo's testnet explorer recorded live in a
browser at its natural size (hash, status, from/to, events, trace), not an enlarged crop. The forged batch is
shown on the explorer's own Trace tab. Labels no longer say "Example Zone" or "Illustration": the fixture is
labelled for what it is.

**Status.** Silent picture + script + subtitles: `video/demo-a.mp4`, recorded by `record-demo-a.mjs` with
`DEMO_PAGE_URL` pointing at a local build of the page (the Operator Console's job control only exists on
localhost). The founder adds the narration scene by scene (`video/scenes/demo-a/`).

**Scope.** The fixture in scenes 2–6 is Tempo's Zone integration-test batch on development chain 1337. The
settlement in scenes 7–8 is our own Zone on Moderato: one operator, not a Tempo-created Zone. Tempo's own Zones
are unchanged; holding their withdrawals until ZK finality is a proposal (spec 004).

| scene | target | picture |
|---|---:|---|
| 1 What you will see | 14 s | title card (`dintro`) |
| 2 The operator's console | 17.5 s | the real local Operator Console (page, localhost) |
| 3 Why the batch check matters | 12.5 s | diagram of the ZonePortal flow (`d1`) |
| 4 What stays private | 14 s | data-flow diagram (`dflow`), the page's motif |
| 5 Moderato's prototype verifier, live | 15 s | the page: "Re-verify on chain" clicked live |
| 6 Sworn on the batch with a withdrawal | 32 s | the page + Tempo's explorer (Events tab), live |
| 7 Our own Zone on Moderato | 20 s | the page's own-Zone section + the payout on the explorer, live |
| 8 A forged batch is rejected | 13 s | the forged batch on the explorer: Failed, then its Trace tab, live |
| 9 Said plainly | 16.5 s | scope disclosure (`dz`) |
| 10 GTM test and next step | 16 s | validation route (`d6`) |

## Scene 1 — what you will see · ≈ 14 s

**[Title card: “Sworn: evidence for Tempo Zones.” Three lines appear as they are spoken: a real proof of a Zone
batch; our own Zone on Moderato, settling only after the proof; a forged batch, rejected. Footer: every
transaction shown is a real Moderato testnet transaction; the recording only reads.]**

> Sworn is for Tempo Zones: private ledgers on Tempo. You'll see a real Zone proof, our own Zone settling only
> after it, and a forged batch rejected — all real testnet transactions.

## Scene 2 — the operator's console · ≈ 17.5 s

**[The real local Operator Console (the page on localhost, with the local worker connected): the panel “Generate
evidence for Zone blocks 5–6” with its “Start local proof job” button (about 15 min, about 20 GB RAM, no
transaction sent), then what the batch contains: one withdrawal, two user transactions. The job is not started
in this take.]**

> This is Sworn's local console. The operator picks a Zone batch, here one withdrawal and two user transactions,
> and starts a proof job: Tempo's own code runs in a zero-knowledge VM, and the result goes to an auditor.

## Scene 3 — why the batch check matters · ≈ 12.5 s

**[Diagram of the ZonePortal flow: operator submits a batch → batch includes a withdrawal → Zone verifier →
ZonePortal processes it; each step lights in turn. It is the same flow our own Zone's portal ran on Moderato.]**

> A ZonePortal queues a batch's withdrawals only after its verifier accepts the batch, so that check must be
> trusted. In our own Zone, the verifier is Sworn.

## Scene 4 — what stays private · ≈ 14 s

**[The page's data-flow diagram, full frame: the witness stops at the prover; only the digest crosses to
SwornZoneVerifier; the reviewer sees “✓ true”, then “✗ InvalidProof() — one field changed”.]**

> The witness stays with the operator and the prover. Only hashes, counters and batch metadata reach Tempo: enough
> to check the proof, not to see balances, senders or amounts.

## Scene 5 — Moderato's prototype verifier, live · ≈ 15 s

**[The page: “Re-verify on chain” is clicked live; the third row calls Moderato's pre-T13 reference verifier with
an equivalent malformed batch and shows it returning true.]**

> The evidence panel reads Moderato live. Its pre-T13 prototype verifier accepts a malformed batch; Sworn
> demonstrates the missing ZK check.

## Scene 6 — Sworn on the batch with a withdrawal · ≈ 32 s

**[The page shows the attest transaction for the fixture: one withdrawal, two user transactions. Then Tempo's
testnet explorer, recorded live: the transaction (status Success, hash, block) and its Events tab with
`ZoneBatchVerified`. Back on the page, a second live click: the real batch → true; one field changed →
`InvalidProof()`.]**

> Now Sworn, on a real batch from Tempo's integration tests: two user transactions and one withdrawal. Tempo's
> own batch verifier ran inside a zero-knowledge VM, and this contract checked the proof. Here it is on the
> explorer. Again, live: the real batch, true. Change one field, and it reverts: invalid proof.

## Scene 7 — our own Zone on Moderato · ≈ 20 s

**[The page's own-Zone section, read live: the portal and its verifier, three “✓ settled” batches, the payout,
and “Re-verify on chain” clicked live. Then the payout on Tempo's explorer, recorded live: “Private Zone
Withdrawal 0.5 PathUSD”, status Success, sent to our portal.]**

> Now our own Zone on Moderato. Its portal called the verifier in each of three batches. Only after the last
> proof passed could this withdrawal be paid: our sequencer then called processWithdrawals. Here is the payout on
> the explorer: zero point five pathUSD.

## Scene 8 — a forged batch is rejected · ≈ 13 s

**[The forged batch on Tempo's explorer, recorded live: status Failed, from our sequencer to our portal. Then its
Trace tab: the signature check recovers our sequencer, and SwornZoneVerifier and the SP1 verifier revert.]**

> Our sequencer submitted a forged batch: valid signature, made-up withdrawal queue, replayed proof. The portal
> rejected it. No batch settled, and the Zone state did not change.

## Scene 9 — said plainly · ≈ 16.5 s

**[Three plain cards: fixture: dev chain 1337; our own Zone, one operator; Tempo's Zones unchanged, spec 004 is a
proposal.]**

> To be clear: the batch above comes from a dev chain. The Zone that paid is our own Zone on Moderato, run by
> us, not a Tempo-created Zone. Tempo's own Zones still use their current verifier.

## Scene 10 — GTM test and next step · ≈ 16 s

**[The validation route: a Zone business supplies its witness; its reviewer re-verifies the proof; a repeat need
for the next batch or upgrade is the test. “GTM test, not traction”, with the limits and the closing card.]**

> Sworn has no customers, revenue or payer agreement today. The next test is one Zone business supplying a batch;
> its reviewer re-verifies it and decides whether the next batch or upgrade is worth paying for.

## Claims and sources

Same sources as `DEMO.md`, plus: every explorer view is the live page of the transaction it names
(`OwnZone.payout.tx`, `OwnZone.forgedBatch.tx`, `SwornZoneVerifierWithdrawal.attest.tx`), checked by the recorder
for the hash, the status and the block before it records.

**Never claim:** that this protects withdrawals on Tempo's Zones; that our Zone is Tempo-created or a running
service; that the prototype and Sworn receive the same ABI input; that Tempo is broken; or that Sworn has
customers, revenue or a production deployment.
