## 1. Verdict

Do not add a list of future uses to narration. Scene 5 already carries the right, conditional market mechanism: “Zones × batches × upgrades.” It is stronger than speculative use cases.

My recommendation: add no new roadmap line. If you want one, use exactly one on-screen-only line—property-specific audit evidence—not solvency/TIP-403 examples. Keep proof-gated settlement in scene 4 as demonstrated evidence; keep item 5 out entirely.

## 2. Item 3 accuracy

Technically plausible, but overstated as written.

The Zone spec gives a useful invariant: per token, Zone-side supply equals net deposits minus net withdrawals, while corresponding Tempo tokens are locked in the portal. It also mirrors TIP-403 policy reads from a finalized Tempo checkpoint. So these are credible future proof targets.

But today’s proof establishes correct execution of a specified batch and commits its batch-transition fields. It does not publish or separately attest:

- a per-token total Zone supply;
- the portal’s token balance at the same finalized anchor;
- a chosen solvency inequality; or
- an explicit compliance result.

A skeptical Tempo engineer would ask:

- Which token, portal, Zone state, and finalized Tempo block does “solvency” refer to?
- How do pending deposits, queued withdrawals, fees, bounce-backs, and refund balances affect the accounting?
- Does “TIP-403 compliance” mean every transfer in one specified batch under the policy state read at each relevant finalized checkpoint—not current policy, all historical activity, or generic regulatory compliance?
- What binds the new claim to canonical prior state and guarantees the proof covers the complete batch?

Safer framing: describe a future “property-specific audit proof for a specified Zone batch and finalized Tempo checkpoint,” rather than promising “solvency” or “TIP-403 compliance.” The latter are examples requiring dedicated statement design and tests, not a free consequence of the current verifier.

## 3. Risk / qualifier

Claude’s line is directionally honest but weakens the pitch slightly: it changes the product from a crisp execution-validity proof into a menu of unbuilt compliance products. That is especially risky beside “testnet · unaudited · no customers yet.”

“Roadmap, not built” is better than leaving it unqualified, but “roadmap” sounds committed. If retained, label it as exploration and unvalidated—not merely unbuilt.

I would not use the named examples on screen. They invite technical objections in the few seconds available to explain them.

## 4. Interview additions

Add to Q17:

- Benchmark batch-size trade-offs: one proof can amortize on-chain verification over more transactions, but proving time, memory, hardware cost, and settlement latency can rise with batch size. The current ≈260k-gas attest is one fixture measurement, not a production per-transaction price.
- Prototype one narrowly specified audit-property proof: per token, for a named Zone and finalized Tempo checkpoint; measure what additional public commitments, circuit work, proving cost, and reviewer workflow it requires.
- Explore agent-payment workflows only with a design partner. A counterparty could verify settlement evidence without seeing the private ledger, but Sworn has no agent integration, no MPP product, and does not solve operator liveness or payment finality.

Add a new interview question rather than changing Q20–21:

- “Is Sworn an AI-agent payments product?”  
  - No. The present product is independent validity evidence for private Zone execution.  
  - Agent payments are a possible application only after a buyer validates the core proof workflow.  
  - The hard constraints remain proving latency, counterparty settlement requirements, policy enforcement, and operator withholding.

Do not mention Zone-to-Zone transfers.

## 5. Scene 5

Keep the narration unchanged. It is already dense but coherent at ~20 seconds. If the optional visual line is added, make it subordinate to the existing TEE line and avoid a second narrated “Later.”

One separate accuracy catch: [PITCH-D.md](/Users/hiroyusai/src/sworn/video/PITCH-D.md:12) still says “only the operator sees every transaction,” while the privacy review and spec describe sequencer nodes seeing the full batch. That should be corrected in the scenes 1–2 re-voice.