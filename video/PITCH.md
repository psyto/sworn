# Pitch video: Sworn (≤ 2 min, founder's voice), v5.4 (own-Zone live run), 2026-10-06

**One sentence.** Before a Zone business releases a withdrawal batch, Sworn creates independently verifiable,
audit-ready evidence for that exact batch — without exposing customer transaction contents.

The pitch follows a buyer's operational moment: a private Zone is about to release a withdrawal batch and a
counterparty needs evidence without receiving the private ledger. The proof pipeline is the reason the
product can exist, not the pitch's subject.

- **Narration:** six scenes, under 118 seconds.
- **Product boundary:** the Operator Console starts the local fixture prover. It is not a hosted service,
  takes no arbitrary inputs, uses no keys, and sends no transaction.
- **Honesty rule:** the live settlement is our own Zone on Moderato (2026-10-06): one operator, not a
  Tempo-created Zone, stopped after the payout. The workflow in scene 2 uses Tempo's Zone integration-test fixture
  on development chain 1337. Sworn is testnet-only, unaudited and has no customers; Tempo's own Zones are unchanged.

---

## Scene 1: the operational moment · ≈ 20 s

**[Headline: “Before a Zone releases a withdrawal batch.” A Zone business card holds a blurred private ledger
(“Private ledger · batch witness”, locked); a “Withdrawal batch” token slides out of it toward a card for the
“Auditor / settlement counterparty: needs evidence, not the private ledger”, whose “?” resolves into “Can it
independently check this exact batch?” The answer: “Sworn creates audit-ready evidence.”]**

> Before a Zone business releases a withdrawal batch, an auditor or settlement counterparty may need to
> check it. But the operator holds the private ledger and the batch witness. Sworn creates independently
> verifiable, audit-ready evidence for that exact batch, without exposing customer transaction contents.

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

## Scene 4: the go-to-market test · ≈ 17.5 s

**[Headline: “Earn the right to a recurring contract.” A progress line advances through three cards, each
appearing as it is spoken: “1. An operator supplies its witness”; “2. Sworn proves one batch; its reviewer
re-verifies”; “3. Repeat for the next batch or upgrade.” A small tag reads “GTM test — not traction claimed.”]**

> Go-to-market: one Zone business supplies its witness; we prove one batch and its reviewer re-verifies it. If
> it asks for the next batch or upgrade, that is a Proof Operations contract. That is our go-to-market test — not
> traction.

## Scene 5: why now, why Sworn · ≈ 26 s

**[Headline: “Why now, why Sworn.” Three cards: “Tempo execution: runs Tempo's own Zone code”; “Exact batch:
bound to inputs Tempo's portal understands”; “Operational fit: rebuilt for Tempo upgrades.” The footer says
“ZK proving for Zones: not implemented” and “Reth · Revm · ETHGlobal Tokyo, Uniswap Foundation prize · 15 years · banking systems.”]**

> ZK proving for Zones is still unimplemented. Sworn runs Tempo's code, binds to portal-shaped inputs, and
> is built to track execution upgrades. The market is not proven — Tempo's Zones have one effective operator. I work on Reth
> and Revm, teach that stack, won a Uniswap Foundation prize at ETHGlobal Tokyo, and spent fifteen years
> building banking systems.

## Scene 6: the honest ask · ≈ 13 s

**[Headline: “The honest ask.” Chips: “testnet”; “unaudited”; “our own Zone, one operator”; “no
customer claimed.” Then: “Next: a design partner supplies a batch and decides whether the proof is worth paying
for.” The Sworn seal stamps onto the closing block: “Sworn: audit-ready evidence for private execution.” and the URLs.]**

> Today: testnet, unaudited. No customer claimed. Next, a design partner supplies
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
| 4.1 | Buyer, operations contract, payment model and willingness to pay are commercial hypotheses. | No customer, payer agreement, price or revenue is claimed. Spec 004 §5 supports the engineering fact that execution upgrades require a new guest and verification key. |
| 5.1 | Sworn runs Tempo code and binds to Tempo IVerifier-shaped inputs; Tempo uses Reth and Revm. | Specs 003/004 and Tempo `Cargo.toml`. |
| 5.2 | Founder works on and teaches Reth and has 15 years building banking systems in Japan. | `README.md` “Who”; fabrknt.com/dojo (21 courses, fetched by the recorder). |
| 5.3 | The founder's previous project (Reckn) won a Uniswap Foundation prize at ETHGlobal Tokyo 2026 (3rd place, Best Uniswap Stack Contribution). | ethglobal.com/showcase/reckn-47t6m, fetched by the recorder; `README.md` “Who”. |
| 5.4 | The upgrade claim is a design intent (“built to track”), not a track record: the pinned guest predates Moderato's T12. | `README.md` “What is not done”. |
| 6.1 | Testnet-only, unaudited, our own Zone with one operator, no customers. | `README.md` status and verifier limitations, checked by the recorder. |

**Not claimed:** that Sworn protects withdrawals on Tempo's Zones; that our Zone is Tempo-created or runs
continuously; that a customer, partner, payer, price, production deployment or audit exists; or that Tempo will
adopt this design.
