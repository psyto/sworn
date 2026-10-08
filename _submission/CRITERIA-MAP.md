# CWF submission map — Sworn, v5.3

This is the single source of truth for the submission narrative. It maps only evidence that exists today
and labels commercial statements as hypotheses. The CWF submission asks for a presentation, demo, public
repository, go-to-market strategy, demand validation and distribution plan; its published evaluation includes
founder-market fit, insight, product/execution, market size, communication, viability and traction.

## The one message

**Sworn is for Tempo Zones: only the operator sees every transaction. Sworn makes that private execution
checkable: for an operator-supplied batch, evidence anyone can verify on chain, without disclosing customer
transaction contents.** (The wording of Pitch D and Demo D, 2026-10-08.)

The narrow first product is **Proof Operations**: an operator supplies a witness; Sworn generates a proof for
the batch and keeps the proof pipeline compatible as Tempo execution changes. The demonstrated evidence is
real; the buyer, willingness to pay and distribution channel are not yet validated.

## What is true versus what must be tested

| Statement | Status | Evidence / boundary |
|---|---|---|
| Tempo's Zone verifier runs in SP1; a Groth16 proof for a fixture with one withdrawal and two user transactions was verified by a contract on Moderato. | Built and independently re-checkable | Attest `0xa630…f770`, `ZoneBatchVerified`, public page and demo. The fixture is from Tempo's integration tests on dev chain 1337, not a Moderato Zone. |
| On Moderato, our own Zone's portal settled three Groth16-proven batches through `SwornZoneVerifier` only after each proof passed; separately, our sequencer then called `processWithdrawals` and paid a withdrawal (2026-10-06). The proof is necessary, not sufficient. | Built and independently re-checkable | Payout `0xfc31…e1f1`, three `submitBatch` txs, `deployments/moderato.json` → `OwnZone`, the public page's live section. Our own Zone, one operator, not Tempo-created; stopped after the payout. A forged, sequencer-signed batch replaying a real proof was rejected on the proof (`0x3a15…167d`, status 0). |
| A changed proof input reverts `InvalidProof()`. | Built and re-checkable | Browser and recorder read-only calls. |
| A Zone operator could use proof evidence in an audit or settlement-review workflow. | Commercial hypothesis | No operator, auditor or counterparty has requested, reviewed or paid for it. On Tempo's own Zones the proof is off the settlement path and protects no withdrawal; only our own demonstration Zone settles through it. |
| A Zone business could buy per-batch proving plus upgrade maintenance. | Commercial hypothesis | Only the operator has the witness. No payer, price, contract or revenue exists. |
| This can become a recurring market. | Conditional expansion thesis | Work repeats only if independent Zone businesses adopt the workflow and value the evidence. Moderato currently has one effective operator. |

## Criterion coverage and required surface

| CWF criterion | Honest evidence now | Submission treatment |
|---|---|---|
| Founder + market fit | Reth/Revm engineering, Fabrknt Dojo (21 courses, 234 lessons), Reckn: Uniswap Foundation sponsor prize (3rd, ETHGlobal Tokyo 2026), 3rd place in the Superteam Japan × NTT DOCOMO R&D side track of Colosseum's Cypherpunk Hackathon (2025), 15 years building banking systems in Japan | Pitch: why this founder can maintain Tempo-specific proof operations. Form: how the opportunity was uncovered. |
| Insight | Private execution creates an external-verification gap; public batch evidence can preserve transaction confidentiality | Pitch and README lead with the operator / reviewer moment, not the zkVM. |
| Product + execution | Real Tempo Zone code in SP1; on-chain verify; mutation rejection; our own Zone's portal settled 3 proven batches and paid a withdrawal after the proof, and rejected a forged, sequencer-signed batch on the proof; the live proofs re-checkable by forge and on the page; working local Operator Console | Demo is the technical proof. Pitch shows Console briefly and links to demo/site. |
| Potential market size | No credible numeric TAM for this precise market. The market grows with Zones × batches × upgrades, and only if Zones are adopted (Pitch D's wording). | Do not invent a TAM. State the expansion mechanism and the gating assumption. |
| Founder communication | One buyer story, a concrete first test, and one honest boundary | Every surface uses the same vocabulary: Zone business, operator-supplied batch, independent evidence, Proof Operations. |
| Viability | Candidate recurring service: batch proof generation plus upgrade maintenance | Form and pitch label buyer, price and willingness to pay as hypotheses. |
| Traction | No customers or revenue. Strong build velocity and verifiable technical execution are not demand. | State zero traction once; define the next falsifiable milestone: a partner supplies a batch and elects to repeat/pay. |
| Go-to-market / distribution | Proposed, not executed | First partner must own a witness. Deliver one proof and have its reviewer independently verify it. Conversion test: repeat for the next batch or upgrade. |

## The only credible initial GTM sequence

1. Find a Zone business/operator that can lawfully supply its own witness and has a reviewer who needs evidence.
2. Prove one operator-supplied batch; give the resulting proof and verification instructions to that reviewer.
3. Measure the result: does the operator ask for the next batch or the next upgrade? Is there a budget owner?
4. Convert only that repeat need into a per-Zone operations agreement plus per-batch proving. Do not call steps 1–3 traction before they happen.

## Surface responsibilities

| Surface | Job |
|---|---|
| Pitch | Buyer moment, product, live evidence, commercial thesis, GTM test, why founder, honest limit. |
| Demo | Show the operator workflow and the actual proof/evidence checks. Never make it a second business pitch. |
| Form | Answer demand, market, competitors, revenue and founder commitment explicitly; link both videos and the public repo. |
| README / site | Let a technical judge reproduce and independently verify the claim; state the operational boundary early. |
| Specs | Preserve the technical design and all unbuilt settlement work as proposals, not product claims. |

## Never claim

- A real customer, design partner, auditor, counterparty, price, revenue or recurring contract.
- That Sworn protects withdrawals on Tempo's Zones, or that our own Zone is Tempo-created or a running service.
- That the proven fixture is a Moderato Zone batch.
- A current large market, a numeric TAM without a source, or Tempo adoption.
- That build velocity or a technical proof is demand validation.
