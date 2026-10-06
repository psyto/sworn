# Narration drafts after the own-Zone live run: pitch v5.4, demo v5.5

**Applied 2026-10-06** as approved: `PITCH.md` v5.4 and `DEMO.md` v5.5, the recorders and slides updated, and both
silent videos re-recorded (`pitch.mp4` 116.5 s, `demo.mp4` 173.4 s). The demo's word cap was raised from 330 to 350
for the new scene. What follows is the draft as it was approved.

Status: draft. `PITCH.md` and `DEMO.md` still match the recorded `pitch.mp4` and `demo.mp4`. Nothing below is
recorded. The founder approves the wording, then it is applied to `PITCH.md` / `DEMO.md`, the recorders are
updated (list at the end), and both videos are re-recorded.

Source of every fact: `deployments/moderato.json` → `OwnZone`, and spec 003 "Results (own Zone live run on Moderato)"
(2026-10-06). Holds use the recorders' rule: words ÷ 2.2 words/s, rounded up to 0.5 s.

## Pitch v5.2 → v5.4 (≤ 118 s)

Only scenes 3 and 6 change; scenes 1, 2, 4 and 5 stay word for word.

**Scene 3, now (35 words, 16.0 s):**
> We have done this on Moderato: a test batch with one withdrawal and two user transactions verified by a
> contract. Change one input, and verification fails. This is a working proof pipeline, not a mockup.

**Scene 3, draft (34 words, 15.5 s):**
> On Moderato, our own Zone's portal pays a withdrawal only after Sworn's proof passes. Three batches, proven
> and checked on chain. Change one input, and it is rejected. A working pipeline, not a mockup.

- Picture: the pipeline ends at "OwnZonePortal → SwornZoneVerifier → SP1" instead of "verified on Moderato";
  three "✓ settled" rows (`submitBatch` 0x8f08…472b, 0x334a…84ce, 0x4062…83b4) and the payout
  `WithdrawalProcessed` 0xfc31…e1f1 (+0.5 pathUSD); chip "our own Zone · portal calls Sworn".
- "Change one input, and it is rejected" must stay backed by a live call: the recorder rebuilds the verifier
  call of the withdrawal batch from its `submitBatch` trace and calls `verify` with zone height +1, which must
  revert `InvalidProof()`. If that is not built, keep the fixture's mutation check and say "Change one input of a
  proven batch, and it is rejected."

**Scene 6, now (31 words, 14.5 s):**
> Today: testnet, unaudited, Tempo integration-test batch. No customer claimed. Next, a design partner supplies
> a batch and decides if independent proof is worth paying for. Sworn: audit-ready evidence for private execution.

**Scene 6, draft (34 words, 15.5 s):**
> Today: testnet, unaudited, our own Zone with one operator. No customer claimed. Next, a design partner supplies
> a batch and decides if independent proof is worth paying for. Sworn: audit-ready evidence for private execution.

- Chips: "testnet" · "unaudited" · "our own Zone, one operator" · "no customer claimed".
- Header "Honesty rule" becomes: the live settlement is our own Zone on Moderato, one operator, not a
  Tempo-created Zone; the fixture shown in scene 2 is Tempo's integration-test batch on dev chain 1337.
- Total: 116.0 s today → 116.5 s (scene 3 15.5 s, scene 6 15.5 s); the recorder refuses over 118 s.
- **Not claimed** (replace the current line): that Sworn protects withdrawals on Tempo's Zones; that our Zone
  is Tempo-created or runs continuously; that a customer, partner, payer, price, production deployment or audit
  exists; or that Tempo will adopt this design.

## Demo v5.4 → v5.5 (≤ 3 min)

**New scene 6, after scene 5: our own Zone on Moderato · about 20 s (44 words, 20.0 s)**

**[The page's new section "A portal that pays a withdrawal only after Sworn's proof passes", read live: the
portal and its verifier, three "✓ settled" batches, the payout. Explorer insert: the payout tx's
`WithdrawalProcessed` (to the user, 0.5 pathUSD).]**

> Now our own Zone on Moderato. Its portal called the verifier in each of three batches, and paid this
> withdrawal only after the last proof passed. Here is the payout on the explorer: zero point five pathUSD,
> paid by the portal after the proof.

**Scene 6 → 7 "said plainly", now:**
> To be clear: this batch comes from a dev chain, not a Moderato Zone. No portal uses it, and it does not protect
> withdrawals yet.

**Draft (36 words, 16.5 s):**
> To be clear: the batch above comes from a dev chain. The Zone that paid is our own Zone on Moderato, run by
> us, not a Tempo-created Zone. Tempo's own Zones still use their current verifier.

- Cards: "fixture: dev chain 1337" · "our own Zone, one operator" · "Tempo's Zones unchanged; spec 004 is a proposal".

**Scene 2 stays** (it explains Tempo's portal); its caption changes from "not a claim that the demonstrated Sworn
verifier is connected to it" to "the same flow our own Zone's portal ran on Moderato (scene 6)".

**Scene 8 (was 7), last sentence:** "Settlement integration remains a separate Tempo proposal." →
"Integration with Tempo's own Zones remains a separate proposal."

- "Important scope" at the top: the fixture is dev chain 1337; the settlement is our own Zone on Moderato, one
  operator; Tempo's Zones are unchanged.
- Total: today's 150 s of targets + about 20 s for the new scene + 3 s in "said plainly" ≈ 173 s, under 3 min.
- **Never claim** (replace): that this protects withdrawals on Tempo's Zones; that our Zone is Tempo-created or a
  running service; that the prototype and Sworn receive the same ABI input; that Tempo is broken; or that Sworn
  has customers, revenue or a production deployment.

## Recorder and page work before re-recording

- `record-pitch.mjs`:
  - scene 3 reads `deployments/moderato.json` → `OwnZone` and checks it against Moderato: the 3 `submitBatch`
    receipts (status 1, sent to the portal, `BatchSubmitted`), the payout's `WithdrawalProcessed`, and
    `portal.verifier()` = the recorded verifier;
  - optional: the live mutation call described under scene 3;
  - replace the README check for `**The batches are not from Moderato.**`, which the README no longer says, with
    `**Our own Zone, not a Tempo-created one.**`;
  - `pitch.html` / `slides.js`: the new scene 3 and 6 pictures.
- `record-demo.mjs`:
  - the page strings it requires: "The batches are not from Moderato." → "These batches are not from Moderato.";
    "Not connected to a ZonePortal; it does not protect withdrawals today." → "These two instances are not
    connected to a ZonePortal."; data-flow "no ZonePortal calls this verifier" → "the portal calls this verifier
    before it queues a withdrawal";
  - the README check for `**The batches are not from Moderato.**`, as above;
  - the new scene: wait for `#own-zone .facts` and require "3 batches settled", "withdrawal paid", "✓ the demo
    user's 0.5 pathUSD withdrawal";
  - `demo.html`: the new scene, and the "said plainly" cards.
- The live page (`site/`) already has the `#own-zone` section (commit `0399fa7`). It must be deployed (push to
  `main`) before the demo is recorded against it.
