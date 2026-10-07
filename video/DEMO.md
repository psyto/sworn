# Demo video: Sworn (≤ 3 min, founder's voice), v5.5 (own-Zone live run), 2026-10-06

**One product, one user.** This demo follows a Zone operator who needs independently checkable evidence for a
batch. It does not show the separate bonded-answer payment prototype or imitate a retail wallet. The operator
workflow is an authored explanatory view; the proof, read-only checks, contract event and explorer record that
follow are real.

**Status: v5.5 scripted as silent picture + script + subtitles.** `video/demo.mp4` is 1920×1080. The founder
records the narration in their own voice using `video/scenes/demo/NARRATION.md`; `demo.srt` follows the same
timing. `record-demo.mjs` rereads the cited public chain state before it records, using only read-only RPC calls.

**Important scope.** The fixture in scenes 1–5 is Tempo's Zone integration-test batch on development chain 1337.
The settlement in scene 6 is our own Zone on Moderato (2026-10-06): one operator, not a Tempo-created Zone, stopped
after the payout. Tempo's own Zones are unchanged; holding their withdrawals until ZK finality is a proposal for
Tempo (spec 004), not a deployed Sworn feature.

| scene | target | picture |
|---|---:|---|
| 1 Start a proof job | 15 s | authored operator workflow (`d0`) |
| 2 Why the check matters | 12.5 s | authored ZonePortal flow (`d1`) |
| 3 What stays private | 14 s | authored data-flow diagram (`dflow`), the page's motif |
| 4 Operator Console and prototype verifier, live | 30 s | local Operator Console + public evidence page; read-only live call |
| 5 Real proof, on chain | 36 s | public page + explorer event + a live mutation check |
| 6 Our own Zone on Moderato | 20 s | public page `#own-zone`, read live + explorer of the payout |
| 7 Said plainly | 16.5 s | authored scope disclosure (`dz`) |
| 8 GTM test and next step | 31 s | authored validation route (`d6`) |

## Scene 1 — start a proof job · ≈ 15 s

**[A deliberately labelled desktop **Zone Operations Console**. The operator sees Zone blocks 5–6, its one withdrawal
and two user transactions, and presses “Start local proof job”. A progress bar advances through Queued → SP1
Groth16 proving → Read-only verification → Audit record (time compressed; the real job takes about 15 minutes). The
console is labelled on screen "Illustration of the operator workflow"; the operator is a generic "Example Zone"; the sidebar says `Test fixture · zone 1 · dev chain 1337`; the card says
`No transaction sent`. This is a fixture-only local workflow, not a hosted service or settlement integration.]**

> A Zone operator picks a batch with one withdrawal and two user transactions and starts Sworn's local proof job: Tempo's code runs in a zero-knowledge VM, and the result goes to an auditor.

## Scene 2 — why the batch check matters · ≈ 12.5 s

