# Adversarial review landing-r2 — the implemented landing page (2026-10-11)

Read-only. Break this; do not polish it. Working directory: /Users/hiroyusai/src/sworn. You MAY read any file and
run read-only commands. Do not send transactions, push, or edit files. If the sandbox has no network, say so and mark
such checks [I]. Answer in ≤ 900 words.

Your landing-r1 (`docs/reviews/landing-r1.md`) recommended a smaller version and flagged three MAJOR wording issues
("private ledger is right", "only the operator can see", "Sworn proves each batch"). The founder chose a bolder
restructure anyway, to read as a landing page. It is implemented, uncommitted, on branch `landing-page`:
`git diff -- site/` (sections.tsx, main.tsx, styles.css). Evidence components (`Zone.tsx`, `OwnZone.tsx`, `chain/`)
are unchanged.

New order: Hero (new H1/lede/CTA; the right card is now a STATIC receipt read from deployments/moderato.json — no RPC
in the hero; the mono scope line is kept) → WhoVerifies (Bitcoin / Zcash / Tempo Zones) → ProofFlow (plainer copy) →
DataFlow → OwnZone → Zone fixture → LiveStatus (live / not yet) → OperationsTest → Faq → ClosingCta → Footer.
ReviewGap was removed.

## What I want

1. Every claim in the new copy (Hero, WhoVerifies, ProofFlow, LiveStatus, FAQS, ClosingCta) against the code, README,
   `deployments/moderato.json`, the form (`_submission/cwf-form.md`) and specs. Were your three r1 MAJORs fixed?
   Anything new over-claimed or a boundary lost? Check especially: the receipt rows (batch 56-61 tx, "withdrawal paid,
   separately, by our sequencer", forged batch "replaying that real proof", "passed every check before the proof");
   "Sworn re-runs it with Tempo's own code"; "Change one field and it fails"; "matching its native output";
   "11–31 minutes"; the FAQ's Nitro/ZK-docs claim and "without trusting the hardware"; Zcash wording.
2. Consistency with the voiced videos and the form (no contradiction a judge could spot).
3. Broken anchors/links, the "below" cross-reference in DataFlow, removed content a judge needed.
4. BLOCKER / MAJOR / MINOR with [V]/[I], file:line, minimal fixes. If shippable, say so plainly.
