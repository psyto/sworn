# Adversarial review r4 — the CWF submission before the founder pastes the form (2026-10-09)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read any file and
run read-only commands (`git log`, `(cd contracts && forge test)`, `cast call` / `cast receipt` against
https://rpc.moderato.tempo.xyz, `curl` of https://psyto.github.io/sworn/ and its JS bundle, YouTube oEmbed).
Do not send transactions, push, or edit files. Answer in ≤ 1,500 words.

## Context

- Colosseum Crypto World's Fair, Tempo track; submissions close 2026-10-13 06:59 UTC. Official rules (section 8):
  Functionality, Potential Impact, Novelty, UX, Open-source, Business Plan; Tempo track = $100k across 10 products.
- Since your r3 (`docs/reviews/submission-r3.md`):
  - Videos are final and uploaded: pitch https://youtu.be/qTBetXF5SPY (1:49, re-voiced; captions
    `video/final/Sworn_Pitch_20261009.en.srt`), demo https://youtu.be/GZz52yUDJKo (1:22), check-in 4
    https://youtu.be/Dqipz1hYM04. Pitch scene 5 is 22 s. Decision: the video scripts (`video/PITCH-D.md`,
    `video/DEMO-D.md`) stay as voiced; your "sequencer set" / "verified each proof before settling" wording went to
    text surfaces only (README, page, criteria map, YouTube descriptions; commit `9cb8cfb`). Do not ask for a re-voice
    unless a voiced line is factually wrong.
  - T12 is past (commit `e5381a0`): it activated at 1791468000 as the pinned Tempo `61c979a` already knew; post-T12
    replays matched receipts (`out/t12/`); page live checks 12/12.
  - Page footer and README link the videos (commit `a9141f9`).
  - **The form draft `_submission/cwf-form.md` was rewritten from the founder's own statements**, translated and
    checked against the record (commits `20a9e1f`..`a605bd9`): the pivot account in "Anything else" (Confide carried
    over from Stocklana → Tempo on Oct 3 → Zones on Oct 4; knowledge-only prior work; recorder boilerplate from
    Confide disclosed), the founder's view that privacy and batching matter to individuals and are essential for
    businesses, Veil (`fabrknt/veil`, npm `@fabrknt/veil-core`), Superteam 3rd, ~10 h/week part-time and the 90-day
    plan, the market mechanism, proof-gated settlement with a separate payout. `scripts/cwf-form.sh` counts limits.
  - Founder's background facts: Confide repo is `/Users/hiroyusai/src/confide` (README, STATUS.md); Veil is
    `/Users/hiroyusai/src/veil`. Colosseum shows check-in updates 1 (Confide, 2026-09-21) and 3 only.

## Ground truth (flag anything that contradicts it)

Two separate results, never one causal chain: (a) a fixture proof (Tempo integration-test batch, dev chain 1337)
verified on Moderato by `SwornZoneVerifierWithdrawal` (attest tx 0xa630…f770); (b) separately, our own Zone (zone
4242, one operator, not Tempo-created) settled three proven batches through `OwnZonePortal` → its own
`SwornZoneVerifier` 0x15D1…2733, then the sequencer's `processWithdrawals` paid 0.5 pathUSD (0xfc31…e1f1); a forged,
sequencer-signed batch replaying a real proof was rejected `InvalidProof()` (0x3a15…167d). The proof is necessary,
not sufficient. Testnet, unaudited, no customers; Tempo has not adopted Sworn; spec 004 is a proposal; Tempo Zones
ship no native ZK proof today.

## What I want

1. **Verdict** vs r3, against the official rules' six criteria: where does it land and what decides it now?
2. **The form, field by field** (`_submission/cwf-form.md`): factual errors against the repo, chain and the
   founder's background repos; over-claims; contradictions between fields or with the voiced videos; disclosure
   gaps that could risk disqualification (pre-existing code, development history). These are the founder's words:
   give bullet fixes only, no rewritten paragraphs.
3. **Cross-surface consistency** after the text-only wording change: anything on the page, README or YouTube text
   that now contradicts the voiced pitch/demo or the form. Quote file:line.
4. **Ranked action list** for the last three days: Claude can do / founder must do, highest impact first.

Mark each finding BLOCKER / MAJOR / MINOR and [V] verified or [I] inferred.
