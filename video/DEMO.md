# Demo video: Sworn (≤ 3 min, founder's voice), v2.1, 2026-10-04

**Status: v2.1 RECORDED (2026-10-04), silent picture + script + subtitles.** `video/demo.mp4`, 1920×1080, made
by `DEMO_PAGE_URL=http://localhost:4173/ node video/record-demo.mjs`, then `node video/split-scenes.mjs demo`
→ `video/scenes/demo/`. The narration is recorded later in the founder's own voice; `demo.srt` and
`scenes/demo/NARRATION.md` give the timing. Exact length, word count and the three live verify results of
the take are in `demo.marks.json`.

**Recorded from a local build, not the published page.** v2.1 needs the page's new "Verify again" (three
rows, with Moderato's pre-T13 verifier) and the withdrawal batch as primary evidence. Those changes are in
`site/` but not yet published, so the page was captured from `vite preview` of this working tree (the same
build `pages.yml` publishes). The browser shows no URL bar. After the page is published, re-record with
the default `DEMO_PAGE_URL` (https://psyto.github.io/sworn/) and nothing else changes.

v2 (Zone proof first, the hardfork batch `0xb14b…3b80`, 2:35) is in git history: `HEAD:video/DEMO.md`,
`HEAD:video/record-demo.mjs`. v1 (bonded answers first) is `d6996a3`.

**What changed from v2.** The primary Zone evidence is the batch **with a withdrawal** (attest
`0xa630…f770`). Before it, the page calls **Moderato's current prototype verifier** (the pre-T13
reference stub) with a malformed batch, live, and it returns true. The disclosure gets its own scene. The
bonded answers are a separate demonstration of the same engine, now told from the user's side. The old
scene 3 (a right answer is safe, `eth_simulateV1`) is cut for time; the page still says that the demo
question can be checked with `eth_simulateV1`.

**Word budget:** ≈ 2.2 words/s; hard cap 330 (the recorder refuses more). Scene length = max(the "≈ N s"
target, words ÷ 2.2 rounded up to 0.5 s).

| scene | span | target | picture |
|---|---|---|---|
| 1 a withdrawal needs a trusted check | 0:00–0:12 | 12 s | **authored slide** `d1` |
| 2 Moderato's prototype verifier, live | 0:12–0:40 | 28 s | **page**, "Verify again" clicked, row 3 |
| 3 Sworn on the batch with a withdrawal | 0:40–1:14 | 34 s | **page** (attest card, batch contents) 14 s → **explorer** `0xa630` 8 s → **page** (click, rows 1–2, the comparison line) 12 s |
| 4 said plainly | 1:14–1:26 | 12 s | **authored slide** `dz` |
| 5 the same engine, bonded answers | 1:26–2:09 | 43 s | **reused** live take, re-cut as in v2 |
| 6 next, and where to look | 2:09–2:35 | 26 s | **authored slide** `d6` |

Scene 3 is longer and scene 6 shorter than the brief's spans (1:10 / 2:05) because scene 3 carries the
explorer insert and the comparison sentence; the total stays 2:35.

