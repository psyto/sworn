# Adversarial review — the whole CWF submission, after the own-Zone live run (2026-10-06)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read any file and
run read-only commands (`git log`, `cast call` / `cast receipt` against https://rpc.moderato.tempo.xyz, opening
https://psyto.github.io/sworn/). Do not send transactions, push, or edit files. Answer in ≤ 1,500 words.

## Context

- Colosseum's **Crypto World's Fair (CWF), Tempo track**. Judges read as investors and as technical reviewers.
  The goal is to **win the Tempo track** (and place as high as possible overall). Solo founder, part-time,
  repo started 2026-10-03.
- Product: **Sworn — audit-ready evidence for private Tempo execution.** Tempo Zones' own batch verifier
  (`zone_spf::prove_zone_batch`) runs inside SP1; a Groth16 proof bound to `IVerifier`'s inputs is verified by
  `SwornZoneVerifier` on Moderato. Commercial hypothesis: Proof Operations for Zone businesses (per-batch proving
  plus upgrade maintenance). No customers, revenue or design partner.
- **New since your last reviews (2026-10-06):** our own Zone on Moderato (zone 4242, `OwnZonePortal`
  `0xE4818EC6…daE3`, deployed outside Tempo's factory) called a third `SwornZoneVerifier` (`0x15D192a0…2733`,
  parent chain 42431) in every `submitBatch`. Three Groth16-proven batches settled with direct EIP-2935 anchors,
  then `processWithdrawals` paid the user 0.5 pathUSD (`WithdrawalProcessed`, tx `0xfc311841…e1f1`), 58.5 min after
  the anchor. One operator; not a Tempo-created Zone; the Zone was stopped after the payout.
- Still pending: the founder's voice on the two silent videos, and their public URLs in the form.

## Read

1. `README.md` (all), `_submission/cwf-form.md` (all fields; limits are checked by `scripts/cwf-form.sh`),
   `_submission/CRITERIA-MAP.md`, `_submission/INTERVIEW.md`, `_submission/team.md`.
2. `video/PITCH.md` (v5.4, ≤ 118 s) and `video/DEMO.md` (v5.5, ≤ 180 s), with `video/frames/pitch-scene*.png` and
   `video/frames/demo-scene*.png` (the last frame of each scene of the recorded silent videos).
3. `docs/specs/003-zone-verifier.md` (§3–§7 and every Results section, especially "Results (own Zone live run on
   Moderato)"), `docs/specs/004-tee-plus-zk.md` (§6), `deployments/moderato.json` (`OwnZone`,
   `SwornZoneVerifierWithdrawal`, `SwornZoneVerifier`).
4. `spikes/own-zone/FEASIBILITY.md` (verdict, C1–C5, §7 risks, "Live run"), `spikes/own-zone/DRESS.md`.
5. The live page https://psyto.github.io/sworn/ (or `site/src/ui/*.tsx`), and your earlier reviews in
   `docs/reviews/` (pitch, demo, positioning, strategy) — check that what you flagged then is still fixed.

## What I want

1. **Verdict first:** if you were a CWF Tempo-track judge, where does this land (win / top tier / honourable
   mention / not placed), and the three things that most decide it.
2. **Claims audit.** Every statement on every surface (README, page, form, pitch, demo, interview) that overclaims,
   underclaims or contradicts another surface or the chain. Quote it, give the file and line, say why, and give the
   exact replacement. In particular:
   - "proof-gated settlement" / "the portal pays a withdrawal only after Sworn's proof passes" — is that exactly
     what the code and the receipts show? (`OwnZonePortal` is upstream `ZonePortal` plus a deployer-only
     `initialize`; withdrawals are ZK-gated but not censorship-resistant; one sequencer key also decrypts deposits.)
   - Is "our own Zone, not a Tempo-created one" disclosed early and often enough that no judge feels misled — or is
     it now so prominent that it undersells what was built?
   - The fixture story (dev chain 1337) and the own-Zone story side by side: is it clear which proves what?
   - Re-verify the key numbers against the chain yourself: the three `submitBatch` receipts and blocks, the anchor
     ages (2,895 / 3,928 / 5,133 of 8,190), the payout, `portal.verifier()`, and the verifier's immutables.
3. **Technical depth, as a skeptical engineer would probe it:** what is genuinely novel versus wrapping existing
   tools (SP1, Tempo's own code)? What would you attack in the 15-minute interview? Are the answers in
   `INTERVIEW.md` good enough — which are weak, and what should they say?
4. **Investor lens:** market (Tempo's factory Zones have one effective operator), buyer, GTM test, "why now",
   why this founder. What is the single weakest part of the business case, and how should the submission handle
   it in the time left (days, not weeks)?
5. **Pitch and demo:** with the narration in `PITCH.md` / `DEMO.md` and the frames, is the order right for judges
   who watch the pitch first? Does the pitch spend its 117 s on what wins? Name cuts and additions, with words,
   within the time limits.
6. **Ranked action list** for the remaining days before submission: what to change, where, and why — highest
   impact on winning first. Mark anything that would need new chain transactions or a re-run (the founder runs
   all `--send` steps; Claude never sends).

Mark each finding BLOCKER / MAJOR / MINOR and [V] verified (you read the source or the chain) or [I] inferred.
