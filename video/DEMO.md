# Demo video: Sworn (≤ 3 min, founder's voice), v5.2, 2026-10-05

**One product, one user.** This demo follows a Zone operator who needs independently checkable evidence for a
batch. It does not show the separate bonded-answer payment prototype or imitate a retail wallet. The operator
workflow is an authored explanatory view; the proof, read-only checks, contract event and explorer record that
follow are real.

**Status: v5.2 recorded as silent picture + script + subtitles.** `video/demo.mp4` is 1920×1080. The founder
records the narration in their own voice using `video/scenes/demo/NARRATION.md`; `demo.srt` follows the same
timing. `record-demo.mjs` rereads the cited public chain state before it records, using only read-only RPC calls.

**Important scope.** The demonstrated batch is Tempo's Zone integration-test fixture on development chain 1337,
not a Moderato Zone batch. No ZonePortal calls Sworn today, so this is evidence, not withdrawal protection.
Holding withdrawals until ZK finality is a proposal for Tempo, not a deployed Sworn feature.

| scene | target | picture |
|---|---:|---|
| 1 Start a proof job | 24 s | authored operator workflow (`d0`) |
| 2 Why the check matters | 17 s | authored ZonePortal flow (`d1`) |
| 3 Operator Console and prototype verifier, live | 30 s | local Operator Console + public evidence page; read-only live call |
| 4 Real proof, on chain | 36 s | public page + explorer event + a live mutation check |
| 5 Said plainly | 13 s | authored scope disclosure (`dz`) |
| 6 Customer and next step | 31 s | authored route (`d6`) |

## Scene 1 — start a proof job · ≈ 24 s

**[A deliberately labelled desktop **Zone Operations Console**. The operator sees Zone blocks 5–6, its one withdrawal
and two user transactions, and starts a local proof job. The status progresses from queued to the real SP1 Groth16
pipeline, then to read-only on-chain verification. The console is labelled on screen "Illustration of the operator workflow"; the operator is a generic "Example Zone"; the sidebar says `Test fixture · zone 1 · dev chain 1337`; the card says
`No transaction sent`. This is a fixture-only local workflow, not a hosted service or settlement integration.]**

> A Zone operator selects the batch before an audit. This batch, Zone blocks 5–6, has one withdrawal and two user transactions.
> They start Sworn's local proof job. It runs Tempo's code in SP1, then performs read-only verification on
> Moderato. The finished proof record can be sent to an auditor.

## Scene 2 — why the batch check matters · ≈ 17 s

**[Zone operator submits a batch → batch includes withdrawal → Zone verifier → ZonePortal processes it.
Headline: the operator and auditor must trust the check. The graphic is a simplified explanation of the
ZonePortal flow, not a claim that the demonstrated Sworn verifier is connected to it.]**

> Tempo's portal processes a withdrawal from a batch only after the Zone verifier accepts it. So the operational
> dependency is simple: an operator, auditor, or counterparty must be able to trust the batch check.

## Scene 3 — Operator Console and Moderato's prototype verifier, live · ≈ 30 s

**[The local Operator Console is visible first: its control can start the real fixture-only proving job, requiring
about 15 minutes and 20 GB RAM, without a transaction. The evidence panel then visibly clicks “Re-verify on chain”.
The centred row calls the pre-T13 Solidity reference verifier with an equivalent malformed batch and labels it a
prototype stub. This is never described as the same input as Sworn's T13 ABI.]**

> This is the Operator Console in a browser. On a local workstation, the operator can start the real proof job
> for the supplied fixture. It takes about fifteen minutes and sends no transaction. The evidence panel then
> reads Moderato live. Its pre-T13 prototype verifier accepts a malformed batch. Sworn demonstrates the missing
> ZK check.

## Scene 4 — Sworn on the batch with a withdrawal · ≈ 36 s

**[The page shows the successful attest transaction for the integration-test fixture, its one withdrawal and two
user transactions. An explorer insert shows `ZoneBatchVerified` emitted by the contract. After a second
read-only click, the real batch returns true and changing one field reverts `InvalidProof()`.]**

> Now Sworn, on a real batch from Tempo's integration tests: two user transactions and one withdrawal. Tempo's
> own batch verifier ran inside a zero-knowledge VM, and this contract checked the proof. Here it is on the
> explorer. Again, live: the real batch, true. Change one field, and it reverts: invalid proof. An equivalent
> malformed batch is accepted by Moderato's current prototype verifier, while Sworn rejects a mutation of its
> proven batch.

## Scene 5 — said plainly · ≈ 13 s

**[Three plain disclosure cards: test batch on dev chain 1337; no ZonePortal calls this contract; settlement
integration is proposed, not built.]**

> To be clear: this batch comes from a dev chain, not a Moderato Zone. No portal uses it, and it does not protect
> withdrawals yet.

## Scene 6 — who it is for, and next · ≈ 31 s

**[The near-term customer is "Zone operators who answer to auditors"; later integration into settlement is
labelled written, not built; proving operations through upgrades is labelled to validate. The limits and next
step remain visible.]**

> Near term: businesses that run Zones and answer to auditors, with evidence they match to each batch they
> settle, not yet a guarantee. Later, Tempo could build proofs into settlement; that design is written, not
> built. The service: provers on time, rebuilt at each upgrade. It's testnet and unaudited, with one Zone
> operator on Moderato and no customers. Next: one design partner, and a proof of a batch they supply.

## Claims and sources

| claim | source checked by the recorder |
|---|---|
| ZonePortal verifies before it queues a batch withdrawal | `spikes/zone-spf/zones` at `ac49071f`, `ZonePortal.sol`: `submitBatch` calls `verify`, rejects `InvalidProof`, then enqueues the withdrawal hash |
| Moderato's current verifier is a pre-T13 prototype stub | current bytecode at `0x5A56…`, matching the vendored pre-T13 reference runtime and the recorder's equivalent malformed call returns true |
| the batch is 1 withdrawal / 2 user transactions on dev chain 1337 | `deployments/moderato.json` and the fixture used by `SwornZoneVerifierWithdrawal` |
| Sworn verified the fixture on Moderato | receipt `0xa63009fd13648ed246885b7b476e8284e55bab4d5a9325127155fe292b3df770`, its `ZoneBatchVerified` event, on-chain code hash and the recorder's live calls |
| real batch → true; one changed field → `InvalidProof()` | two read-only calls made by the recorder and shown by the public page |
| local proof job starts the real pipeline, then read-only checks | `operator/server.mjs`: fixed fixture only, runs `scripts/zone-prove.sh` then `scripts/zone-attest.sh` without `--send` |
| no portal connection / no withdrawal protection | `SwornZoneVerifierWithdrawal.deviations`, README scope section and spec 004 |
| customer route and current limits | README: testnet, unaudited, no customers or revenue; spec 004 calls settlement integration a proposal for Tempo |

**Never claim:** that this protects withdrawals today; that it proves a live Moderato Zone batch; that the
prototype and Sworn receive the same ABI input; that Tempo is broken; or that Sworn has customers, revenue,
production deployment, or an implemented settlement integration.
