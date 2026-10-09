# Adversarial review r6 — docs brought to 2026-10-09 (final pre-submission pass)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read any file and
run read-only commands. Do not send transactions, push, or edit files. If the sandbox has no network, say so and mark
such checks [I]. Answer in ≤ 1,000 words.

## Since your r5 (`docs/reviews/submission-r5.md`)

- `e01cf3f`: Zones "settle to Tempo in batches" (your r5 thesis-lead finding) on the page hero, README and the pitch's
  YouTube description. The founder posted the X post with your r5 edits and pasted the form; the form in Colosseum
  now matches `_submission/cwf-form.md` field by field (still a draft until the founder submits).
- `afbaf97`: docs updated to 2026-10-09 —
  - README: status line (re-checked after T12), check-in 3/4 links, the fast path's payout as a separate sequencer
    action, Veil under "Who", and a new "History of this entry" paragraph (Confide → Tempo Oct 3 → Zones Oct 4; no
    Confide product code; recorder boilerplate) meant to match the form's "Anything else" and repo-context fields.
  - `_submission/INTERVIEW.md` Q12 (Veil), Q13 (~20 h/week), Q25 (Confide history).
  - `_submission/OUTREACH.md` (X post sent; DMs not), `_submission/CRITERIA-MAP.md` (Veil; founder's thesis),
    `_submission/cwf-form.md` header, `video/README.md` (uploaded URLs; separate payout).
- `51e4e15`: README diagram 3's Mermaid note had a semicolon that broke GitHub's render; replaced with ", and". All
  three README diagrams now render with `@mermaid-js/mermaid-cli`.

Background repos for disclosure facts: `/Users/hiroyusai/src/confide` (README, STATUS.md), `/Users/hiroyusai/src/veil`.

## Ground truth

As in r4/r5. Videos are final and voiced; do not ask for a re-voice unless a voiced line is factually false. The
Zcash comparison stays narrow.

## What I want

1. **The new and changed text in `afbaf97` and `e01cf3f`:** factual errors (dates, repo facts, Confide/Veil claims,
   video URLs and lengths), over-claims, and anything that now contradicts the form, the page, the voiced videos or
   the specs. Quote file:line; give the minimal fix.
2. **Disclosure parity:** do README "History of this entry", INTERVIEW Q25 and the form's "Anything else" and
   repo-context fields say the same thing about pre-existing work? Anything a judge could read as concealment?
3. **Markdown/Mermaid hygiene across README and docs:** anything else that will not render on GitHub (Mermaid
   syntax, broken relative links, anchors).
4. **Anything still BLOCKER or MAJOR before the founder submits.** If none, say so plainly.

Mark each finding BLOCKER / MAJOR / MINOR and [V] verified or [I] inferred.
