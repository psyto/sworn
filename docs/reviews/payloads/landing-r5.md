# Review landing-r5 — landing page split into two pages (2026-10-11)

Read-only: do not edit files, push or send transactions. Working directory: /Users/hiroyusai/src/sworn. ≤ 700 words.

Your r4 findings were applied (builder card: prerequisites, 12–15 min / 18–20 GB, writes a local fixture; operator card:
"testnet pilot", "requires a compatibility review"; issue form: testnet only, "Public contact handle (optional)").
Then, at the founder's request, the site was split (uncommitted, branch `landing-page`, `git diff`, `git status`):
- `site/index.html` → `src/main.tsx`: landing page, static, no chain reads: Hero (+FlowDiagram), WhoVerifies,
  ProofFlow, EvidenceTeaser (receipt + "See the evidence →" to `evidence/`), OperationsTest, UseSworn, Faq, Footer.
- `site/evidence/index.html` → `src/evidence.tsx`: the previous App's chain reads: EvidenceIntro, OwnZoneSection,
  ZoneSection, DataFlow (with its diagram again), LiveStatus, Footer.
- `vite.config.ts` multi-page input; Topbar gets `base` ("./" / "../") with Evidence / Use Sworn / GitHub links.
- The Pages workflow (`.github/workflows/pages.yml`) uploads `site/dist`.

Check, [V]/[I], file:line, BLOCKER/MAJOR/MINOR, minimal fixes:
1. Build/deploy: will `site/dist/evidence/` deploy and resolve assets under https://psyto.github.io/sworn/evidence/
   (relative base "./")? Any link that breaks on Pages (topbar, hero proof strip, teaser, UseSworn "evidence page",
   `Zone.tsx` copy-link `#zone`, `OwnZone`/`Zone` cross-links like `#own-zone`)?
2. Claims after the split: anything on either page that now refers to content no longer on that page ("above",
   "below", "this page", "the payout above shows" in the FAQ, DataFlow notes)? Does the landing page still carry the
   material boundaries (testnet, unaudited, own one-operator Zone, not Tempo-created, payout separate, no customers)?
3. The CWF form's access instructions (`_submission/cwf-form.md`, "Access instructions") say the page at
   https://psyto.github.io/sworn/ reads Moderato and has "Re-verify on chain". What exactly is now inaccurate? (Do not
   draft replacement text; list the inaccuracies only — the founder will rewrite it.) Same for any README/site links.
4. Anything else BLOCKER/MAJOR before merge. If shippable, say so plainly.
