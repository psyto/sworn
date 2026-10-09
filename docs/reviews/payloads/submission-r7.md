# Adversarial review r7 — the page hero, the TEE-vs-ZK framing, and what was posted (2026-10-10)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read any file and
run read-only commands. Do not send transactions, push, or edit files. If the sandbox has no network, say so and mark
such checks [I]. Answer in ≤ 1,000 words.

## Since your r6 (`docs/reviews/submission-r6.md`, no BLOCKER/MAJOR)

1. **Page hero only** (commit `996be26`, `site/src/ui/sections.tsx` Hero + ReviewGap lead, `site/src/ui/styles.css`,
   `site/src/ui/OwnZone.tsx`): shorter lead ending on "But then who can check a private batch?"; CTAs "Watch the
   1:49 pitch ↗" (YouTube) and "Verify on chain ↓" (scrolls to `#own-zone`); stats as 3 / 1 / 1 rows; the scope note
   is now one small uppercase line; the Zone visibility details moved into the ReviewGap lead. Nothing below the hero
   changed. Your r6 MINOR on "settle to Tempo in batches" was not applied: our own Zone's records show batches
   without withdrawals (zone blocks 1–51, 52–55) settling through `submitBatch`, so batches settle Zone state, not
   only withdrawals — challenge this if you think it is wrong.
2. **Founder's view on TEE vs ZK** (commit `5bf4efe`): Nitro rightly carries fast withdrawals; because Zones settle
   in batches, a per-operator ZK check can run on the operator's own schedule (audit, counterparty, after an upgrade)
   where latency matters less than cost per batch. Added to `_submission/INTERVIEW.md` Q19 and to the GitHub issue.
3. **Posted publicly** (all logged in `_submission/OUTREACH.md`):
   - GitHub issue https://github.com/tempoxyz/zones/issues/1685 — the text is `_submission/OUTREACH.md` section 1
     (title + body), filed as a Feature request (blank issues are disabled), with "Additional context" naming
     `succinctlabs/rsp` and Succinct's OP Succinct as prior art.
   - Arena Builder Update (looking for testers), X posts in English and Japanese, a Fabrknt quote post — all
     short, testnet/unaudited stated, the Zcash comparison kept to one point.
4. Colosseum still reports the project as `draft`; the founder is confirming the final Submit.

## Ground truth

As in r4–r6. Videos are final and voiced. The Zcash comparison stays narrow.

## What I want

1. **The hero:** any over-claim or lost boundary now that the scope note is one small line? Does any hero sentence
   contradict the sections below, the README, the form or the voiced videos? Is "Verify on chain ↓" → `#own-zone`
   honest about what the reader will find? Quote file:line; minimal fixes.
2. **The issue text (section 1 of `_submission/OUTREACH.md`)**, now public: factual errors, over-claims, or anything
   a Tempo Zones engineer would correct (Nitro as "the path for fast withdrawals", "Zones settle in batches",
   12–15 min proving, "its own instance of that verifier", the three questions). The founder can still edit the issue.
3. **INTERVIEW Q19's new bullet:** accurate and consistent with spec 004 and Q17?
4. **Anything BLOCKER or MAJOR before the deadline** (2026-10-13 06:59 UTC). If none, say so plainly.

Mark each finding BLOCKER / MAJOR / MINOR and [V] verified or [I] inferred.
