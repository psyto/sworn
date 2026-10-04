# Adversarial review — Sworn video scripts (pitch ≤2 min, demo ≤3 min)

Read-only. Break these scripts before the founder records them in his own voice; a recorded sentence
cannot be taken back. Working directory: /Users/hiroyusai/src/sworn.

Read `video/PITCH.md` and `video/DEMO.md` (each ends with a claims→source table), then verify every
spoken sentence against the cited source: `README.md`, `deployments/moderato.json`,
`out/e2e/moderato-20261003T064745Z.log`, `out/e2e/moderato-20261003T064745Z-honestReverts-recheck.log`,
`out/ac2_run.log`, `out/e2e/localnet-full-gate.log`, `contracts/src/Sworn.sol`, `sdk/src/index.ts`,
`patches/tempo.patch`, `tempo/crates/precompiles/src/tip20/mod.rs`, and the vendored Tempo/zones code where
cited. External sources you cannot open (mpp.dev, ethglobal.com, zones repo on GitHub): say "unverified"
rather than assume.

Context (fixed): Colosseum Crypto World's Fair, Tempo track; judges are not from Tempo; general rubric
(functionality, impact/TAM, novelty, UX, open-source, business plan). Moderato testnet only. Solo founder.
Traction zero. The first 60 s of the demo must stand alone.

Find:
1. Any sentence that overclaims, is unsupported, or is subtly false (e.g. "Tempo's team hasn't shipped that
   as a proving guest yet" — is that precisely what the zones source says? "matches the live chain on forty
   of forty" — what exactly did AC-2 compare? "the proof checks out on-chain" vs what Sworn.sol does; "seven
   minutes"; "three hundredths of a cent" — recompute from the receipt formula; "saved the chain's own
   state proofs within seconds").
2. Anything a judge will misunderstand in the first 60 s of the demo, or that the screen notes cannot
   actually show (e.g. does the demo app, as built in `demo/`, show what Scene 1 describes on Moderato?
   check `demo/src/pages/Wallet.tsx` and the backend).
3. The weakest point a non-Tempo judge hits first in the pitch, and the one change that most improves it.
4. Word counts vs time limits (≈2.2 words/s).

Cite file:line. Classify BLOCKER / MAJOR / MINOR. End with exactly one line:
`VERDICT: APPROVE` or `VERDICT: CHANGES`.
