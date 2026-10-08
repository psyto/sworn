# Adversarial review r3 — the whole CWF submission after the privacy re-framing (2026-10-08)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read any file and
run read-only commands (`git log`, `(cd contracts && forge test)`, `cast call` / `cast receipt` against
https://rpc.moderato.tempo.xyz, `curl` of https://psyto.github.io/sworn/ and its JS bundle, `gh repo view psyto/sworn`).
Do not send transactions, push, or edit files. Answer in ≤ 1,500 words.

## Context

- Colosseum Crypto World's Fair, Tempo track; submissions close 2026-10-13 06:59 UTC. Category: Developer
  Infrastructure. Judges score founder–market fit, insight, product + execution, market size, communication,
  viability, traction; a shortlist gets a 15-minute interview.
- Since your r2 (`docs/reviews/submission-r2.md`) and your reviews `pitch-privacy-r1.md` and `pitch-future-r1.md`:
  - Pitch D scenes 1–2 rebuilt around "Private execution. Checkable validity." with a narrow Zcash comparison
    (`video/PITCH-D.md`, `video/pitch-d.html`, silent `video/pitch-d.mp4`; the founder will re-voice scenes 1–2).
    Scene 5 unchanged (no roadmap line, per your advice).
  - Demo D unchanged except the earlier fixes (narrated final in `video/final/`, untracked; check it only if useful).
  - Check-in 4 (week 4 progress report): `video/CHECKIN-4.md`, `video/checkin-4.mp4`.
  - Live page, README, About and OG card now lead with the tagline; a short "Like Zcash? Only in one way." note sits
    in the README and the page's data-flow section; interview Q17 and Q20–Q25 added; outreach updated
    (commits `245c34b`, `dafd404`, `8d03b08`).
  - YouTube titles/descriptions/chapters: `video/YOUTUBE.md`.
- Founder-owned and not yet done: the form text (`_submission/cwf-form.md` is the founder's draft: disclosure of
  pre-existing code, the Why field that still joins the two results, "64" tests, missing prizes/why-now/market
  mechanism), the re-voice of pitch scenes 1–2, video URLs, sending outreach. Moderato's T12 activates
  2026-10-08 14:00 UTC.

## Ground truth (flag anything that contradicts it)

Two separate results, never one causal chain: (a) a fixture proof (Tempo integration-test batch, dev chain 1337)
verified on Moderato by `SwornZoneVerifierWithdrawal` 0xF2e1…BA11 (attest tx 0xa630…f770); (b) separately, our own
Zone (zone 4242, one operator, not Tempo-created) settled three proven batches through `OwnZonePortal` → its own
`SwornZoneVerifier` 0x15D1…2733, then the sequencer's `processWithdrawals` paid 0.5 pathUSD (0xfc31…e1f1); a forged,
sequencer-signed batch replaying a real proof was rejected `InvalidProof()` (0x3a15…167d, 2026-10-07). The proof is
necessary, not sufficient; no data-availability, liveness or censorship-resistance guarantee. Testnet, unaudited,
no customers; Tempo has not adopted Sworn; spec 004 is a proposal; Tempo Zones ship no native ZK proof today.
Zones: users see their own activity; the operator's sequencer set sees everything; the public sees none.

## What I want

1. **Verdict** vs r2: where does it land now and what decides it?
2. **Consistency and claims audit across every surface** (pitch D new scenes 1–2 and the rest, demo D, check-in 4,
   page, About, OG card, README, specs, interview, outreach, YouTube text, criteria map). Quote with file:line,
   say why, give the fix. For the form (founder's words) give bullet fixes only, and list which earlier form
   issues are still open.
3. **The privacy framing:** does "Private execution. Checkable validity." plus the Zcash comparison now make Sworn
   click for a non-Tempo judge without over-claiming? Any line that still reads as "Zcash for Tempo", "the proof
   pays", or "Sworn protects Tempo's Zones"?
4. **Pitch D as a whole** with the new scenes 1–2: flow, pacing (≈ 2.2 words/s; silent cut 123 s, must be ≤ 120 s
   after the voice edit), and any line a Tempo engineer would challenge.
5. **Ranked action list** to submission: Claude can do / founder must do / needs a chain transaction (founder runs
   any `--send`), highest impact first.

Mark each finding BLOCKER / MAJOR / MINOR and [V] verified or [I] inferred.
