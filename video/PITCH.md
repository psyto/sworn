# Pitch video: Sworn (≤ 2 min, founder's voice), v5.1, 2026-10-05

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
> chain. The private transaction contents stay private.

## Scene 3: the evidence is real · ≈ 16 s

**[Headline: “The evidence is real.” Pipeline: Tempo Zone code → ZK VM → Groth16 proof → contract on
Moderato. Three facts: one withdrawal; two user transactions; verified on Moderato. Result card: “real batch
→ true” and “one field changed → InvalidProof().”]**

> We have done this on Moderato: a test batch with one withdrawal and two user transactions verified by a
> contract. Change one input, and verification fails. This is a working proof pipeline, not a mockup.

## Scene 4: what the buyer purchases · ≈ 24.5 s

**[Headline: “What a Zone business buys.” Three cards: “Before settlement: proof for each supplied batch”;
“During upgrades: keep the proof pipeline compatible with Tempo execution”; “For counterparties: a proof
they can check independently.” A small tag reads “Commercial hypothesis — validate with design partners.”]**

> The buyer we are pursuing is a Zone business that must give a counterparty confidence before it settles.
> It would pay Sworn for two things: proof generation for each batch it supplies, and compatibility maintenance
> through Tempo upgrades. That is the contract we want to test. We will
> validate the demand with design partners.

## Scene 5: why Sworn wins this job · ≈ 22.5 s

**[Headline: “Why Sworn, not generic ZK.” Three cards: “Tempo execution: runs Tempo's own Zone code”; “Exact
batch: bound to the inputs Tempo's portal understands”; “Operational fit: rebuilt for Tempo upgrades.” A
footer ties this to “Reth · Revm · 15 years building banking systems.”]**

> Generic proving tools run programs. They do not deliver a Tempo-specific evidence operation. Sworn already
> runs Tempo's code, binds to the batch inputs its portal understands, and is built to track execution upgrades. I work on Reth and Revm, teach that stack, and have fifteen years building banking systems.

## Scene 6: the honest ask · ≈ 14 s

**[Headline: “The first customer proof.” Chips: “testnet”; “unaudited”; “Tempo integration-test batch”; “no
customer claimed.” Then: “Next: a design partner supplies a batch and decides whether the proof is worth
paying for.” Close: “Sworn: audit-ready evidence for private execution.”]**

> Today: testnet, unaudited, Tempo integration-test batch. No customer claimed. Next, a design partner supplies
> a batch and decides if independent proof is worth paying for. Sworn: audit-ready proof for private execution.

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
| 6.1 | Testnet-only, unaudited, integration-test fixture, no customers. | `README.md` status and verifier limitations, checked by the recorder. |

**Not claimed:** that Sworn protects withdrawals today; that any ZonePortal calls Sworn; that a customer,
partner, payer, price, production deployment or audit exists; or that Tempo will adopt this design.
