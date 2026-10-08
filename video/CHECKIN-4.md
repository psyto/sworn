# CWF check-in 4 — Sworn (week 4)

**Window:** opens 2026-10-09 08:00 PDT, **due 2026-10-12 08:00 PDT (2026-10-13 00:00 JST)**. Prompt: *"Show what
you built, share what you learned, and explain what you'll work on next."* YouTube, Loom or Vimeo; judges must be
able to watch without requesting access. **Submitted links cannot be changed or deleted.**

**Status.** Silent picture + script + subtitles: `video/checkin-4.mp4`, built by `record-checkin-4.mjs` from Demo D's
verified source clips (`video/takes/demo-c/`) and two cards in `demo.html`. Narration: the founder's own words; edit
scene 2 ("what I learned") to say it as you would. Keep it under one minute.

| scene | target | picture |
|---|---:|---|
| 1 What I built | 25 s | own-Zone section of the page, the payout on Tempo's explorer, the forged batch's failed trace (own-Zone scope label throughout) |
| 2 What I learned | 15 s | card |
| 3 What's next | 10 s | card with the repo and page |

## Scene 1 — what I built · ≈ 25 s

> Sworn makes private Tempo Zone execution checkable. Since my last check-in, it went from a test batch to a live run on our own Zone: on Moderato, the portal settled three batches only after the proof passed, and our sequencer paid a withdrawal. A forged batch, signed by our own sequencer, was rejected on chain.

## Scene 2 — what I learned · ≈ 15 s

> What I learned: the proof is necessary, not sufficient; our sequencer still pays. And the hard part isn't proving. It's whether a Zone business's reviewer will pay for evidence it can check.

## Scene 3 — what's next · ≈ 10 s

> Next: one design partner supplies a batch, and its reviewer decides. Everything is re-runnable from the repo.

## Claims and sources

Same as `DEMO-D.md` → OwnZone result and rejection result: our own Zone (zone 4242, one operator, not
Tempo-created); three `submitBatch` receipts, the payout `0xfc31…e1f1` (0.5 pathUSD, by the sequencer's
`processWithdrawals`), the forged batch `0x3a15…167d` (status 0, `InvalidProof()`); all re-read by the recorder.
The "test batch" is the earlier fixture proof (Tempo integration test, dev chain 1337), named only as the starting
point, not as the cause of the payout. No customer, design partner or Tempo adoption is claimed.
