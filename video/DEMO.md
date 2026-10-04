# Demo video: Sworn (≤ 3 min, founder's voice), v2, 2026-10-04

**Status: RECORDED (2026-10-04) — `video/demo.mp4` is v2: 2:35 (154.97 s), 1920×1080, silent**, made by
`node video/record-demo.mjs` (then `node video/split-scenes.mjs demo` → `video/scenes/demo/`). The founder
approved this order on 10-04; it replaces the brief's rule "the whole bonded-answer story by 0:60" (the
story now lands at 1:02–1:44). The narration (294 words) is recorded later in the founder's voice;
`demo.srt` and `scenes/demo/NARRATION.md` give the timing. v1 (bonded answers first, 2:49) is in git
history: `d6996a3:video/demo.mp4`, recorder `d6996a3:video/record-demo.mjs`.

**As recorded** (scene length = max(the "≈ N s" target below, words ÷ 2.2 w/s)):

| scene | span | words | picture, as recorded |
|---|---|---|---|
| 1 the Zone proof | 0:00–1:02 (62 s) | 120 | the **published** page https://psyto.github.io/sworn/ (Zone section, light, 125 %) 0:00–0:44: head 0:00, pipeline 0:03, attest card 0:10, decoded event 0:16, immutables + codehash 0:23, "Check it yourself" 0:28.5, **click "Verify again"** 0:31.2 → "Calling…" → ✓ true / ✗ `InvalidProof()` 0:31.6 (burned-in label "“Verify again” clicked · live — the page also ran this check when it loaded"); explorer insert 0:44–0:56 (transaction card + event row, cropped below the header); "What it is not, yet" 0:56–1:02 |
| 2 the same engine, on a lying answer | 1:02–1:44 (42 s) | 81 | the 10-03 take: roles 1:02–1:07.3; MPP charge + reserve **×6.3, labelled "this run: 18.8 s real → 3 s"** 1:07.3–1:10.3; then **uncut** from the claimed +500 through Send 500 → "✓ transaction succeeded" → receiver +0.00 / ReceivePolicyGuard +500.00 → Challenge → the take's own time-lapse ("9 min 00 s → 10 s") → "You were paid 500.00 from the server's bond"; last frame held 1.5 s |
| 3 a right answer is safe | 1:44–2:08 (24 s) | 42 | slide d3a (the take's honest card, the recheck log `AnswerCorrect`, `Sworn.sol` 322–324) 1:44–1:57; slide d3b (the `eth_simulateV1` line + that simulation, run while recording) 1:57–2:08 |
| 4 honest limits, and where to look | 2:08–2:35 (27 s) | 51 | limits; "The bond caps what a client can be paid · it covers the answer about one block"; mark, "Sworn: Tempo's execution, proven.", github.com/psyto/sworn, psyto.github.io/sworn |

**One deviation from the page as published.** The page's pipeline caption says the proof "took 25.5M
cycles and **816 s**"; that is the superseded deployment's proof (`prove-moderato.log`). This attest's
proving log says **701 s**. The recorder compares them, hides that caption in the capture and burns in
"25.5M cycles · Groth16 proof in 701 s, locally · proving log of this attest" instead (`demo.marks.json`
`scene1.hiddenCaption`). Once `site/src/ui/Zone.tsx` says 701 s and is republished, a re-record shows the
page's own caption and no label.

---

*The plan as reviewed follows (narration lines are the script the recorder reads).*

**Form field:** *Demo video · ≤ 3 min · required* — *"how the product works"*. Target **≈ 2:35 (155 s)**.
Order follows v2 of the pitch (`PITCH.md`): the Zone proof first, then the same engine slashing a lying
answer, then honest limits.

**Narration word budget** (≈ 2.2 words/s, as for every Sworn video): **294 words as recorded (≈ 134 s of voice), hard cap 330 (the recorder refuses more)**
(330 words ≈ 150 s of voice inside a 155 s cut leaves room for the silent time-lapse and the click).

| scene | span | words (draft) | picture |
|---|---|---|---|
| 1 the Zone proof | 0:00–1:02 | 113 | **NEW** read-only captures: the public page's Zone section + the explorer |
| 2 the same engine, on a lying answer | 1:02–1:44 | 81 | **REUSE** live take `takes/demo-20261003T131156Z/scene1.mp4`, shortened |
| 3 a right answer is safe | 1:44–2:08 | 42 | **REUSE** `demo.mp4` v1 scene 2, shortened; one **NEW** authored line |
| 4 honest limits, and where to look | 2:08–2:35 | 50 | **NEW** authored slide (pitch v2 scene 6 look) |

---

## Scene 1 — the Zone proof · ≈ 62 s

**[NEW, read-only capture of the site (as recorded: the published page, not `vite preview`), light theme, 1024×576 CSS px at 1.875× = 1920×1080,
i.e. page zoom 125 % so the mono values read at 1080p. Nothing is signed or sent; the page only
makes `eth_call` / receipt reads to rpc.moderato.tempo.xyz.]**

| t | segment | on screen | source of what is shown |
|---|---|---|---|
| 0:00–0:10 | 1a | the page's Zone section head, then the pipeline: Zone batch verifier → SP1 zkVM → Groth16 → SwornZoneVerifier; caption "25.5M cycles and 701 s" (as recorded: the published caption still says 816 s, so it is hidden and the log's figure burned in) | `site/src/ui/Zone.tsx`; `spikes/zone-spf/z-logs/prove-moderato-sworn-sp1-groth16-v1.log` (`prove-moderato.log` is the superseded proof's) |
| 0:10–0:28 | 1b | "The attest transaction": ✓ succeeded · ZoneBatchVerified emitted, tx `0xb14b…3b80`, block 38080441, then **Event ZoneBatchVerified, decoded** (zoneId 1, nextZoneHeight 10, prev/next block hash, digest ✓ "the digest the zkVM guest committed"), then the immutables ✓ match / codehash ✓ | read live by the page; = `deployments/moderato.json` `SwornZoneVerifier.attest` |
| 0:28–0:44 | 1c | scroll to "Check it yourself, now", **click "Verify again"**: "Calling…" (≈ 0.5 s), then `verify(zone 1, height 10, …, proof)` **✓ true** and `verify(zone 1, height 11, …, proof)` **✗ reverts InvalidProof()**, "Called at … UTC" | two `eth_call`s from the browser, same 356-byte proof as the attest tx |
| 0:44–0:56 | 1d | the explorer, `explore.testnet.tempo.xyz/tx/0xb14b…3b80`: **cropped to the transaction card** (Status Success, Hash, Block, Time in UTC, From, To = SwornZoneVerifier), then its Events tab: topic0 `0x6bb1…7007` (= `ZoneBatchVerified`) from `0x00F6…64e5` (SwornZoneVerifier) | the explorer, captured at record time; crop and checks as in `record-pitch.mjs` `explorerShot()` (never the header: it carries Tempo's wordmark) |
| 0:56–1:02 | 1e | back on the page: "What it is not, yet" — **The batch is not from Moderato** | `site/src/ui/Zone.tsx`; README "What the Zone verifier is, and is not" |

**Note on 1c.** The page runs both calls once on load, so ✓ / ✗ are already there when the card scrolls in.
The click re-runs them and the "Called at" time changes. Decided: (a), narrated as "again, live", with a
burned-in label saying the page also ran the check on load; the recorder requires "Called at" to change.

> This is Sworn's public page. The evidence on it is read live from Moderato, Tempo's testnet, and nothing
> is signed. Tempo's own Zone batch verifier ran inside a zero-knowledge VM, and a contract with the exact
> signature of Tempo's verifier checked the proof. Here is that transaction. It succeeded, and its event
> carries the Zone, the height and the digest the proof committed to. The page ran this check when it
> loaded; I run it again, live: two read-only calls with the same proof. The real batch: true. Change one
> field, the height, and the proof
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

**[As recorded: v1 scene 2's slide re-rendered from the same sources, read again at record time, rather than cut from v1's file. Plan: REUSE `demo.mp4` v1 scene 2 (56.2–75.2 s): the honest Step 1 card "+500.00 · reserved 500", the dry-run
challenge → `AnswerCorrect`, `Sworn.sol` 323–324 highlighted; trimmed to ≈ 14 s (drop the first 5 s of
card hold). Then NEW, an authored line (pitch look) for ≈ 10 s: "Why this question: anyone can check it
with `eth_simulateV1`. The point is the proof."]**

> A correct answer can't be slashed. A challenge against the honest provider verifies the proof, and
> then reverts: the answer was right. This question makes a good demo because anyone can check it
> with a simulation. The point is the proof underneath.

## Scene 4 — honest limits, and where to look · ≈ 27 s

**[NEW authored slide, the pitch v2 scene 6 look and mark: "Testnet · unaudited · Zone batch from Tempo's
integration tests · no users or revenue"; "The bond caps what a client can be paid · it covers the answer
about one block"; then the mark, "Sworn: Tempo's execution, proven.", `github.com/psyto/sworn` and the
page's URL, psyto.github.io/sworn.]**

> The honest limits. This is testnet and unaudited. The Zone batch comes from Tempo's integration
> tests. The bond caps what a client can be paid, and there are no users or revenue yet. Everything you
> saw is open source, and the public page reads the evidence from chain and re-runs the check. Sworn: Tempo's execution, proven.

---

## What needs recording, and what is reused

- **New screen recording (read-only, no keys, no transactions):** scene 1 segments 1a–1c and 1e (the
  published page's Zone section), segment 1d (the explorer page, cropped). A test capture on
  2026-10-04: the attest card loads in ≈ 2 s, "Verify again" returns in ≈ 0.5 s, so the 62 s scene is
  bound by the narration, not by the chain.
- **New authored slides:** scene 3's one line, scene 4. Recorded like the pitch (slides.css, figures
  filled at record time).
- **Reused footage:** scene 2 = the 2026-10-03 live take (`demoLiveTake` in `deployments/moderato.json`:
  payment `0x5d76…de62`, challenge `0x69ab…5188`); scene 3 = `demo.mp4` v1 scene 2.
- **Tooling: done.** `record-demo.mjs` is the v2 recorder (published-page capture, take re-cut with the
  labelled ×6.3 speed-up, slides e1 / d3a / d3b / d4 in `demo.html`); `split-scenes.mjs demo` runs on it.

## Resolved: the 0:60 rule

The brief's completion condition said that **by 0:60** the viewer has seen asker, answerer, wrong answer,
the guard diversion, the proof and the payout. The founder approved v2's order on 10-04, which supersedes
it: the bonded-answer chain lands at 1:02–1:44.

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
| anyone can check the question with a simulation | `eth_simulateV1` of the agent's same transfer at the question's block (37,994,626), run while recording: status 1, Transfer 500.00 → `ReceivePolicyGuard` (`tempo/crates/contracts/src/precompiles/mod.rs` `RECEIVE_POLICY_GUARD_ADDRESS`), nothing to R′ (CRITERIA-MAP: say once, "that's why it's a good demo") |
| bond caps payment; about one block | README; brief "担保額は補償の上限" |
| testnet, unaudited, no users or revenue; open source | README; Apache-2.0; `github.com/psyto/sworn` public |

**Not said, on purpose:** that a Zone settles with it or that it secures withdrawals; that the batch is
from Moderato; "verification layer"; production, mainnet, audited; any user, customer or revenue; other
chains by name.
