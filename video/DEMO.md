# Demo video: Sworn (≤ 3 min, founder's voice), v5.3, 2026-10-05

**One product, one user.** This demo follows a Zone operator who needs independently checkable evidence for a
batch. It does not show the separate bonded-answer payment prototype or imitate a retail wallet. The operator
workflow is an authored explanatory view; the proof, read-only checks, contract event and explorer record that
follow are real.

**Status: v5.3 scripted as silent picture + script + subtitles.** `video/demo.mp4` is 1920×1080. The founder
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
| 6 GTM test and next step | 31 s | authored validation route (`d6`) |

## Scene 1 — start a proof job · ≈ 15 s

**[A deliberately labelled desktop **Zone Operations Console**. The operator sees Zone blocks 5–6, its one withdrawal
and two user transactions, and starts a local proof job. The status progresses from queued to the real SP1 Groth16
pipeline, then to read-only on-chain verification. The console is labelled on screen "Illustration of the operator workflow"; the operator is a generic "Example Zone"; the sidebar says `Test fixture · zone 1 · dev chain 1337`; the card says
`No transaction sent`. This is a fixture-only local workflow, not a hosted service or settlement integration.]**

> A Zone operator picks a batch with one withdrawal and two user transactions and starts Sworn's local proof job: Tempo's code runs in a zero-knowledge VM, and the result goes to an auditor.

## Scene 2 — why the batch check matters · ≈ 11 s

**[Zone operator submits a batch → batch includes withdrawal → Zone verifier → ZonePortal processes it.
Headline: the operator and auditor must trust the check. The graphic is a simplified explanation of the
ZonePortal flow, not a claim that the demonstrated Sworn verifier is connected to it.]**

> Tempo's portal pays a withdrawal only after the Zone verifier accepts the batch, so everyone involved must be able to trust that check.

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

## Scene 6 — GTM test and next step · ≈ 31 s

**[The Console shows the test sequence: a Zone business supplies its witness; its reviewer re-verifies one
batch; a repeat need for the next batch or upgrade is the conversion test. “GTM test, not traction” is
visible alongside the limits.]**

> Sworn has no customers, revenue or payer agreement today. The first test is not broad adoption. A Zone
> business supplies a batch, its reviewer re-verifies it, and we ask whether it needs the next batch or
> upgrade proved. Only then is Proof Operations a recurring service. Settlement integration remains a
> separate Tempo proposal.

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
| GTM test and current limits | README: testnet, unaudited, no customers/revenue/payer agreement; spec 004 calls settlement integration a proposal for Tempo |

**Never claim:** that this protects withdrawals today; that it proves a live Moderato Zone batch; that the
prototype and Sworn receive the same ABI input; that Tempo is broken; or that Sworn has customers, revenue,
production deployment, or an implemented settlement integration.
