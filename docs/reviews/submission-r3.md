## Verdict

**Up from r2: shortlist-capable technical submission, not yet a likely track winner.** The privacy reframe now makes the product legible: private execution creates a review gap; Sworn supplies checkable batch validity. The two on-chain results are now usually kept separate.

What decides it now: (1) submit the current—not superseded—videos, (2) eliminate the last “the proof pays/protects” readings, and (3) get one real external demand signal. Technical execution is strong; native Tempo adoption and traction remain unproven.

`[V]` below is verified from local sources/artifacts. DNS prevented live GitHub, site, and Moderato checks; `forge test` could not start because Foundry needs to write its cache in this read-only sandbox.

## Findings

- **BLOCKER [V] — The upload instructions point to obsolete narrated assets.** [YOUTUBE.md:3](/Users/hiroyusai/src/sworn/video/YOUTUBE.md:3) says upload `video/final/Sworn_Pitch_20261007.mp4`; its subtitles contain the old opening and the inaccurate “only the proof and public batch data cross” claim ([subtitle:27](/Users/hiroyusai/src/sworn/video/final/Sworn_Pitch_20261007.en.srt:27)). It does not contain the new Zcash framing. The current silent pitch is 123.0 s; the old final is 112.76 s.

  Fix: re-voice/render scenes 1–2, regenerate the final pitch, subtitles, and YouTube description/chapters from that exact file. Do not upload the current `video/final` pitch by accident. Form video fields remain placeholders ([cwf-form.md:122](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:122), [:140](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:140)); site links are `null` ([sections.tsx:57](/Users/hiroyusai/src/sworn/site/src/ui/sections.tsx:57)).

- **MAJOR [V] — The live-page data-flow still falsely says “Only hashes cross this line.”** [sections.tsx:157-162](/Users/hiroyusai/src/sworn/site/src/ui/sections.tsx:157) and [:181](/Users/hiroyusai/src/sworn/site/src/ui/sections.tsx:181). A proof and public batch fields/metadata cross too; the surrounding prose is more accurate ([218-226](/Users/hiroyusai/src/sworn/site/src/ui/sections.tsx:218)).

  Fix: “Proof + public commitment / batch metadata cross; witness and transaction contents do not.” This is the remaining r2 privacy-boundary defect.

- **MAJOR [I] — Several ending/result lines still invite “the proof pays.”** Pitch Scene 4 says the portal settled “only after the proof passed, and our sequencer paid a withdrawal” ([PITCH-D.md:24](/Users/hiroyusai/src/sworn/video/PITCH-D.md:24)); Demo’s final line says the withdrawal was paid “only after the proof passed” ([DEMO-D.md:59](/Users/hiroyusai/src/sworn/video/DEMO-D.md:59)); the criteria map and outreach repeat that construction ([CRITERIA-MAP.md:23](/Users/hiroyusai/src/sworn/_submission/CRITERIA-MAP.md:23), [OUTREACH.md:33-42](/Users/hiroyusai/src/sworn/_submission/OUTREACH.md:33)).

  The demo’s preceding “our sequencer, not the proof” line is good, but the final recap undoes it. Fix every recap to: proof-gated settlement occurred; then the sequencer separately called `processWithdrawals`. Keep “necessary, not sufficient / not censorship-resistant” in the visible final scope.

- **MAJOR [I] — YouTube demo title can imply a Tempo-created Zone.** [YOUTUBE.md:54](/Users/hiroyusai/src/sworn/video/YOUTUBE.md:54): “our own Tempo Zone.” The body is precise, but titles are read in isolation.

  Fix: say “our own non-factory Zone on Moderato,” or omit “Tempo” from the title and retain it in the description.

