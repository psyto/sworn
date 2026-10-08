# Review before implementing — Pitch D's opening, re-framed around privacy (2026-10-08)

Read-only. Do not edit, push or send anything. Working directory: /Users/hiroyusai/src/sworn. Answer in ≤ 1,200 words.

## Context

- Colosseum Crypto World's Fair, Tempo track; submissions close 2026-10-13 06:59 UTC. Pitch D (`video/PITCH-D.md`,
  narrated, 1:53) and Demo D (`video/DEMO-D.md`, 1:22) are done. You reviewed both (`docs/reviews/submission-r2.md`).
- The founder finds Sworn "a bit niche; it doesn't click", and wants the pitch to lead with **privacy** and a
  **comparison** that makes it click, which may also stimulate the Tempo team. You already advised: Contra is a
  "closer analogy" for Zones (operator-run private execution backed by public escrow); Lightning only as a side note;
  never imply Sworn removes trust in the operator for data availability, inclusion, liveness or censorship.
- Proposal: **do not rebuild the whole pitch.** Rewrite only scenes 1–2 (~30 s) around privacy and a Zcash
  comparison; keep scenes 3–7 (why now + technical, own-Zone evidence, business, founder, honest ask) as they are.
  The founder re-synthesises the voice for scenes 1–2; Claude re-renders the slides and re-assembles the narrated cut.
  Also, with the same framing: one line on the live page / README / GitHub About; interview Q&A (Zcash difference,
  Contra/Lightning difference, what Sworn proves and does not guarantee, why privacy now); the Tempo-team outreach.

## Proposed scenes 1–2

**Scene 1 (~15 s)** — screen: headline "Private shouldn't mean 'trust me'." over the existing three problem cards
(Tempo Zone: only the operator sees every transaction / withdrawal moment / reviewer cannot verify the private batch).

> Payments are going private. Tempo Zones keep every transaction hidden: only the operator sees them. But before a
> withdrawal, nobody else can check the batch. Private shouldn't mean 'trust me'.

**Scene 2 (~15 s)** — screen: headline "Private, but checkable." Left: "Zcash: zero-knowledge proves what stays
hidden". Right: "Sworn: the same idea for Tempo Zones". Then the existing "only proof + public data cross" picture.

> Zcash showed zero-knowledge can prove what stays hidden. Sworn brings that idea to Tempo Zones: Tempo's own Zone
> code runs inside a zero-knowledge VM, and only the proof and public batch data cross. Private, but checkable.

Scene 3 then continues: "Tempo Zones ship no native ZK proof today. We compiled Tempo's own Zone verifier for SP1…"

## Read

`video/PITCH-D.md`, `video/pitch-d.html` (scenes d1–d2), `README.md` (top), `_submission/INTERVIEW.md`,
`_submission/OUTREACH.md`, `docs/reviews/submission-r2.md`, and the Tempo Zones spec in
`spikes/zone-spf/zones/specs/spec.md` (Abstract, System Overview) for what Zones hide and from whom.

## What I want

1. **Verdict:** partial rewrite of scenes 1–2 vs. a full rebuild vs. leave the pitch as is — which maximises the
   chance of winning, given four days, a finished voice-over, and traction as the weakest criterion?
2. **Accuracy audit of the proposed lines**, each BLOCKER / MAJOR / MINOR with a replacement:
   - "Payments are going private" (a trend claim: sourced or soften?).
   - "Tempo Zones keep every transaction hidden: only the operator sees them" vs. the spec (account holders see their
     own; RPC access control; encrypted deposits/withdrawals).
   - "nobody else can check the batch" (vs. your r2 note that "a reviewer can check nothing" was too broad).
   - "Private shouldn't mean 'trust me'" — does it imply Sworn removes trust in the operator?
   - The Zcash sentence and "the same idea for Tempo Zones": is the analogy fair? What must be said or avoided so a
     judge does not hear "Zcash-level privacy" (the operator still sees everything; Sworn proves a batch's validity,
     not per-transaction shielding)? Is Zcash the best comparison, or would another (e.g. Contra, Aztec, validity
     rollups, proof of reserves) click better for these judges and the Tempo team?
   - "Private, but checkable." as the tagline.
3. **Fit with the rest:** do the new scenes 1–2 flow into scenes 3–7 unchanged, keep the fixture / own-Zone
   separation intact, and stay consistent with the category (Developer Infrastructure) and the buyer (a Zone business
   whose reviewer cannot reconstruct the witness)? Any risk of the pitch now reading as a "privacy product"?
4. **Exact final wording** you recommend for scenes 1–2 (narration at ≈ 2.2 words/s, ≤ 33 words each, and on-screen
   text), plus the one line for the page/README/About.
5. Anything to say about the Tempo-team outreach angle ("a working example of ZK validity for Tempo's own Zones").
