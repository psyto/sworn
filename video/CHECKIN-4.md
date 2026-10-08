# CWF check-in 4 — Sworn (week 4 progress report)

**Window:** opens 2026-10-09 08:00 PDT, **due 2026-10-12 08:00 PDT (2026-10-13 00:00 JST)**. Prompt: *"Show what
you built, share what you learned, and explain what you'll work on next."* YouTube, Loom or Vimeo; judges must be
able to watch without requesting access. **Submitted links cannot be changed or deleted.**

**Status.** Silent picture + script + subtitles: `video/checkin-4.mp4`, built by `record-checkin-4.mjs` from Demo D's
verified source clips (`video/takes/demo-c/`) and three cards in `demo.html`. It is a dated progress report: last
check-in → this week, day by day, on real screens; then what I learned and dated next steps. Narration: the
founder's own words; edit scene 4 ("what I learned") to say it as you would. Keep it under one minute.

| scene | target | picture |
|---|---:|---|
| 1 Last check-in → this week | 11 s | card: where it stood, where it is now |
| 2 Oct 6 and Oct 7, on chain | 14 s | own-Zone payout on the page and explorer, then the forged batch's failed trace, each with its date |
| 3 Oct 7–8, re-checkable | 7 s | terminal: export the live verify calls, forge test 3/3 PASS |
| 4 What I learned | 15 s | card |
| 5 Next, with dates | 11 s | card |

## Scene 1 — last check-in → this week · ≈ 11 s

> Week four of Sworn, for Tempo Zones. Last check-in, a test batch's proof was verified on Moderato. This week: settlement on our own Zone.

## Scene 2 — Oct 6 and Oct 7, on chain · ≈ 14 s

> October sixth: our own Zone's portal settled three proven batches, then our sequencer paid a withdrawal. October seventh: a forged batch, signed by our sequencer, was rejected on chain.

## Scene 3 — Oct 7–8, re-checkable · ≈ 7 s

> Then I made the live proofs re-checkable by anyone, with one test command.

## Scene 4 — what I learned · ≈ 15 s

> What I learned: on a live Zone, proving takes up to half an hour a batch, so the proof sits on the settlement path. It's necessary, not sufficient: the sequencer still pays.

## Scene 5 — next, with dates · ≈ 11 s

> Next: this week I ask Zone builders and reviewers if they need this. I submit October thirteenth, then look for one design partner's batch.

## Claims and sources

- "This week: settlement on our own Zone" means our own Zone (zone 4242, one operator, not Tempo-created), not the test batch: the
  test batch is the earlier fixture proof (Tempo integration test, dev chain 1337) and is named only as the starting
  point. Screens label the own-Zone scope throughout.
- Oct 6: `deployments/moderato.json` → `OwnZone`: three `submitBatch` receipts, payout `0xfc31…e1f1` by the
  sequencer's `processWithdrawals` (0.5 pathUSD). Oct 7: `OwnZone.forgedBatch` `0x3a15…167d`, status 0,
  `InvalidProof()`. All re-read by the recorder.
- Re-checkable: `spikes/own-zone/scripts/export-vectors.mjs` and `forge test --match-test OWNZONE` (3/3 pass),
  recorded live in the terminal clip.
- Proving time: 11–31 min per proof in the live run (README "What is measured"; spec 003 Results).
- Outreach is a plan, not a result: no reply, partner or customer is claimed.
