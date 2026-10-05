# Pitch video: Sworn (≤ 2 min, founder's voice), v5.2, 2026-10-05

**One sentence.** Before a Zone business releases a withdrawal batch, Sworn creates independently verifiable,
audit-ready evidence for that exact batch — without exposing customer transaction contents.

The pitch follows a buyer's operational moment: a private Zone is about to release a withdrawal batch and a
counterparty needs evidence without receiving the private ledger. The proof pipeline is the reason the
product can exist, not the pitch's subject.

- **Narration:** six scenes, under 118 seconds.
- **Product boundary:** the Operator Console starts the local fixture prover. It is not a hosted service,
  takes no arbitrary inputs, uses no keys, and sends no transaction.
- **Honesty rule:** the demonstrated batch is Tempo's Zone integration-test fixture on development chain 1337.
  Sworn is testnet-only, unaudited, has no customers, and no ZonePortal calls it today.

---

## Scene 1: the operational moment · ≈ 20.5 s

**[Headline: “Before a Zone releases a withdrawal batch.” Two cards: “Zone business: holds the private
ledger and batch witness” and “Auditor / settlement counterparty: needs evidence, not the private ledger.”
The question: “Can it independently check this exact batch?” The answer: “Sworn creates audit-ready proof.”]**

> Before a Zone business releases a withdrawal batch, an auditor or settlement counterparty may need to
> check it. But the operator holds the private ledger and the batch witness. Sworn creates independently
> verifiable, audit-ready evidence for that exact batch, without exposing customer transaction contents.

## Scene 2: the product workflow · ≈ 19.5 s

**[Headline: “The operator starts a proof job.” A framed capture of the Operator Console shows Zone blocks 5–6,
one withdrawal, two user transactions, and “Start local proof job.” A caption says “Fixture workflow: Tempo
code in SP1 → proof → read-only verification. No transaction sent.”]**

> The operator selects the batch in Sworn's local console and starts a proof job. Sworn runs Tempo's own Zone
> verification code in a zero-knowledge VM, then creates proof evidence that a third party can verify on
> chain.

## Scene 3: the evidence is real · ≈ 16 s

**[Headline: “The evidence is real.” Pipeline: Tempo Zone code → ZK VM → Groth16 proof → contract on
Moderato. Three facts: one withdrawal; two user transactions; verified on Moderato. Result card: “real batch
→ true” and “one field changed → InvalidProof().”]**

> We have done this on Moderato: a test batch with one withdrawal and two user transactions verified by a
> contract. Change one input, and verification fails. This is a working proof pipeline, not a mockup.

## Scene 4: the go-to-market test · ≈ 25 s

**[Headline: “Earn the right to a recurring contract.” Three cards: “1. An operator supplies its witness”;
“2. Sworn proves one batch; its reviewer re-verifies”; “3. Repeat for the next batch or upgrade.” A small tag
reads “GTM test — not traction claimed.”]**

> We start with one Zone business whose operator can supply its witness. First, we prove one of its batches
> and give its reviewer reproducible verification. If it asks for the next batch or upgrade, that becomes a
> Proof Operations contract. That is our go-to-market test — not traction we claim today.

## Scene 5: why now, why Sworn · ≈ 21.5 s

**[Headline: “Why now, why Sworn.” Three cards: “Tempo execution: runs Tempo's own Zone code”; “Exact batch:
bound to inputs Tempo's portal understands”; “Operational fit: rebuilt for Tempo upgrades.” The footer says
“ZK proving for Zones: not implemented” and “Reth · Revm · ETHGlobal Tokyo, Uniswap Foundation prize · 15 years · banking systems.”]**

> ZK proving for Zones is still unimplemented. Sworn runs Tempo's code, binds to portal-shaped inputs, and
> is built to track execution upgrades. The market is not proven — Moderato has one effective operator. I work on Reth
> and Revm, teach that stack, won a Uniswap Foundation prize at ETHGlobal Tokyo, and spent fifteen years
> building banking systems.

## Scene 6: the honest ask · ≈ 14 s

**[Headline: “The honest ask.” Chips: “testnet”; “unaudited”; “Tempo integration-test batch”; “no
customer claimed.” Then: “Next: a design partner supplies a batch and decides whether the proof is worth
paying for.” Close: “Sworn: audit-ready evidence for private execution.”]**

> Today: testnet, unaudited, Tempo integration-test batch. No customer claimed. Next, a design partner supplies
> a batch and decides if independent proof is worth paying for. Sworn: audit-ready evidence for private execution.

---

## Claims and sources

| # | Claim | Source |
|---|---|---|
| 1.1 | The operator has full visibility while account holders see only their account; an outsider cannot build the batch witness. | `tempoxyz/zones` README at `ac49071f`, plus `docs/research/moderato-zone-feasibility-20261004.md` §2; reread by the recorder. The counterparty and audit scenario is the buyer hypothesis. |
| 2.1 | The Console starts the documented local fixture prover; it uses no keys and sends no transaction. | `operator/server.mjs`, `scripts/start-zone-operator.sh`, and `docs/operator-console.md`. |
| 2.2 | Sworn runs `zone_spf::prove_zone_batch` in SP1 and exposes hashes/metadata rather than transaction contents. | Spec 003 §3 and `spikes/zone-spf`; only an operator-supplied witness can be proved. |
| 3.1 | Moderato contract verification covered a Tempo integration-test batch with one withdrawal and two user transactions. | Attest `0xa63009fd…f770`, `ZoneBatchVerified`, fixture and `deployments/moderato.json`, reread by the recorder. |
| 3.2 | Real proof verifies; a changed next Zone height reverts `InvalidProof()`. | Recorder's own read-only `eth_call`s. |
| 4.1 | Buyer, operations contract, payment model and willingness to pay are commercial hypotheses. | No customer, payer agreement, price or revenue is claimed. Spec 004 §5 supports the engineering fact that execution upgrades require a new guest and verification key. |
| 5.1 | Sworn runs Tempo code and binds to Tempo IVerifier-shaped inputs; Tempo uses Reth and Revm. | Specs 003/004 and Tempo `Cargo.toml`. |
| 5.2 | Founder works on and teaches Reth and has 15 years building banking systems in Japan. | `README.md` “Who”; `github.com/psyto/rethlab`. |
| 5.3 | The founder's previous project (Reckn) won a Uniswap Foundation prize at ETHGlobal Tokyo 2026 (3rd place, Best Uniswap Stack Contribution). | ethglobal.com/showcase/reckn-47t6m, fetched by the recorder; `README.md` “Who”. |
| 5.4 | The upgrade claim is a design intent (“built to track”), not a track record: the pinned guest predates Moderato's T12. | `README.md` “What is not done”. |
| 6.1 | Testnet-only, unaudited, integration-test fixture, no customers. | `README.md` status and verifier limitations, checked by the recorder. |

**Not claimed:** that Sworn protects withdrawals today; that any ZonePortal calls Sworn; that a customer,
partner, payer, price, production deployment or audit exists; or that Tempo will adopt this design.