**[Zone operator submits a batch → batch includes withdrawal → Zone verifier → ZonePortal processes it; each step
lights in turn. Headline: the operator and auditor must trust the check. The graphic is a simplified explanation of the
ZonePortal flow: the same flow our own Zone's portal ran on Moderato (scene 6).]**

> A ZonePortal queues a batch's withdrawals only after its verifier accepts the batch, so that check must be
> trusted. In our own Zone, the verifier is Sworn.

## Scene 3 — what stays private · ≈ 14 s

**[A full-frame authored version of the public page's data-flow diagram, “Only hashes cross this line”, revealed
with the narration: the witness moves from the Zone operator's blurred, never-published ledger into the Sworn prover
and stops there; the prover emits the fixture's real digest chip, which alone crosses the dashed line to
SwornZoneVerifier on Tempo (“✓ ZoneBatchVerified”); the reviewer sees “✓ true”, then “✗ InvalidProof() — one field
changed”. Below: “Learns / Does not learn” and the settlement note (our own Zone's portal calls this verifier; Tempo's
Zones are unchanged). The recorder checks that the
live page's data-flow section still says these sentences.]**

> The witness stays with the operator and the prover. Only hashes, counters and batch metadata reach Tempo: enough
> to check the proof, not to see balances, senders or amounts.

## Scene 4 — Operator Console and Moderato's prototype verifier, live · ≈ 30 s

**[The local Operator Console is visible first: its control can start the real fixture-only proving job, requiring
about 15 minutes and 20 GB RAM, without a transaction. The evidence panel then visibly clicks “Re-verify on chain”.
The centred row calls the pre-T13 Solidity reference verifier with an equivalent malformed batch and labels it a
prototype stub. This is never described as the same input as Sworn's T13 ABI.]**

> This is the Operator Console in a browser. On a local workstation, the operator can start the real proof job
> for the supplied fixture. It takes about fifteen minutes and sends no transaction. The evidence panel then
> reads Moderato live. Its pre-T13 prototype verifier accepts a malformed batch. Sworn demonstrates the missing
> ZK check.

## Scene 5 — Sworn on the batch with a withdrawal · ≈ 36 s

**[The page shows the successful attest transaction for the integration-test fixture, its one withdrawal and two
user transactions. An explorer insert shows `ZoneBatchVerified` emitted by the contract. After a second
read-only click, the real batch returns true and changing one field reverts `InvalidProof()`.]**

> Now Sworn, on a real batch from Tempo's integration tests: two user transactions and one withdrawal. Tempo's
> own batch verifier ran inside a zero-knowledge VM, and this contract checked the proof. Here it is on the
> explorer. Again, live: the real batch, true. Change one field, and it reverts: invalid proof. An equivalent
> malformed batch is accepted by Moderato's current prototype verifier, while Sworn rejects a mutation of its
> proven batch.

## Scene 6 — our own Zone on Moderato · ≈ 20 s

**[The page's section “A portal that pays a withdrawal only after Sworn's proof passes”, read live: the portal and
its verifier, three “✓ settled” batches, the payout; then “Re-verify on chain” is clicked live: the portal's own verify
call for the withdrawal batch → ✓ true, one field changed → ✗ InvalidProof(). Explorer insert: the payout transaction,
sent to our portal.]**

> Now our own Zone on Moderato. Its portal called the verifier in each of three batches. Only after the last
> proof passed could this withdrawal be paid: our sequencer then called processWithdrawals. Here is the payout on
> the explorer: zero point five pathUSD.

## Scene 7 — said plainly · ≈ 16.5 s

**[Three plain disclosure cards: fixture: dev chain 1337; our own Zone, one operator; Tempo's Zones unchanged,
spec 004 is a proposal.]**

> To be clear: the batch above comes from a dev chain. The Zone that paid is our own Zone on Moderato, run by
> us, not a Tempo-created Zone. Tempo's own Zones still use their current verifier.

## Scene 8 — GTM test and next step · ≈ 31 s

**[The Console shows the test sequence: a Zone business supplies its witness; its reviewer re-verifies one
batch; a repeat need for the next batch or upgrade is the conversion test. “GTM test, not traction” is
visible alongside the limits.]**

> Sworn has no customers, revenue or payer agreement today. The first test is not broad adoption. A Zone
> business supplies a batch, its reviewer re-verifies it, and we ask whether it needs the next batch or
> upgrade proved. Only then is Proof Operations a recurring service. Integration with Tempo's own Zones
> remains a separate proposal.

## Claims and sources

| claim | source checked by the recorder |
|---|---|
| ZonePortal verifies before it queues a batch withdrawal | `spikes/zone-spf/zones` at `ac49071f`, `ZonePortal.sol`: `submitBatch` calls `verify`, rejects `InvalidProof`, then enqueues the withdrawal hash |
| Moderato's current verifier is a pre-T13 prototype stub | current bytecode at `0x5A56…`, matching the vendored pre-T13 reference runtime and the recorder's equivalent malformed call returns true |
| the batch is 1 withdrawal / 2 user transactions on dev chain 1337 | `deployments/moderato.json` and the fixture used by `SwornZoneVerifierWithdrawal` |
| Sworn verified the fixture on Moderato | receipt `0xa63009fd13648ed246885b7b476e8284e55bab4d5a9325127155fe292b3df770`, its `ZoneBatchVerified` event, on-chain code hash and the recorder's live calls |
| real batch → true; one changed field → `InvalidProof()` | two read-only calls made by the recorder and shown by the public page |
| local proof job starts the real pipeline, then read-only checks | `operator/server.mjs`: fixed fixture only, runs `scripts/zone-prove.sh` then `scripts/zone-attest.sh` without `--send` |
| our own Zone's portal settled 3 proven batches and paid the withdrawal after the proof | `deployments/moderato.json` → `OwnZone`, the page's `#own-zone` section (portal, receipts and `WithdrawalProcessed` read live), checked against the recorder's own reads; explorer of the payout |
| the fixture instances have no portal; Tempo's own Zones are unchanged | `SwornZoneVerifierWithdrawal.deviations`, README "Is not, yet" and spec 004 |
| GTM test and current limits | README: testnet, unaudited, no customers/revenue/payer agreement; spec 004 calls settlement integration a proposal for Tempo |

**Never claim:** that this protects withdrawals on Tempo's Zones; that our Zone is Tempo-created or a running
service; that the prototype and Sworn receive the same ABI input; that Tempo is broken; or that Sworn has
customers, revenue or a production deployment.
