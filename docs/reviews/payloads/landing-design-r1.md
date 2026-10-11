# Design consult landing-design-r1 — make the Sworn page read as a landing page (2026-10-11)

Read-only: do not edit files, push or send transactions. Working directory: /Users/hiroyusai/src/sworn. Answer in
≤ 1,200 words plus code snippets. You are being asked as a visual/product designer, not as a claims reviewer
(claims were reviewed in docs/reviews/landing-r2.md and must stay as they are).

## Situation

Deadline 2026-10-13 06:59 UTC. The page `site/` (React 19 + Vite, plain CSS in `site/src/ui/styles.css`, no UI
library) is the CWF form's "Live product link". Branch `landing-page` (uncommitted, `git diff -- site/`) rewrote the
copy and section order, but the founder says it still does not look like a landing page — and is right: the visual
system is unchanged (grid-paper background, mono uppercase eyebrows, boxed bordered cards, dense text, left-copy /
right-box hero).

Attached screenshots (1440-wide viewport):
1. `1-billet-hero.jpg` — Billet (a competing CWF Tempo entry): big serif headline, lots of air, an abstract line
   illustration, nothing else above the fold.
2. `2-billet-howitworks.jpg` — Billet's dark "how it works" band: big serif H2, step list with icons on the left, a
   small illustrative diagram on the right.
3. `3-sworn-hero.jpg` — Sworn's current hero on the branch.
4. `4-sworn-below-hero.jpg` — Sworn's next two sections.

Sworn is B2B infra (ZK proofs of private Tempo Zone batches), so there is no "try it as a user" action. Existing
assets: an animated CSS data-flow diagram (`FlowDiagram` in `site/src/ui/sections.tsx`, styles under "data flow" in
styles.css) showing witness → SP1 prover → (only proof + public data cross the line) → SwornZoneVerifier → reviewer
✓/✗; the static hero "receipt" (✓ settled / ✓ paid / ✗ forged rejected, with tx links); a live in-page re-verify
in `OwnZone.tsx` (anchor `#own-zone`). The form's access instructions tell judges the page has a "Re-verify on
chain" control, so the evidence sections must stay on this page.

Constraints: keep all claims/wording from the branch (you may shorten or move text, not strengthen it); keep the
scope line (testnet · unaudited · own one-operator Zone, not Tempo-created · payout separate) visible above the fold;
do not touch `Zone.tsx`, `OwnZone.tsx`, `chain/`; must work at 375 px and in dark mode (tokens on :root, existing
`data-theme`); no external assets except Google Fonts; ~3 hours of implementation.

## What I want

1. Diagnosis: the 3–5 visual reasons the current page reads as a spec, not a landing page.
2. A concrete design for the top of the page down to the evidence: per section, layout, type scale, colour/band,
   spacing, what visual carries it, and the exact copy kept (from the branch). Should the FlowDiagram become the hero
   visual? Where does the receipt go? How should the evidence part be visually separated ("For engineers")?
3. A type/colour proposal (font pairing via Google Fonts, tokens for light and dark) that differentiates Sworn from
   Billet rather than copying it.
4. Implementation-ready snippets: the CSS tokens and the key CSS for hero + bands, and JSX skeletons for the changed
   sections in sections.tsx / main.tsx order. Keep them minimal and correct for the existing code.
5. What to cut entirely from above the evidence part.
