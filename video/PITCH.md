# Pitch video: Sworn (≤ 2 min, founder's voice), v5.5 (buyer, alternative and adoption path), 2026-10-07

**One sentence.** Before a Zone business releases a withdrawal batch, Sworn creates independently verifiable,
audit-ready evidence for that exact batch — without exposing customer transaction contents.

The pitch follows a buyer's operational moment: a private Zone is about to release a withdrawal batch and a
counterparty needs evidence without receiving the private ledger. Without it, settlement may wait or the
Zone business carries more settlement risk. That consequence, the initial buyer, and the complementary path
beside Tempo's TEE are hypotheses to test — not claims of adoption. The proof pipeline is the reason the
product can exist, not the pitch's subject.

- **Narration:** six scenes, under 118 seconds.
- **Product boundary:** the Operator Console starts the local fixture prover. It is not a hosted service,
  takes no arbitrary inputs, uses no keys, and sends no transaction.
- **Honesty rule:** the live settlement is our own Zone on Moderato (2026-10-06): one operator, not a
  Tempo-created Zone, stopped after the payout. The workflow in scene 2 uses Tempo's Zone integration-test fixture
  on development chain 1337. Sworn is testnet-only, unaudited and has no customers; Tempo's own Zones are unchanged.

---

## Scene 1: the operational moment · ≈ 19 s

**[Headline: “Before a Zone releases a withdrawal batch.” A Zone business card holds a blurred private ledger
(“Private ledger · batch witness”, locked); a “Withdrawal batch” token slides out of it toward a card for the
“Auditor / settlement counterparty: needs evidence, not the private ledger”, whose “?” resolves into “Can it
independently check this exact batch?” The answer: “Sworn creates audit-ready evidence.”]**

> Before a Zone business releases a withdrawal batch, a settlement counterparty may need to check it. Without
> evidence, settlement may wait or carry more risk. The operator holds the private ledger and
> witness. Sworn creates independently verifiable evidence without exposing transactions.

## Scene 2: the product workflow · ≈ 17 s

**[Headline: “The operator starts a proof job.” The shared data-flow motif (the page's “Only hashes cross this
line” diagram): the operator presses “Start local proof job”; the witness moves into the Sworn prover (“Tempo's own
Zone code”, running) and stops there; the prover emits the fixture's real digest chip, which alone crosses the dashed
line to SwornZoneVerifier on Tempo (“✓ ZoneBatchVerified”); the reviewer sees “✓ true”, then “✗ InvalidProof() — one
field changed”. Caption: “Fixture workflow: Tempo code in SP1 → proof → read-only verification. No transaction sent.”]**

> The operator selects the batch in Sworn's local console and starts a proof job. Sworn runs Tempo's own Zone
> verification code in a zero-knowledge VM, then creates proof evidence that a third party can verify on
> chain.

## Scene 3: the evidence is real · ≈ 23.5 s

**[Headline: “Proof-gated settlement on Moderato.” Pipeline: Tempo Zone code → ZK VM → Groth16 proof → our portal
settles on Moderato. Three facts, read now from Moderato: “3 batches proven and settled” (counts up), “0.5 pathUSD
withdrawal paid after the proof”, “anchor → payout: 58.5 min” (both block timestamps, read now). Chip: “our own Zone · portal calls Sworn”.
Result: “the withdrawal batch ✓ verify(…) → true” draws in (the recorder's own read-only call to our Zone's verifier);
“a forged batch, signed by our sequencer → ✗ rejected on chain” flips red with a small shake (the 2026-10-07 transaction:
status 0, its trace read while recording shows the verifier reverting InvalidProof()).]**

> On Moderato, our own one-operator Zone, not a Tempo-created one, settles a batch only after Sworn's proof
> passes; only then can a withdrawal be paid. Three batches, proven and checked on chain. A forged batch, even signed
> by our own sequencer, is rejected. Anchor to payout: fifty-eight minutes, on one laptop.

## Scene 4: the go-to-market test · ≈ 19 s

**[Headline: “Earn the right to a recurring contract.” A progress line advances through three cards, each
appearing as it is spoken: “1. Zone business: reviewer cannot reconstruct the witness”; “2. Not a signed
report: evidence of exact Tempo execution”; “3. Repeat batch or upgrade: Proof Operations.” A small tag reads
“GTM test — not traction claimed.”]**

> First buyer: a Zone business whose reviewer cannot reconstruct the private witness. A signed report or generic
> proof may not be enough: the reviewer may need evidence of exact Tempo execution. One batch tests demand; repeats or
> upgrades become Proof Operations.

## Scene 5: why now, why Sworn · ≈ 25 s

