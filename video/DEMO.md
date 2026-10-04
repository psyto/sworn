# Demo video: Sworn (≤ 3 min, founder's voice), v2 EDIT PLAN, 2026-10-04

**Status: plan for review. Nothing below has been recorded as a final cut.** The founder's brief
(`CLAUDE-CODE-DEMO-BRIEF.md`, last section) requires the edit plan to be shown before any real recording.
v1 (bonded answers end to end, 2:49) is in git history (`8e40a6a`) and is still `video/demo.mp4`.

**Form field:** *Demo video · ≤ 3 min · required* — *"how the product works"*. Target **≈ 2:35 (155 s)**.
Order follows v2 of the pitch (`PITCH.md`): the Zone proof first, then the same engine slashing a lying
answer, then honest limits.

**Narration word budget** (≈ 2.2 words/s, as for every Sworn video): **286 words in this draft (≈ 130 s of voice), hard cap 330**
(330 words ≈ 150 s of voice inside a 155 s cut leaves room for the silent time-lapse and the click).

| scene | span | words (draft) | picture |
|---|---|---|---|
| 1 the Zone proof | 0:00–1:02 | 113 | **NEW** read-only captures: the public page's Zone section + the explorer |
| 2 the same engine, on a lying answer | 1:02–1:44 | 81 | **REUSE** live take `takes/demo-20261003T131156Z/scene1.mp4`, shortened |
| 3 a right answer is safe | 1:44–2:08 | 42 | **REUSE** `demo.mp4` v1 scene 2, shortened; one **NEW** authored line |
| 4 honest limits, and where to look | 2:08–2:35 | 50 | **NEW** authored slide (pitch v2 scene 6 look) |

---

## Scene 1 — the Zone proof · ≈ 62 s

**[NEW, read-only capture of the site (`site/`, `vite preview`), light theme, 1280×720 at 1.5× like every
other take, page zoom 125 % so the mono values read at 1080p. Nothing is signed or sent; the page only
makes `eth_call` / receipt reads to rpc.moderato.tempo.xyz.]**

