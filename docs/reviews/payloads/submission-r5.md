# Adversarial review r5 — r4 fixes, the thesis lead, and the X post (2026-10-09)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read any file and
run read-only commands. Do not send transactions, push, or edit files. Your last sandbox had no network: say so if
that recurs and mark such checks [I]. Answer in ≤ 1,200 words.

## Since your r4 (`docs/reviews/submission-r4.md`)

1. **Your r4 fixes** (commit `8bb2aa6`): Confide's pre-window history in the form's repo-context field; 4
   integration-test batches; the payout as a separate `processWithdrawals`; bonded-answers technologies labelled as a
   separate experiment; fixture vs own-Zone verifier instances; the page's meta description.
2. **The founder's thesis now leads** (commit `f6bd227`) the page hero (`site/src/ui/sections.tsx` Hero), the README's
   first paragraph and the pitch's YouTube description (`video/YOUTUBE.md`): "Privacy and batch processing matter to
   everyone; for businesses they are essential. Tempo Zones give them both: private ledgers that settle in batches,
   where users see only their own activity and the operator's sequencer set sees every transaction. But then who can
   check a private batch?" The same thesis is in the form's Why field (founder's words).
3. **The X post** the founder will publish (not in the repo; pitch video attached natively; links in a self-reply):

```
Zcash uses zero knowledge to prove a transaction is valid without revealing it.

Privacy and batching matter to everyone. For businesses, they're essential. Tempo Zones give them both.

But then who can check a private batch? 🤔

Sworn puts Tempo's own Zone verifier inside a ZK proof, checkable on chain. Change one field → rejected.

Live on testnet. Built for @colosseum's Crypto World's Fair.

@tempo: would Zone operators want this?

#ZK #Tempo #Privacy
```

Self-reply:

```
How it works (testnet, unaudited, no customers yet):
• Tempo's zone_spf::prove_zone_batch compiled for SP1 by @succinctlabs, logic unchanged
• The Groth16 proof is bound to IVerifier's inputs and verified on Moderato
• On our own Zone, the portal verified each proof before settling 3 batches; a forged batch was rejected on chain

Pitch: https://youtu.be/qTBetXF5SPY
Demo: https://youtu.be/GZz52yUDJKo
Live: https://psyto.github.io/sworn/
Code: https://github.com/psyto/sworn
```

Handles were read from tempo.xyz (`x.com/tempo`) and colosseum.com (`x.com/colosseum`); `@succinctlabs` from search.

## Ground truth

As in r4. The Zcash comparison is allowed only narrowly (`video/PITCH-D.md` claims table, `docs/reviews/pitch-privacy-r1.md`):
both use zero knowledge to check a claim without revealing private data; never "Zcash for Tempo", the same privacy
model, or hiding anything from the operator. Videos are final and voiced; do not ask for a re-voice unless a voiced
line is factually false.

## What I want

1. **r4 fixes:** each resolved, partly, or not? Any new error they introduced (form limits: `scripts/cwf-form.sh`)?
2. **The thesis lead:** is any clause an over-claim or technically loose to a Tempo engineer ("Tempo Zones give them
   both", "settle in batches", "essential for businesses" as the founder's belief)? Does it now contradict any other
   surface (voiced pitch/demo, form, specs)? Quote file:line, give the minimal fix.
3. **The X post:** accuracy and over-claims line by line (Zcash line, "checkable on chain", "Change one field →
   rejected", "Live on testnet" with the fixture/own-Zone split moved to the reply), and whether the mentions and
   hashtags risk looking spammy or misattributing endorsement. Give minimal edits only; keep it short.
4. **Anything still BLOCKER or MAJOR before the founder pastes the form and submits.**

Mark each finding BLOCKER / MAJOR / MINOR and [V] verified or [I] inferred.
