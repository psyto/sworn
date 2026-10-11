# Review landing-r4 — the new "Use Sworn" call to action (2026-10-11)

Read-only: do not edit files, push or send transactions. Working directory: /Users/hiroyusai/src/sworn. ≤ 600 words.

Since your landing-r3 (both MAJORs fixed as you proposed; a one-line proof strip added under the hero buttons), the
founder noted that neither page tells an interested visitor what to do next. Added, uncommitted on branch
`landing-page` (`git diff`, `git status`):
- `site/src/ui/sections.tsx` `UseSworn` (replaces `ClosingCta`; placed before the FAQ): three paths —
  Zone operators ("Prove one of your batches": request via a GitHub issue form, X @psyto, Telegram @psyto69),
  reviewers (`git clone … && cd sworn/contracts && forge test --match-test OWNZONE`), builders (fetch/build/
  `scripts/zone-prove.sh <verifier>`, "about 12 minutes, about 18 GB RAM").
- Hero second button changed from "Re-check it on chain ↓" to "Prove one of your batches ↓" (#use); the proof strip
  still links to the evidence.
- New `.github/ISSUE_TEMPLATE/request-batch-proof.yml`.

Check, [V]/[I], file:line, BLOCKER/MAJOR/MINOR, minimal fixes:
1. Does any CTA over-promise a service that does not exist (hosted, self-serve, mainnet, price, timelines)? Is
   "pinned to one Tempo Zones version; a newer one may need porting" accurate?
2. Do the reviewer and builder commands work from a fresh clone as written (vendored forge-std? does OWNZONE check
   against the real SP1 verifier as claimed? does zone-prove.sh need other prerequisites — docker, SP1 toolchain,
   a deployed verifier — that the card should name?) Is "about 12 minutes, about 18 GB RAM" supported?
3. The issue template: safe (warns not to post witness/private data), coherent, valid GitHub issue-forms YAML?
4. Anything that would make a judge trust it less. If shippable, say so plainly.
