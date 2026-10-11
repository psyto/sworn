No BLOCKERs or MAJORs. The split is technically shippable: the built evidence page is emitted at `site/dist/evidence/index.html`, with `../assets/...` paths, so it resolves under `/sworn/evidence/`. [V]

- [V] `site/vite.config.ts:11-16`, `site/dist/evidence/index.html`: `base: "./"` produces correct relative bundles for both `/sworn/` and `/sworn/evidence/`.
- [V] Topbar links resolve correctly: landing uses `./evidence/`; evidence uses `../`, `../evidence/`, and `../#use` (`site/src/ui/sections.tsx:41-51`). Hero strip, teaser, and Use Sworn evidence link are also correct (`:91`, `:149`, `:423`).
- [V] `Zone.tsx`’s copied `#zone` URL uses the current evidence pathname (`site/src/ui/Zone.tsx:141`); `#own-zone` is valid and actually points upward within the evidence page (`:318`).
- [V] The moved-content references remain correct: Own Zone precedes Zone and DataFlow, so “above” is accurate (`site/src/evidence.tsx:43-46`, `site/src/ui/Zone.tsx:318`, `site/src/ui/sections.tsx:315`). The landing FAQ’s “payout above” refers to its receipt card, which is indeed above the FAQ (`sections.tsx:362`).
- [V] Landing retains the material boundaries in the hero and footer: testnet, unaudited, own one-operator Zone, not Tempo-created, separate payout, and no customers/revenue (`sections.tsx:96-98`, `:475-481`). Evidence repeats the operational limits (`OwnZone.tsx:104-129`, `sections.tsx:331-348`).

MINOR:

- [V] `site/index.html:23` still says the landing page “reads Tempo Moderato testnet live,” but it is now static and makes no chain reads. Minimal fix: remove or correct that noscript claim.
- [V] `_submission/cwf-form.md:134` is inaccurate in these specific ways:
  - The root URL no longer reads Moderato in the browser.
  - “Re-verify on chain” is no longer on the root page.
  - The live proof checks now live at `/sworn/evidence/`, including distinct own-Zone and fixture checks.
- [V] README fast-path links are stale:
  - `README.md:54` `/sworn/#own-zone` has no target on the landing page.
  - `README.md:54-59` says the root page reads the portal/receipts/payout and contains the two re-verification experiences; those are now on the evidence page.
- [V] The same obsolete root `#own-zone` links remain in `_submission/OUTREACH.md:70,86,109,120`.

No other merge-blocking issue found.