- **MINOR [V] — “Operator” collapses the sequencer set.** Pitch and demo both say “only the operator sees every transaction” ([PITCH-D.md:12](/Users/hiroyusai/src/sworn/video/PITCH-D.md:12), [DEMO-D.md:27](/Users/hiroyusai/src/sworn/video/DEMO-D.md:27)). Ground truth is users see their own activity; the operator’s sequencer set sees all; public sees none.

  The rendered new Pitch Scene 1 card is better because it names users/public. Use “operator’s sequencer set” once in narration or a subtitle. Interview Q24 already has the needed answer.

- **MINOR [V] — Check-in 4 understates measured proving time.** “Up to half an hour” ([CHECKIN-4.md:34](/Users/hiroyusai/src/sworn/video/CHECKIN-4.md:34)) conflicts with the documented 1,881 s first proof / 11–31 minutes ([003-zone-verifier.md:452-454](/Users/hiroyusai/src/sworn/docs/specs/003-zone-verifier.md:452)). Use “up to about 31 minutes.”

- **MINOR [I] — README still makes the project feel bifurcated.** The bonded-answers experiment is clearly disclaimed, but it still occupies the fast-path narrative ([README.md:28-50](/Users/hiroyusai/src/sworn/README.md:28)). Move it below reproduction material or into a historical link.

The specs are unusually careful: spec 003 distinguishes the fixture and own-Zone run, and spec 004 repeatedly calls Tempo integration a proposal. Interview Q20–25 and the OG card are also aligned. I could not inspect the deployed About/live page rather than their local source due DNS.

## Privacy framing and Pitch D

**Yes, it now clicks for a non-Tempo judge.** “Private execution. Checkable validity.” is much better than leading with SP1. The rendered Scene 2 explicitly says “used differently” and “operator still sees Zone activity,” so it avoids “Zcash for Tempo” visually.

Audio-only listeners still hear Zcash before the operator limitation. Put the on-screen qualifier into the re-voice if possible: Sworn proves batch-execution validity, not shielded transfers; the operator still sees activity.

Pitch pacing: 247 script words. At 120 s that is **2.06 words/s**, below the ≈2.2 target. The 123 s silent cut is noncompliant; trim three seconds of holds, not delivery speed. Scene 6 is the most pronunciation-dense. Scene 5 remains appropriately conditional; do not add a roadmap list.

A Tempo engineer’s likely challenge is the time-sensitive “Zones ship no native ZK proof today” ([PITCH-D.md:20](/Users/hiroyusai/src/sworn/video/PITCH-D.md:20)), not because it contradicts supplied ground truth, but because T12 changes today. Re-run read-only RPC checks before upload and retain a dated scope if anything changed.

## Form: fixes only

- Split the “Why” field’s line 46 into two non-causal results: fixture proof verified on Moderato; separately, own Zone proof-gated settlement and later sequencer payout.
- Correct the 64/67 Forge-test contradiction ([cwf-form.md:116](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:116), [:169](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:169)); README currently says 67.
- Disclose pre-existing/upstream inputs precisely: Tempo/Zones source and patches, unmodified SP1 contracts, and that prior Reckn design experience contributed no code.
- Make the why-now hypothesis and market mechanism explicit rather than relying on “testnet before workflow is entrenched.”
- Ensure founder credentials/prizes are complete and consistently scoped.
- Replace both URL placeholders and check public logged-out playback.

Earlier form issues still open: disclosure, joined-results wording, test count, missing/weak why-now and market mechanism, missing final video URLs, and unsent outreach/zero traction.

## Ranked actions

| Priority | Claude can do | Founder must do | Chain transaction |
|---|---|---|---|
| 1 | Preflight subtitles, descriptions, links, and claim consistency. | Re-voice/render current pitch; upload both videos; fill form/site URLs; test logged out. | None. |
| 2 | Fix public-data diagram and “proof pays” recap language. | Approve form wording in own voice. | None. |
| 3 | Prepare outreach tracking and exact evidence links. | Send targeted outreach; report replies honestly. | None. |
| 4 | Run post-T12 read-only verification checklist. | Run it against Moderato before submission. | None unless evidence is actually invalidated; do not spend deadline time redeploying preemptively. |