| t | segment | on screen | source of what is shown |
|---|---|---|---|
| 0:00–0:10 | 1a | the page's Zone section head, then the pipeline: Zone batch verifier → SP1 zkVM → Groth16 → SwornZoneVerifier; caption "25.5M cycles and 701 s" | `site/src/ui/Zone.tsx`; `spikes/zone-spf/z-logs/prove-moderato.log` |
| 0:10–0:28 | 1b | "The attest transaction": ✓ succeeded · ZoneBatchVerified emitted, tx `0xb14b…3b80`, block 38080441, then **Event ZoneBatchVerified, decoded** (zoneId 1, nextZoneHeight 10, prev/next block hash, digest ✓ "the digest the zkVM guest committed"), then the immutables ✓ match / codehash ✓ | read live by the page; = `deployments/moderato.json` `SwornZoneVerifier.attest` |
| 0:28–0:44 | 1c | scroll to "Check it yourself, now", **click "Verify again"**: "Calling…" (≈ 0.5 s), then `verify(zone 1, height 10, …, proof)` **✓ true** and `verify(zone 1, height 11, …, proof)` **✗ reverts InvalidProof()**, "Called at … UTC" | two `eth_call`s from the browser, same 356-byte proof as the attest tx |
| 0:44–0:56 | 1d | the explorer, `explore.testnet.tempo.xyz/tx/0xb14b…3b80`: **cropped to the transaction card** (Status Success, Hash, Block, Time in UTC, From, To = SwornZoneVerifier), then its Events tab: topic0 `0x6bb1…7007` (= `ZoneBatchVerified`) from `0x64ba…42de` | the explorer, captured at record time; crop and checks as in `record-pitch.mjs` `explorerShot()` (never the header: it carries Tempo's wordmark) |
| 0:56–1:02 | 1e | back on the page: "What it is not, yet" — **The batch is not from Moderato** | `site/src/ui/Zone.tsx`; README "What the Zone verifier is, and is not" |

**Note on 1c.** The page runs both calls once on load, so ✓ / ✗ are already there when the card scrolls in.
The click re-runs them and the "Called at" time changes. Either (a) narrate it as "again", which is true, or
(b) a small site change so the calls run only on click. (b) touches `site/`, which this plan does not do;
the founder decides.

> This is Sworn's public page. Everything on it is read live from Moderato, Tempo's testnet, and nothing
> is signed. Tempo's own Zone batch verifier ran inside a zero-knowledge VM, and a contract with the exact
> signature of Tempo's verifier checked the proof. Here is that transaction. It succeeded, and its event
> carries the Zone, the height and the digest the proof committed to. Now I run the check again: two
> read-only calls with the same proof. The real batch: true. Change one field, the height, and the proof
> no longer fits. The same transaction, on Tempo's explorer. One limit, up front: this batch comes from
> Tempo's integration tests, not from a live Zone.

## Scene 2 — the same engine, on a lying answer · ≈ 42 s

**[REUSE, no new transaction: the live take `video/takes/demo-20261003T131156Z/scene1.mp4` (56.2 s, already
edited, with its own burned-in time-lapse label). Cut points from that take's `take.json` events,
in that clip's time:]**

| take time | keep as | what is on screen | change |
|---|---|---|---|
| 0.0–4.0 | 4.0 s | the role strip: Paying agent (asks) · Preflight provider (answers + bonds) · Challenger (proves) | none |
| 5.3–24.1 | 3.0 s | Step 2 card "demo: this server is configured to lie", "Buying preflight…" (MPP charge + `reserve` tx) | **speed-up ×6.3, burned-in label "×6 · paying over MPP and reserving, 18.8 s"** (same rule as the time-lapse: label it, same run) |
| 24.1–37.4 | 13.3 s | "receiver +500.00 (claimed) · Reserved 500.00 … Active" → Send 500 to R′ → **"✓ transaction succeeded"** → **receiver +0.00 / ReceivePolicyGuard +500.00** → "Challenge the answer" | none: this is the moment the brief says must stay |
| 37.4–56.2 | 18.8 s | the existing time-lapse ("time-lapse · this challenge · 9 min 00 s → 10 s", the app's clock to 9:02), submit, **"You were paid 500.00 from the server's bond"**, agent balance → +500 at block 37995577 | none |

Total ≈ 39 s of picture + ≈ 3 s hold on the payout card = 42 s.

> The same engine re-runs Tempo's EVM. A paying agent asks a preflight provider: will the receiver get
> 500? This provider is configured to lie. It answers plus 500, and reserves 500 of its bond. The agent
> pays. The transaction succeeds, but
> the receiver gets nothing: its policy blocks this sender, so Tempo's guard holds the 500. A challenger
> re-runs that transfer inside a zero-knowledge proof, nine minutes here, sped up. The contract verifies
> it, and the bond pays the agent 500.

## Scene 3 — a right answer is safe · ≈ 24 s

**[REUSE `demo.mp4` v1 scene 2 (56.2–75.2 s): the honest Step 1 card "+500.00 · reserved 500", the dry-run
challenge → `AnswerCorrect`, `Sworn.sol` 323–324 highlighted; trimmed to ≈ 14 s (drop the first 5 s of
card hold). Then NEW, an authored line (pitch look) for ≈ 10 s: "Why this question: anyone can check it
with `eth_simulateV1`. The point is the proof."]**

> A correct answer can't be slashed. A challenge against the honest provider verifies the proof, and
> then reverts: the answer was right. This question makes a good demo because anyone can check it
> with a simulation. The point is the proof underneath.

## Scene 4 — honest limits, and where to look · ≈ 27 s

**[NEW authored slide, the pitch v2 scene 6 look and mark: "Testnet · unaudited · Zone batch from Tempo's
integration tests · no users or revenue"; "The bond caps what a client can be paid · it covers the answer
about one block"; then the mark, "Sworn: Tempo's execution, proven.", `github.com/psyto/sworn` (and the
page's URL once it is published — it is not yet).]**

> The honest limits. This is testnet and unaudited. The Zone batch comes from Tempo's integration
> tests. The bond caps what a client can be paid, and there are no users or revenue yet. Everything you
> saw is open source, and the page re-checks it from chain. Sworn: Tempo's execution, proven.

---

## What needs recording, and what is reused

- **New screen recording (read-only, no keys, no transactions):** scene 1 segments 1a–1c and 1e (the
  site's Zone section in `vite preview`), segment 1d (the explorer page, cropped). A test capture on
  2026-10-04: the attest card loads in ≈ 2 s, "Verify again" returns in ≈ 0.5 s, so the 62 s scene is
  bound by the narration, not by the chain.
- **New authored slides:** scene 3's one line, scene 4. Recorded like the pitch (slides.css, figures
  filled at record time).
- **Reused footage:** scene 2 = the 2026-10-03 live take (`demoLiveTake` in `deployments/moderato.json`:
  payment `0x5d76…de62`, challenge `0x69ab…5188`); scene 3 = `demo.mp4` v1 scene 2.
- **Tooling still to do (not done in this plan):** `record-demo.mjs` reads v1's five scenes; it needs a
  v2 path (site capture, take re-cut with the labelled ×6 speed-up, two authored slides) before
  `split-scenes.mjs demo` can run against this script. Until then `demo.mp4` / `demo.marks.json` are v1
  and do not match this file.

## Open question for the founder

The brief's completion condition says that **by 0:60** the viewer has seen asker, answerer, wrong answer,
the guard diversion, the proof and the payout. v2 puts the Zone proof in 0:00–1:02 (as asked for v2), so
the bonded-answer chain lands at 1:02–1:44. That condition is not met by this plan; please confirm v2's
order supersedes it.

---

## Claims and sources

| claim | source |
|---|---|
| read live from Moderato; nothing signed | `site/src/chain/zone.ts` (receipt, `eth_getTransactionByHash`, `readContract`, `eth_call` only) |
| Tempo's own Zone batch verifier inside a zkVM | `spikes/zone-spf/` (`prove_zone_batch`, zones `ac49071f`); spec 003 AC-Z1 |
| contract with the exact signature of Tempo's verifier | `verify` selector `0xebb2ddc9` equal in `SwornZoneVerifier.sol` and zones `IZone.sol` (`record-pitch.mjs` checks it) |
| it succeeded; event carries zone, height, digest | attest `0xb14b7127…3b80`, block 38080441, `ZoneBatchVerified` (`deployments/moderato.json`) |
| true / change one field → no longer fits | the page's two `eth_call`s; `readOnlyChecks` in `deployments/moderato.json` (`nextZoneHeight+1 reverts InvalidProof()`) |
| batch from Tempo's integration tests, not a live Zone | README "What the Zone verifier is, and is not"; `SwornZoneVerifier.deviations` |
| configured to lie; reserves 500 | take `demo-20261003T131156Z`; reserve `0xaa1d…e45d` (`demoLiveTake.dishonestReserve`) |
| succeeds, receiver +0, guard holds 500 | payment `0x5d76…de62`, block 37994663: guard +500 / R′ +0 at block−1 / block (`demoLiveTake`) |
| nine minutes, sped up | `demoLiveTake.provingRealTime` "9 min 00 s"; take's burned-in label |
| bond pays the agent 500 | challenge `0x69ab…5188`, block 37995577, client +500 (`demoLiveTake`) |
| correct answer can't be slashed (reverts after verifying) | `out/e2e/moderato-20261003T064745Z-honestReverts-recheck.log`; `Sworn.sol:323–324` |
| anyone can check the question with a simulation | `eth_simulateV1` (CRITERIA-MAP: say once, "that's why it's a good demo") |
| bond caps payment; about one block | README; brief "担保額は補償の上限" |
| testnet, unaudited, no users or revenue; open source | README; Apache-2.0; `github.com/psyto/sworn` public |

**Not said, on purpose:** that a Zone settles with it or that it secures withdrawals; that the batch is
from Moderato; "verification layer"; production, mainnet, audited; any user, customer or revenue; other
chains by name.
