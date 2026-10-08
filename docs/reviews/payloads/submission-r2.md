# Adversarial review r2 — the whole CWF submission, with the final videos (2026-10-08)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read any file and
run read-only commands (`git log`, `cast call` / `cast receipt` against https://rpc.moderato.tempo.xyz, `curl` of
https://psyto.github.io/sworn/ and its JS bundle, `gh repo view psyto/sworn`). Do not send transactions, push, or
edit files. Answer in ≤ 1,800 words.

## Context

- Colosseum's **Crypto World's Fair (CWF), Tempo track**; submissions close 2026-10-13 06:59 UTC. Colosseum judges
  on founder–market fit, insight, product + execution, market size, founder communication, viability and traction;
  a shortlist gets a 15-minute interview. The goal is to **win the Tempo track**. Solo founder; repo started
  2026-10-03.
- **The final message** (pitch and demo, both opening lines): "Sworn is for Tempo Zones: only the operator sees
  every transaction. Sworn makes that private execution checkable." Product hypothesis: Proof Operations for a Zone
  business whose reviewer cannot reconstruct the witness; one batch tests demand; market grows with Zones ×
  batches × upgrades, only if Zones are adopted (no TAM); later beside Tempo's TEE (spec 004, a proposal).
- **Two results that must never read as one causal chain:** (a) a fixture proof (Tempo integration-test batch,
  dev chain 1337) verified on Moderato by `SwornZoneVerifierWithdrawal` 0xF2e1…BA11 (attest 0xa630…f770; the demo's
  local proof job re-proves it and verifies read-only); (b) separately, our own Zone (zone 4242, one operator, not
  Tempo-created) settled three proven batches through `OwnZonePortal` → its own `SwornZoneVerifier` 0x15D1…2733,
  then the sequencer's `processWithdrawals` paid 0.5 pathUSD (0xfc31…e1f1); a forged, sequencer-signed batch that
  replayed a real proof with a made-up queue was rejected `InvalidProof()` (0x3a15…167d, status 0). The proof is
  necessary for a payout, not a guarantee (not censorship-resistant).
- Since your r1 review (`docs/reviews/submission-r1.md`) and your later pitch/demo comments: the videos were rebuilt
  as **Pitch D** (118 s) and **Demo D** (90 s); all earlier versions were deleted; the live page, README, About,
  OG card and docs were changed today (commits `b274132`, `35852d0`, `dce729f`).
- Still pending and owned by the founder: the voice-over (Google Vids), the two public video URLs, edits to the
  form text (the form is the founder's own words), and sending outreach. Moderato's T12 hardfork activates
  2026-10-08 14:00 UTC.

## Read

1. `video/PITCH-D.md`, `video/DEMO-D.md` (narration + claims tables), and the silent videos `video/pitch-d.mp4`,
   `video/demo-d.mp4` (extract frames with ffmpeg if useful; `video/frames/demo-d-scene*.png` exist).
2. The live page https://psyto.github.io/sworn/ (source `site/src/ui/*.tsx`, `site/src/main.tsx`, `site/index.html`,
   `site/public/card.png`) and the GitHub About (`gh repo view psyto/sworn --json description,repositoryTopics`).
3. `README.md` (all), `_submission/cwf-form.md` (all fields; `scripts/cwf-form.sh` checks limits),
   `_submission/CRITERIA-MAP.md`, `_submission/INTERVIEW.md`, `_submission/team.md`, `_submission/OUTREACH.md`.
4. `docs/specs/003-zone-verifier.md` (§7 and the Results sections), `docs/specs/004-tee-plus-zk.md`,
   `deployments/moderato.json`, `video/README.md`.

## What I want

1. **Verdict first:** as a CWF Tempo-track judge, where does this land now (win / top tier / honourable mention /
   not placed), compared with your r1 verdict, and the three things that most decide it.
2. **Consistency and claims audit across every surface** (pitch, demo, page, About, OG card, README, form,
   interview, team, criteria map, specs): anything that overclaims, underclaims, merges the two results, or
   contradicts another surface or the chain. Quote it with file:line (or page text / video timestamp), say why,
   and give the fix. For the form, give the fix as bullets, not paste-ready text (the founder writes it).
3. **Pitch D and Demo D:** do they win the first 15 seconds, cover every judging criterion, and stay accurate?
   Any line a judge or Tempo engineer would challenge? Is the pace (≈ 2.2 words/s) realistic for a non-native
   speaker, and which scenes risk overrunning?
4. **What is still weakest** (likely traction) and the most effective thing to do about it in four days.
5. **Ranked action list** to submission, highest impact first, split into: Claude can do (code/docs/site), founder
   must do (voice, URLs, form wording, outreach), and needs a chain transaction (founder runs any `--send`).

Mark each finding BLOCKER / MAJOR / MINOR and [V] verified (you read the source, page or chain) or [I] inferred.
