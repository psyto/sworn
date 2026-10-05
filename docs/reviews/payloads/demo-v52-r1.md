# Review — demo v5.2 + local Operator Console, after Claude's fixes (read-only)

Read-only; do not edit, transact, deploy or publish. Working directory: /Users/hiroyusai/src/sworn.
Read: `video/DEMO.md`, `video/demo.html`, `video/scenes/demo/NARRATION.md`, `video/demo.srt`, `operator/server.mjs`,
`docs/operator-console.md`, `site/src/ui/Zone.tsx`, `video/frames/demo-scene1..6.png` if you can view images,
`_submission/CRITERIA-MAP.md` (never-claim list), `README.md` (scope sections). `git show HEAD` shows the fixes just
made: fictional operator name removed and an on-screen "illustration" tag on authored scenes; sidebar no longer mixes
Moderato's Zone 1 with the fixture; "Batch 006" renamed; non-functional nav removed; "settlement counterparty"
removed; server rejects non-loopback Host and cross-site Origin and requires an X-Sworn-Operator header to start a job.
Answer in ≤ 600 words.

1. Did each fix land correctly, and did it introduce anything new?
2. Anything in the demo (picture or narration) that still overstates: implies a real operator/customer, a hosted
   service, settlement integration, withdrawal protection, a Moderato Zone batch, or "the same input" as the pre-T13
   verifier?
3. Server: any remaining way for another site or process to start a job, accept arbitrary input, or send a transaction?
   Is the worker's failure handling honest in the UI?
4. Is the demo ready for the founder to narrate? If not, the smallest fixes.

BLOCKER / MAJOR / MINOR with file:line. End with exactly one line: `VERDICT: READY` or `VERDICT: CHANGES`.
