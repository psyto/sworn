## Verdict: top tier, but still not my Tempo-track winner

Same bracket as r1, now materially closer. Pitch D/Demo D fix the previous biggest presentation failure: the fixture proof and own-Zone settlement are visibly and verbally separate. Technical execution is exceptional for a five-day solo build.

The three deciding factors:

1. **[V] Technical proof:** real proof-gated settlement, payout, and adversarial rejection are unusually strong and reproducible from the recorded evidence.
2. **[V] Native fit:** nothing settles through Sworn on a Tempo-created Zone; the fixture is dev-chain data and the live Zone is founder-controlled.
3. **[V] Traction:** there is still no buyer, design partner, reviewer validation, price, or repeat use. That is the difference between “impressive build” and winning a startup track.

I could not independently fetch GitHub, the live page, or Moderato today because this environment’s DNS failed. `[V]` therefore means verified against local source, artifacts, and recorded deployment data; current remote/chain state remains unverified.

## Claims / consistency audit

- **BLOCKER [V] — Required video delivery is incomplete.** `_submission/cwf-form.md:122,140` retain founder placeholders; `site/src/ui/sections.tsx:57-58` sets both public video links to `null`. A judge cannot watch the strongest evidence from the form or site.

  Fix: publish both narrated videos, populate the two form URLs, and set the site links. Confirm each URL works logged out.

- **MAJOR [I] — “Today/current” assertions may be stale after T12.** Pitch D 0:30 / `video/PITCH-D.md:20` says “Tempo Zones ship no native ZK proof today”; README `29-32`, site `Zone.tsx:242-259`, and spec 004 `22-24` make time-sensitive assertions about the pre-T13 verifier. T12 activates today. Even if it changes nothing relevant, a Tempo engineer will test this wording.

  Fix: re-check the exact calls after T12. If unchanged, scope statements to “at the reviewed commit / pre-T13 Moderato result”; if changed, remove “current/today” language and update the demo/page evidence. Do not imply Tempo production lacks meaningful verification.

- **MAJOR [V] — The pitch understates what becomes public.** Pitch D 0:15–0:30 / `PITCH-D.md:16`: “only the batch commitment crosses the privacy boundary.” The public interface also receives proof bytes and public batch fields/metadata. The site correctly says “hashes, counters and public batch metadata” (`site/src/ui/sections.tsx:218-226`).

  Fix: say that the proof plus public commitment/metadata cross; transaction contents and private witness do not.

- **MAJOR [V] — “A reviewer can check nothing” is rhetorically effective but literally too broad.** Pitch D 0:02–0:10 / `PITCH-D.md:12`; compare the precise version in `INTERVIEW.md:12-16`, which says an outsider cannot check the complete private batch. A reviewer can inspect public portal state, an attestation, or its own withdrawal.

  Fix: use “cannot independently reconstruct or verify the complete private batch” throughout speech.

- **MAJOR [V] — Videos still omit the liveness boundary in narration.** Pitch D 0:46–1:05 and Demo D 0:52–1:30 accurately say “then our sequencer paid,” but neither says it could withhold payout/proving. README `11-20`, spec 003 `485-492`, and the page `OwnZone.tsx:31-34,114-119` do.

  Fix: add one short spoken/onscreen qualifier during the own-Zone result: proof gates settlement; the sequencer separately processes payouts; this is not censorship-resistant. That prevents “proof guarantees withdrawal” inference.

- **MINOR [V] — Demo opening is not the canonical opening line.** The map says both videos use the exact colon wording (`_submission/CRITERIA-MAP.md:10-12`), but Demo D says “Sworn is for Tempo Zones, where…” (`DEMO-D.md:27`, `demo-d.srt:3`). Semantically harmless, but avoid needless drift.

  Fix: align the demo VO/subtitle to the canonical opening.

- **MINOR [V] — Form test count contradicts itself.** `_submission/cwf-form.md:116` says 64 Forge tests; line 169 says 67; README says 67 (`README.md:293`). A technical judge notices small count drift.

  Form fix bullets:

  - Re-run the authoritative test command and use that one count everywhere.
  - Update the “Important context” count to match the current result.
  - Keep the distinction between Zone-verifier tests and unrelated bonded-answer tests explicit.

- **MINOR [V] — The README is honest but still makes the submission look broader than it is.** `README.md:41-44,243-314` gives substantial space to the unrelated bonded-answers experiment. It says it is not the CWF product, but a rushed judge may conclude the project pivoted or is two products.

  Fix: preserve the experiment, but move it behind a clearly labelled historical/research link or collapse it beneath the CWF reproduction path.

- **MINOR [V] — “All earlier versions deleted” is not literally true in the repo.** `video/README.md:40-117` and files such as `CHECKIN-3.md`, `DEMO-B.md`, and `DEMO-C.md` preserve earlier material. The older final MP4s are gone, but the wording can invite a credibility nitpick.

  Fix: say “earlier submission-video exports were removed; recorder/history material remains.”

## Pitch D and Demo D

They win the first 15 seconds: clear customer problem, Tempo specificity, and an intelligible privacy benefit. The demo’s explicit “Two separate demonstrations” plus the Scene 5 cut card is excellent; it prevents the causal-chain error.

Together they cover founder–market fit, insight, execution, market mechanism, viability, and zero-traction honesty. They cannot truly cover traction because none exists.

Pace:

- **Pitch:** 243 words / 118 seconds = **2.06 words/s (124 wpm)**. Plausible, but with only two seconds below the limit it is unforgiving for a non-native speaker. Highest overrun risk: Scene 4 (0:46–1:05), Scene 5 (1:05–1:23), and especially founder Scene 6 (1:23–1:43), with names and credentials.
- **Demo:** 162 words / 90 seconds = **1.80 words/s (108 wpm)**. Comfortable. Scene 2’s technical nouns and Scene 7’s adversarial explanation need clean delivery, not speed.

Record one timed dry take before final export. Do not “solve” an overrun by accelerating speech; cut founder credential detail or business wording.

## Weakest area: traction

The best move in four days is a focused evidence sprint: send 8–12 personalized, two-line questions today to Zone/private-ledger builders, Tempo Zones engineers, and assurance reviewers. Ask about their current review workflow and whether independently verified batch evidence changes it. Record every response or non-response honestly. One substantive response from an actual prospective operator/reviewer is more valuable than another technical feature.

## Ranked actions

| Priority | Claude can do | Founder must do | Chain transaction |
|---|---|---|---|
| 1 | Prepare final source/link updates and a T12 wording audit. | Record VO, publish both videos, fill URLs, test logged-out playback. | None. |
| 2 | Tighten the three technical phrases above across README/site/subtitles and standardize test counts. | Approve wording in the form in your own voice. | None. |
| 3 | Make the site show public video links; preserve fixture/own-Zone separation. | Send the outreach sprint and log replies verbatim. | None. |
| 4 | Update static “current Moderato” claims after a post-T12 read-only check. | Verify live page, About, RPC reads, and form limits before submit. | Only if T12 actually invalidates the deployed proof path and a replacement is essential; otherwise do not spend deadline time on a new transaction. |

The submission is now good enough to be taken seriously as a leading technical entry. Winning depends on turning the honest commercial hypothesis into even one externally sourced signal without compromising the unusually strong technical credibility.