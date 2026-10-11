# Adversarial review landing-r1 — should the page become a landing page, and is the proposed hero honest? (2026-10-11)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read any file and
run read-only commands. Do not send transactions, push, or edit files. If the sandbox has no network, say so and mark
such checks [I]. Answer in ≤ 1,000 words.

## Context

Since your r7 (`docs/reviews/submission-r7.md`, no BLOCKER/MAJOR), nothing in the repo changed except the X metrics
line in `_submission/OUTREACH.md`. Deadline: 2026-10-13 06:59 UTC (~1.5 days). Solo, part-time founder. Videos are
final and voiced; the page (`https://psyto.github.io/sworn/`, source `site/src/`) is the form's "Live product link".

The founder compared the page with two other CWF Tempo-track entries and finds both far clearer as landing pages.
Sworn's page reads as a product explanation / spec, not a landing page. Observed in a browser today (you cannot load
them; treat as given):

- **Billet** (billet-zec.vercel.app, Zcash + Tempo tracks): H1 "Private invoice. Public payment. One link."; one-line
  mechanism; CTAs "Write an invoice" / "See a live billet"; right of the fold a real invoice card, checked in the
  reader's browser against both chains; then Write → Seal → Pay → Prove; a private-vs-public table; a plain FAQ that
  holds the caveats; a closing CTA.
- **colosseum2026** (colosseum2026.vercel.app/tempo, ZK compliance pool on Tempo + Solana): H1 "Private payments that
  keep the issuer's rules"; sub "Tempo has compliance without privacy. Solana has privacy without compliance. One
  zero-knowledge proof closes both gaps."; the page *is* the app: 3 numbered steps to try it with a throwaway wallet.

Sworn today (`site/src/main.tsx` order): Hero (H1 "Private execution. Checkable validity.", lede with "operator-supplied
batch", CTAs "Watch the 1:49 pitch ↗" / "Verify on chain ↓", a 3/1/1 stats card with caveats, a mono scope line) →
ReviewGap → ProofFlow → OwnZone (the live re-verify) → DataFlow → Zone fixture evidence → OperationsTest (business
hypothesis). Sworn is B2B infra, so there is no "try it as a user" action; the closest "magic moment" is the live
re-verify, currently in section 4.

## Proposed change (not yet implemented)

Only the hero and the section order; the evidence components (`Zone.tsx`, `OwnZone.tsx`) and chain logic unchanged.

- **H1:** "Prove a private ledger is right. Without showing it."
- **Sub:** "Tempo Zones keep transactions private, so only the operator can see the ledger. Sworn proves each batch ran
  correctly, and anyone can check it on chain."
- **CTAs:** "Verify a private batch now" (runs the existing own-Zone live verify in place) / "Watch the 2-min pitch".
- **Right of the fold:** replace the 3/1/1 stats card with the live verify result card: ✓ for the real batch's proof,
  and ✗ for the forged batch (tx `0x3a15…167d`, status 0), Billet-style.
- **Below:** ProofFlow (3 steps) → DataFlow (private vs public) → OwnZone + Zone evidence → a short
  "What is live / what is not yet" table that absorbs the current mono scope line → OperationsTest.

The same framing went out today in an X post (already posted, cannot be edited):

```
Bitcoin: anyone can verify, because anyone can see.
Zcash: anyone can verify, even though no one can see.
Private ledgers: only the operator can see.

So who verifies?

Private ledgers are coming, and they should. People and businesses need privacy.
But when only the operator can see the ledger, only the operator can say it's correct.

I spent 15 years building banking systems. Bank or not, anyone holding other people's money owes proof the books are right.
Not "trust me." Proof.

Zcash showed zero knowledge can do this for a transaction.
I've been trying it for a whole batch on Tempo Zones (testnet). Two minutes ↓
```

## What I want

1. **Is the redesign worth it now?** Given ~1.5 days, a part-time founder, outreach still unsent and Submit still to
   press: does a landing-page rewrite of the hero move judging (communication, product) enough to justify the risk?
   Does it create a mismatch with the voiced demo video, which may show the current page? Check what the demo and
   pitch scripts show of the page (`video/`, `docs/`, `_submission/`). Recommend: do it / do a smaller version / skip.
2. **Over-claims in the proposed copy.** Each against the code, README, form and specs:
   - "Prove a private ledger is right" vs what the proof actually establishes (one batch's execution per
     `prove_zone_batch`, bound to IVerifier inputs).
   - "only the operator can see the ledger" vs the README ("users see their own activity; the operator's sequencer
     set sees every transaction").
   - "Sworn proves each batch" — true only for our own Zone; Tempo's Zones are not proven by Sworn.
   - "anyone can check it on chain" and "Verify a private batch now": what exactly does the in-page check do
     (`site/src/chain/ownZone.ts` `verifyOwnZoneNow`)? Is "verify a private batch" an honest name for it?
   - Dropping the mono scope line from the fold: which boundaries must stay visible above the fold?
   Give minimal rewordings that keep the landing-page clarity.
3. **The X post** (posted): anything a Tempo or ZK engineer would publicly correct ("Zcash: no one can see",
   "only the operator can see", "Zcash … for a transaction")? If so, is a follow-up reply warranted, or is it fine?
4. **Anything BLOCKER or MAJOR before the deadline.** If none, say so plainly.

Mark each finding BLOCKER / MAJOR / MINOR and [V] verified or [I] inferred. Quote file:line.