**Wording rules kept here and on screen** (from the founder's brief, 10-04):
- Never "the same input" for Moderato's verifier. Its ABI is the pre-T13 10-argument `verify`
  (selector `0x7106a43e`); ours is T13's 12-argument `IVerifier.verify`. The call is **equivalent, not
  identical**.
- Moderato's verifier is described only as: "On Moderato today, the pre-T13 Solidity reference verifier is a
  prototype stub: it returns true without checking execution. Sworn demonstrates the missing ZK check."
  Wherever shown, it is labelled "Moderato, pre-T13" with the live call time. Never "broken".
- Never that Sworn protects or secures withdrawals today. Holding withdrawals until ZK finality is spec
  004's **proposal**.
- The withdrawal batch is a Tempo zones integration-test batch on a dev chain (1337), not a Moderato Zone's
  withdrawal: said once, clearly (scene 4).

---

## Scene 1 — a withdrawal needs a trusted check · ≈ 12 s

**[Authored slide `d1`: Zone user → "withdraw" → the Zone batch → the Zone's verifier, `verify(…)` → Tempo
pays out. Under it, Tempo's code at the pinned zones commit, read while recording: `submitBatch` calls
`verify` and reverts `InvalidProof` if it is false; the batch's withdrawals are queued only after that; the
payout (`processWithdrawals`) reads that queue. Headline: "Tempo must trust the check on the batch."]**

> A Zone user asks to withdraw. Tempo pays it out only from a batch that passed the Zone's verifier, so
> Tempo has to trust that check.

## Scene 2 — Moderato's prototype verifier, live · ≈ 28 s

**[The page, "Check it yourself, now" (light theme, 1024×576 CSS px at 1.875× = 1920×1080, page zoom
125 %). At ≈ 2.5 s **"Verify again" is clicked** (burned-in label "“Verify again” clicked · live"). Then
the third row is centred: "Moderato's current prototype verifier (pre-T13 reference stub), an equivalent
malformed batch", "Moderato, pre-T13 · called <time> UTC", `0x5A56….verify(zone 99, every block number 0,
every hash 0x00…00, verifierConfig 0xdead, proof 0xbeef)`, "selector 0x7106a43e: 10 arguments, not
IVerifier's 12", **returns true**, and the explanation line.]**

> This is Sworn's public page, reading Moderato, Tempo's testnet. Nothing is signed. On Moderato today,
> the pre-T13 Solidity reference verifier is a prototype stub: it returns true without checking
> execution. I call it live with a malformed batch: zone ninety-nine, config dead, proof beef. It returns
> true. Sworn demonstrates the missing ZK check.

## Scene 3 — Sworn on the batch with a withdrawal · ≈ 34 s

**[Page: "The attest transaction · the batch with a withdrawal" (✓ succeeded, tx `0xa630…f770`, block,
gas, contract `0xF2e1E7…DcBA11`), then "What the batch contains": withdrawals 1, user transactions 2,
`withdrawalQueueHash 0xcf74…02e7` ✓ non-zero, from `deposit_and_withdrawal_blocks5-6`. Explorer insert
(8 s): the explorer's transaction card for `0xa630…f770` and its Events tab row (topic0 = `ZoneBatchVerified`,
emitter `0xF2e1…BA11`), cropped below the explorer's header. Page again: **"Verify again" clicked a second
time**, row 1 "Sworn · the real withdrawal batch" ✓ true, row 2 "Sworn · one field changed" (height 7) ✗
reverts `InvalidProof()`, then the comparison line under the three rows.]**

> Now Sworn, on a real batch from Tempo's integration tests: two user transactions and one withdrawal.
> Tempo's own batch verifier ran inside a zero-knowledge VM, and this contract checked the proof. Here it
> is on the explorer. Again, live: the real batch, true. Change one field, and it reverts: invalid proof.
> An equivalent malformed batch is accepted by Moderato's current prototype verifier, while Sworn rejects
> a mutation of its proven batch.

## Scene 4 — said plainly · ≈ 12 s

**[Authored slide `dz`: "This batch comes from Tempo's zones integration tests (`l1_e2e::test_deposit_and_withdrawal`),
on a dev chain (1337). Its withdrawal is a test withdrawal, not a Moderato Zone's." · "No ZonePortal calls
this contract. It does not protect withdrawals today." · "Holding withdrawals until ZK finality: a
proposal (spec 004), not built."]**

> To be clear: this batch comes from a dev chain, not a Moderato Zone. No portal uses it, and it does not
> protect withdrawals yet.

## Scene 5 — the same engine, bonded answers · ≈ 43 s

**[REUSE, no new transaction: the live take `video/takes/demo-20261003T131156Z/scene1.mp4`, cut as in v2.
Role strip 0–5.3 s; the MPP charge + `reserve` span sped up ×6.3 with the burned-in label "this run: 18.8 s
real → 3 s"; then **uncut** from the claimed +500 through Send 500 → "✓ transaction succeeded" → **receiver
+0.00 / ReceivePolicyGuard +500.00** → Challenge → the take's own time-lapse ("9 min 00 s → 10 s") → **"You
were paid 500.00 from the server's bond"**; the last frame held.]**

> Separately, the same engine re-runs Tempo's EVM for bonded answers. A paying agent asks a provider: will
> the receiver get 500? This provider is configured to lie. Before answering, it reserves 500 of its bond
> as coverage. The agent pays. The transaction succeeds, but the receiver gets zero; Tempo's guard holds
> the money. Without Sworn, the agent sees success and chases a refund. Here, a challenger proves it in
> zero knowledge, sped up, and the bond pays the agent 500 automatically. That's compensation, not
> prevention.

## Scene 6 — next, and where to look · ≈ 26 s

**[Authored slide `d6`: "Next · a proposal (spec 004): a TEE and a ZK proof together; payouts wait for
ZK" with spec 004's own words; "That needs Tempo: Tempo's factory fixes each Zone's verifier". Then the
limits: Testnet · unaudited · Zone batches from Tempo's integration tests · no users or revenue; "The bond
caps what a client can be paid". Then the mark, "Sworn: Tempo's execution, proven.", `github.com/psyto/sworn`
and `psyto.github.io/sworn`.]**

> The next step is a proposal, spec 004: run a TEE and a ZK proof together, and hold withdrawals until
> both have checked the batch. That needs Tempo. Today this is testnet and unaudited, with no users or
> revenue. The page re-runs these checks from chain, and the code is open source. Sworn: Tempo's
> execution, proven.

---

## Claims and sources

Every figure on screen is checked by `record-demo.mjs` at record time against the source in its row; a
missing source or a different value stops the recording. Rows marked *(narration)* have no figure on screen.

| claim / on-screen figure | source, read at record time |
|---|---|
| Tempo pays a withdrawal only from a batch that passed the Zone's verifier | `spikes/zone-spf/zones` @ `ac49071f`, `crates/contracts/src/runtime/tempo/ZonePortal.sol`: `submitBatch` → `.verify(` → `if (!valid) revert InvalidProof();` → `_withdrawalQueue.enqueue(withdrawalQueueHash)`; `processWithdrawals` (line numbers read, order checked) |
| reading Moderato; nothing is signed | `site/src/chain/zone.ts` (receipt, `eth_getTransactionByHash`, `readContract`, `eth_call` only) |
| Moderato's Zone verifier is the pre-T13 reference stub | `eth_getCode(0x5A56…)` = tempo `crates/contracts/src/zones.rs` `ZONE_VERIFIER_RUNTIME`; its dispatcher holds only `0x7106a43e`; `zone_factory.rs` `ZONE_VERIFIER_ADDRESS`; source `zones/…/tempo/Verifier.sol` "Stub implementation that always returns true for prototyping" (`docs/research/moderato-zone-feasibility-20261004.md` §1) |
| pre-T13 selector `0x7106a43e`, 10 arguments, not IVerifier's 12 | selector computed from the recorder's pre-T13 ABI = the one in `ZONE_VERIFIER_RUNTIME`; `IVerifier.verify` selector from `IZone.sol` @ `ac49071f` = `SwornZoneVerifier.sol`'s, and differs |
| row 3: malformed batch (zone 99, 0s, `0xdead`, `0xbeef`) → returns true; "Moderato, pre-T13 · called <time>" | the recorder's own `eth_call`; the page's row, which must show the same values and a call time within 120 s of now, changed by the click |
| a real batch from Tempo's integration tests: 2 user transactions, 1 withdrawal | `deployments/moderato.json` `SwornZoneVerifierWithdrawal.batch` (counts; its `withdrawalQueueHash` prefix/suffix = fixture) |
| `withdrawalQueueHash` non-zero | fixture `contracts/test/vectors/zone-deposit_and_withdrawal_blocks5-6-sworn-sp1-groth16-v1.json` = the attest calldata (page ✓) |
| this contract checked the proof; tx, block, gas, event | attest `0xa63009fd…f770`, block 38097996, 260,863 gas, `ZoneBatchVerified` from `0xF2e1…BA11` (receipt ↔ `deployments/moderato.json` ↔ fixture digest); codehash on chain |
| here it is on the explorer | `explore.testnet.tempo.xyz/tx/0xa630…`, captured while recording: Success, block, topic0 of `ZoneBatchVerified`, emitter; cropped below the header |
| real batch → true; height + 1 → `InvalidProof()` | the recorder's own two `eth_call`s to `0xF2e1…BA11`; the page's rows 1–2 after a second click |
| the comparison sentence | the founder's wording rule; shown on the page only while row 3 returns true |
| dev chain, not a Moderato Zone; no portal; does not protect withdrawals; spec 004 is a proposal | `SwornZoneVerifierWithdrawal.deviations` and `.batch`; README "What the Zone verifier is, and is not"; spec 004 header "A proposal for Tempo, not something Sworn can deploy" |
| configured to lie; reserves 500 before answering | take `demo-20261003T131156Z`; reserve `0xaa1d…e45d` (`demoLiveTake.dishonestReserve`, `Reserved` coverage 500); the answer is the reserve's own argument |
| succeeds, receiver +0, guard holds 500 | payment `0x5d76…de62`, block 37994663: guard +500 / R′ +0 at block−1 / block (`demoLiveTake`) |
| without Sworn: success, then chase a refund *(narration)* | the same payment: status 1 and R′ +0; a refund over MPP is the merchant's action (`mpp.dev/advanced/refunds`, cited in the v1 pitch sources) |
| a proof, sped up; the bond pays 500 automatically | `demoLiveTake.provingRealTime` "9 min 00 s" (take's label); challenge `0x69ab…5188`, `Slashed` 500, client +500 at block−1 / block |
| compensation, not prevention | the payment still went to the guard; the slash pays the bond, capped at the reserved coverage (README) |
| next: TEE + ZK together, payouts wait for ZK; needs Tempo | `docs/specs/004-tee-plus-zk.md` (status line, "Payouts wait for ZK", "A proposal for Tempo") |
| testnet, unaudited, no users or revenue; open source; the page re-runs the checks | README Status; Apache-2.0; `github.com/psyto/sworn` public (`gh api`); the page (HTTP 200, `<title>Sworn`) |

**Not said, on purpose:** that Sworn protects or secures withdrawals; that a Zone settles with it; that the
batch or its withdrawal is from Moderato; "the same input"; that Moderato or Tempo is broken; "verification
layer"; production, mainnet, audited; any user, customer or revenue; other chains by name.
