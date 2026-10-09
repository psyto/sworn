## Verdict

**Shortlist-capable, but not winner-safe yet.** r3’s video/link/causal-language issues are largely resolved. Functionality and open-source evidence are unusually strong; the deciding weaknesses are disclosure precision and zero demand validation.

- **Functionality — strong.** Two demonstrations are now clearly separated and proof-gated settlement is real, but only on the founder’s non-factory, one-operator Zone.
- **Potential impact — plausible, unproven.** It depends on independent Zones adopting a reviewer workflow.
- **Novelty — credible integration novelty, not cryptographic novelty.**
- **UX — much better.** The page, descriptions, and videos explain the boundary; repo scope still risks confusion.
- **Open-source — strong, conditional on reproducibility.** The evidence is well recorded, but I could not freshly run Forge in this read-only sandbox.
- **Business plan — weakest.** Honest zero-traction disclosure helps, but no external demand signal exists.

The highest-stakes remaining issue is not technical: the form needs unambiguous pre-existing-work disclosure and internally consistent numbers.

Network DNS prevented fresh RPC, live-page, YouTube oEmbed, and logged-out playback checks. Forge also could not create its cache in this sandbox. Findings marked `[V]` are verified from local repo/background evidence.

## Form — fixes only

- **BLOCKER [V] — “Anything else” / repo context:** disclose the pre-CWF history unambiguously. Confide’s first commits are Sep. 12 and its own status says 48 commits predate the CWF window and that relevant past development must be disclosed in the form, not merely the repo. The current wording identifies Confide but can be read as beginning on its Sep. 21 check-in. Make clear that Confide predates the window, Sworn began Oct. 3, and no Confide product code entered Sworn. Also distinguish prior knowledge from reused code for Veil/rdk/Reckn. [form line 94](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:94), [Confide STATUS line 29](/Users/hiroyusai/src/confide/STATUS.md:29), [Confide README line 692](/Users/hiroyusai/src/confide/README.md:692)

- **MAJOR [V] — “How far along”:** change “5 integration-test batches” to **four**. Spec 003 and README both say four; the nearby “5/5” evidence belongs to the separate bonded-answers/RPC experiment. [form line 168](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:168), [README line 254](/Users/hiroyusai/src/sworn/README.md:254)

- **MAJOR [V] — “How far along”:** make the own-Zone payout explicitly a separate sequencer `processWithdrawals` action, not merely “a withdrawal paid after the proof.” That field is the remaining form recurrence of the ambiguity r3 identified. [form line 167](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:167)

- **MAJOR [V] — “Technologies”:** remove or label MPP, type `0x76`, receive-policy transfer, TIP-20, and the TypeScript SDK as the separate bonded-answers experiment. They are real repository work, but not the Zone-evidence CWF product; the README itself calls that experiment separate. [form line 58](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:58), [README line 318](/Users/hiroyusai/src/sworn/README.md:318)

- **MAJOR [V] — “How long”:** resolve the supplied “~10 h/week” fact against the current form’s “~20 hours.” Current `main` contains a founder-labelled commit changing 10 to 20 after the r4 brief was prepared. Paste only the founder-confirmed number. [form line 192](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:192)

- **MINOR [V] — “How does your product use chains”:** preserve the distinction that the fixture is a dev-chain integration-test batch merely verified on Moderato, while the own Zone uses a distinct verifier instance. “A Tempo Zone batch on Tempo” is technically loose enough to invite a false live-Zone reading. [form line 52](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:52)

All other fact-bearing fields are materially aligned: zero customers/revenue, testnet/unaudited scope, no Tempo adoption, proposal status, one-operator own Zone, videos, and founder location. The form has 28/28 fields and all counted fields are within limits; the tightest are 998/1000, 996/1000, and 994/1000.

## Cross-surface consistency

No material contradiction remains between the voiced pitch/demo and the local README, page source, or YouTube descriptions. The descriptions correctly preserve the fixture/own-Zone split and separate payout. [YouTube description line 23](/Users/hiroyusai/src/sworn/video/YOUTUBE.md:23), [README line 42](/Users/hiroyusai/src/sworn/README.md:42), [page line 82](/Users/hiroyusai/src/sworn/site/src/ui/sections.tsx:82)

- **MINOR [V] — stale precision in page metadata:** the HTML description still says “only the operator sees every transaction,” while the visible page/README use the more precise “operator’s sequencer set.” This matches the voiced shorthand, so do not re-voice; fix the metadata/text surface. [index.html line 7](/Users/hiroyusai/src/sworn/site/index.html:7), [page line 70](/Users/hiroyusai/src/sworn/site/src/ui/sections.tsx:70)

- **MAJOR [V] — repo-story inconsistency:** the README clearly says bonded answers is not the CWF product, while the form’s technology field presents its components as Sworn’s stack without that boundary. [README line 323](/Users/hiroyusai/src/sworn/README.md:323), [form line 58](/Users/hiroyusai/src/sworn/_submission/cwf-form.md:58)

## Last-three-days actions

1. **BLOCKER — Founder:** settle the disclosure and hours facts, then paste the corrected form. Do not rely on the repository to disclose Confide’s pre-window history.

2. **MAJOR — Claude can do; founder approves:** make the four-batch correction, isolate bonded-answers technologies, restore the explicit separate-payout wording, and update the page metadata. Re-run form counting.

3. **MAJOR — Founder:** open all three YouTube links and the site in a logged-out browser; confirm captions, playback, page video links, and live checks. Preserve screenshots/timestamps.

4. **MAJOR — Founder:** send narrowly targeted outreach to Zone builders/reviewers. One honest reply, rejection, or “no reviewer need” is better evidence than another technical claim; report it accurately.

5. **MINOR — Claude can do:** perform one final read-only consistency pass after the founder’s edits; do not reopen voiced scripts unless a line becomes factually false.