**[Headline: “Why now, why Sworn.” Three cards: “Tempo execution: runs Tempo's own Zone code”; “Exact batch:
bound to inputs Tempo's portal understands”; “Operational fit: rebuilt for Tempo upgrades.” The footer says
“Tempo: no Zone ZK today”; “Start: Proof Operations”; “Later: alongside TEE”; “Founder: Reth · Revm · banking”; and “ETHGlobal Tokyo prize.”]
The final step is a proposal for Tempo, not adoption.]**

> Sworn is Tempo-specific, not generic ZK: it runs Zone code, fits the portal's batch shape, and tracks upgrades.
> We begin as Proof Operations for a Zone business. Later, Tempo could add this as an independent check alongside
> its TEE, not replace it. I work on Reth and Revm, with fifteen years in banking systems.

## Scene 6: the honest ask · ≈ 14 s

**[Headline: “The honest ask.” Chips: “testnet”; “unaudited”; “our own Zone, one operator”; “no
customer claimed.” Then: “Next: a design partner supplies a batch and decides whether the proof is worth paying
for.” The Sworn seal stamps onto the closing block: “Sworn: audit-ready evidence for private execution.” and the URLs.]**

> Today: testnet, unaudited, market unproven. No customer claimed. Next, a design partner supplies
> a batch and decides if independent proof is worth paying for. Sworn: audit-ready evidence for private execution.

---

## Claims and sources

| # | Claim | Source |
|---|---|---|
| 1.1 | The operator has full visibility while account holders see only their account; an outsider cannot build the batch witness. | `tempoxyz/zones` README at `ac49071f`, plus `docs/research/moderato-zone-feasibility-20261004.md` §2; reread by the recorder. The counterparty and audit scenario is the buyer hypothesis. |
| 2.1 | The Console starts the documented local fixture prover; it uses no keys and sends no transaction. | `operator/server.mjs`, `scripts/start-zone-operator.sh`, and `docs/operator-console.md`. |
| 2.2 | Sworn runs `zone_spf::prove_zone_batch` in SP1 and exposes hashes/metadata rather than transaction contents. | Spec 003 §3 and `spikes/zone-spf`; only an operator-supplied witness can be proved. |
| 3.1 | On Moderato, our own Zone's portal settled three proven batches through `SwornZoneVerifier` and paid a withdrawal after the proof. | `deployments/moderato.json` → `OwnZone`, reread by the recorder: `portal.verifier()`, the three `submitBatch` receipts (status 1, to the portal, `BatchSubmitted`), the payout's `WithdrawalProcessed` (user, pathUSD, 500000). |
| 3.2 | Real proof verifies; a forged batch signed by our sequencer is rejected. | Recorder's own read-only `eth_call`s to our Zone's verifier (real call → true, height+1 → `InvalidProof()`); the forged-batch tx `0x3a154e4e…167d` (`OwnZone.forgedBatch`): status 0, sequencer → portal, its trace shows the verifier reverting `InvalidProof()`. |
| 4.1 | A counterparty may delay settlement or require more risk cover when it cannot independently check a private batch; the buyer, operations contract, payment model and willingness to pay are commercial hypotheses. | No customer, payer agreement, price or revenue is claimed. The consequence is a hypothesis for the first design-partner test, not a measured Tempo behaviour. Spec 004 §5 supports the engineering fact that execution upgrades require a new guest and verification key. |
| 5.1 | Sworn runs Tempo code and binds to Tempo IVerifier-shaped inputs; Tempo uses Reth and Revm. | Specs 003/004 and Tempo `Cargo.toml`. |
| 5.5 | Running alongside Tempo's TEE is a proposal, not a deployment or adoption claim. | Spec 004 and the submission form: Tempo's Nitro path exists; Sworn is proposed as an additional independent check, not its replacement. |
| 5.2 | Founder works on and teaches Reth and has 15 years building banking systems in Japan. | `README.md` “Who”; fabrknt.com/dojo (21 courses, fetched by the recorder). |
| 5.3 | The founder's previous project (Reckn) won a Uniswap Foundation prize at ETHGlobal Tokyo 2026 (3rd place, Best Uniswap Stack Contribution). | ethglobal.com/showcase/reckn-47t6m, fetched by the recorder; `README.md` “Who”. |
| 5.4 | The upgrade claim is a design intent (“built to track”), not a track record: the pinned guest predates Moderato's T12. | `README.md` “What is not done”. |
| 6.1 | Testnet-only, unaudited, our own Zone with one operator, no customers. | `README.md` status and verifier limitations, checked by the recorder. |

**Not claimed:** that Sworn protects withdrawals on Tempo's Zones; that our Zone is Tempo-created or runs
continuously; that a customer, partner, payer, price, production deployment or audit exists; or that Tempo will
adopt this design.
