# Pitch video: Sworn (≤ 2 min, founder's voice), v4.0, 2026-10-04

**Form field:** *Pitch video · Public · ≤ 2 min · required.* The page says it is *"one of the first resources
judges review."*
- **Narration:** the founder's final v3.2 text, verbatim (six scenes, 257 words by the recorder's count,
  which does not count the dash; 258 by the founder's). At ≈ 2.2 words/s each scene is words ÷ 2.2, rounded
  up to 0.5 s: 22.5 + 16 + 15 + 31 + 16 + 17.5 = **118.0 s**. The recorder refuses more than 118 s.
- **Route (final):** near term, businesses that run Zones and answer to auditors (off-path evidence, not
  yet a guarantee); later, Tempo builds proofs into settlement (spec 004: written, not built). Either way,
  the service is running provers on time and rebuilding them at each Tempo upgrade, and that service is
  still to be validated. Today Moderato has one Zone operator and we have no customers.
- **Register:** plain language. Codex's v3 and v3.1 findings (`docs/reviews/pitch-v3-route-r1.md`,
  `pitch-v31-r1.md`) are adopted as wording fixes: "for a batch the operator supplies", "match to each batch
  they settle" (matching is the operator's and auditor's work, nothing enforces it on chain), "evidence, not
  yet a guarantee", "written, not built", "the service we want to validate", and the one-operator line.
- **Screen rule:** one scene, one claim, one visual proof. Exact hashes, ABI arguments, citations and
  explorer metadata remain on the public page and in this source document; they are not narration-sized
  evidence.
- **Every sentence has a row in the claims table at the end, or it is not said.** Every figure on screen
  is read by `record-pitch.mjs` from the source in its row, at record time; a missing source or a
  different value stops the recording.
- v2 (Zone proof first, slashes in scene 2, Tempo-first plan) is in git history (`HEAD:video/PITCH.md`
  before v3.2). v3 and v3.1 were review drafts only (`docs/reviews/payloads/`).

---

## Scene 1: the problem · ≈ 22.5 s

**[Screen: "The problem". Title: "Private Zones. Public withdrawals." Two cards: **Zone operator: sees
the full ledger** and **each Zone user: sees only their account**. The single question: "Who checks the batch
before a withdrawal?" Then one comparison: **Tempo's T13 design: hardware attestation checks each batch**;
**Moderato today, pre-T13 prototype: malformed batch → TRUE**. The latter is a live, read-only check; exact
arguments, timestamp and source remain on the public page.]**

> Tempo Zones are private blockchains on Tempo. The operator sees everything; each user sees only their
> own account. So no one outside can check that the operator ran the ledger correctly. Tempo's design
> checks batches with a hardware attestation; on testnet today, a placeholder verifier returns true for
> anything.

## Scene 2: what Sworn does · ≈ 16 s

**[Screen: "What Sworn does". Title: "Sworn makes that checkable." A flow a non-specialist can follow:
**The operator** supplies a batch → **Tempo's own Zone code**, run inside a zero-knowledge VM → **a
proof** → **anyone** verifies it on chain. Then one card: "What the proof makes public: hashes and batch
metadata, not transaction contents", listing them (zone id, Tempo and anchor block numbers, block hashes,
deposit and withdrawal queue hashes, counters), with the source: spec 003 §3 (public values = guest
version + one digest) and `SwornZoneVerifier.verify` is a `view` function anyone can call.]**

> Sworn makes that checkable. For a batch the operator supplies, it produces a zero-knowledge proof that
> Tempo's own Zone code accepts it. Anyone can verify the proof on chain, and it exposes hashes, not
> transactions.

## Scene 3: it worked, on testnet · ≈ 15 s

**[Screen: "On testnet, it worked". The pipeline in one line: Tempo's Zone batch verifier → zero-knowledge
VM → proof → a contract on Moderato. Three large facts: **1 withdrawal**, **2 user transactions**, **verified
on Moderato**. Then the live result: **real batch → true**; **one field changed → rejected: InvalidProof()**.
The transaction hash, explorer and exact call are on the public page, not competing with the conclusion.]**

> On testnet, it worked: Tempo's own Zone verification code, on a test batch that contains a withdrawal,
> verified by a contract there. Here is the transaction. Change one field, and it's rejected.

## Scene 4: who it is for · ≈ 31 s

**[Screen: "Who it is for". Three cards, appearing as the narration reaches them.
**Near term, the customers we're after: businesses that run Zones and answer to auditors.** Benefit:
"independent evidence they can match to each batch they settle." Tag: **Evidence, not yet a guarantee**,
with the reason in small type: "the proof is checked off to the side: no Zone's portal calls it, and it
stores nothing" (spec 003 §5 D2, D4).
**Later, if Tempo builds proofs into settlement: withdrawals wait for them.** Tag: **Written, not built**
(spec 004, "A proposal for Tempo, not something Sworn can deploy"; its status table, all "not built").
**Either way, the service: provers run on time, rebuilt at each Tempo upgrade.** Tag: **To be validated**,
with "next Tempo upgrade: T12 on Moderato, <date>" and spec 004 §5's "each hardfork that changes Zone
execution needs a new guest and vkey".]**

> The first customers we're after are businesses that run Zones and answer to auditors: independent
> evidence they can match to each batch they settle — evidence, not yet a guarantee. Later, if Tempo builds
> proofs into settlement, withdrawals can wait for them; that design is written, not built. Either way, the
> provers must run on time and be rebuilt at each Tempo upgrade: the service we want to validate.

## Scene 5: why me · ≈ 16 s

**[Screen: "Why me". **Reth · Revm**, with the source: Tempo's own `Cargo.toml` depends on
`paradigmxyz/reth` and `revm`. Then three cards: **teach**: rethlab, Reth source-reading courses
(`github.com/psyto/rethlab`, public); **last project**: "ETHGlobal Tokyo 2026: Uniswap Foundation, 3rd place"
(Reckn, read from ethglobal.com); **banking**: "15 years building banking systems in Japan" (README "Who").]**

> Tempo is built on Reth and Revm, the stack I work in and teach, and my last project won a Uniswap
> Foundation prize at ETHGlobal Tokyo. Fifteen years in banking taught me why auditability matters.

## Scene 6: honest limits, and next · ≈ 17.5 s

**[Screen: the honest-limits line as five chips: **Testnet · unaudited · batches from Tempo's integration
tests · Moderato: one Zone operator today · no customers**, with the source of the operator chip read now
(Tempo's Zone factory: 3 Zones, one admin, the factory owned by a 1-of-1 Safe with that same signer). Then
"Next: one design partner, and a proof of a batch they supply." Then Sworn's mark, "Sworn: Tempo's
execution, proven." and `github.com/psyto/sworn`.]**

> It's testnet and unaudited, the batches come from Tempo's integration tests, Moderato has one Zone
> operator today, and we have no customers. Next: one design partner, and a proof of a batch they supply.
> Sworn: Tempo's execution, proven.

---

## Claims and sources

Every sentence of the narration has a row. *(screen)* rows are figures shown but not spoken. "Read now" =
read by `record-pitch.mjs` while recording; a mismatch stops it.

| # | sentence or figure | source |
|---|---|---|
| 1.1 | Tempo Zones are private blockchains on Tempo. | `tempoxyz/zones` README @ `ac49071f` (read now via `gh api`): *"Zones are private blockchains anchored to Tempo"* |
| 1.2 | The operator sees everything; each user sees only their own account. | same README (read now): *"only the authorized account holder can access balances and transaction history. The Zone operator maintains full visibility into state for compliance."* |
| 1.3 | So no one outside can check that the operator ran the ledger correctly. | `docs/research/moderato-zone-feasibility-20261004.md` (read now): *"An outsider cannot build a `BatchWitness` for someone else's Zone."* (Zone RPC needs an operator credential; the redacted RPC hides transactions and disables `eth_getProof`); spec 004 §1 |
| 1.4 | Tempo's design checks batches with a hardware attestation; | Tempo docs `zones/proving` (read now): *"Tempo also implements a native Nitro attestation verifier activated by T13."* T13 is not active on Moderato (the factory's verifier code below is the pre-T13 runtime) |
| 1.5 | on testnet today, a placeholder verifier returns true for anything. | the recorder's own `eth_call` (read now) to Moderato's `0x5A56…` with an **equivalent malformed batch** (zone 99, zeros, `0xdead`, `0xbeef`, pre-T13 selector `0x7106a43e`) → `true`; its code = tempo `ZONE_VERIFIER_RUNTIME`; source `Verifier.sol` "Stub implementation that always returns true for prototyping"; Tempo docs: *"The Zones Solidity reference verifier still returns `true` without checking execution."* |
| 1.s | *(screen)* "Moderato, pre-T13 · called <time> UTC"; "the verifier of all 3 Zones on Moderato" | the same call's time; `ZoneFactory.nextZoneId()` = 4 and `zones(1..3).verifier` = `0x5A56…` (read now) |
| 2.1 | Sworn makes that checkable. | summary of 2.2–2.3 |
| 2.2 | For a batch the operator supplies, it produces a zero-knowledge proof that Tempo's own Zone code accepts it. | spec 003 (`zone_spf::prove_zone_batch` from zones `ac49071f` inside SP1; tampered inputs rejected, "Results"); only the operator holds the witness (research §2, spec 004 §5). Proved so far: dev-chain batches only (6.2) |
| 2.3 | Anyone can verify the proof on chain, | `contracts/src/SwornZoneVerifier.sol`: `verify(…)` is `external view`, no caller check (spec 003 §5 D2; read now); the public page calls it from a browser |
| 2.4 | and it exposes hashes, not transactions. | spec 003 §3 (read now): public values = `abi.encode(ZONE_GUEST_VERSION, digest)`; the `verify` arguments are batch metadata and hashes (block numbers, block hashes, deposit/withdrawal queue hashes, counters), not transaction contents. On screen: "hashes and batch metadata, not transaction contents" |
| 3.1 | On testnet, it worked: Tempo's own Zone verification code, on a test batch that contains a withdrawal, verified by a contract there. | attest `0xa63009fd…f770`, block 38097996, 260,863 gas, `ZoneBatchVerified` from `0xF2e1…BA11` (`deployments/moderato.json` `SwornZoneVerifierWithdrawal`; receipt, event, codehash read now; digest = fixture); batch line "1 withdrawal, 2 user transactions, dev chain 1337" and its `withdrawalQueueHash` = fixture = attest calldata (read now) |
| 3.2 | Here is the transaction. | explorer page of `0xa630…`, captured now, cropped to its transaction card (no explorer header); its Events tab shows `ZoneBatchVerified`'s topic0 |
| 3.3 | Change one field, and it's rejected. | the recorder's own `eth_call`s (read now) to `0xF2e1…BA11`: `verify(real)` = true; `verify(nextZoneHeight + 1)` reverts `InvalidProof()` |
| 3.s | *(screen)* 24,443,996 cycles, Groth16 891 s | `spikes/zone-spf/z-logs/prove-moderato-deposit_and_withdrawal_blocks5-6.log` = `SwornZoneVerifierWithdrawal.attest.proving` |
| 4.1 | The first customers we're after are businesses that run Zones and answer to auditors: | the founder's route (a hypothesis, said as intent: "we're after"); no customer exists (6.4). Zones' README: the operator keeps full visibility "for compliance" (1.2) |
| 4.2 | independent evidence they can match to each batch they settle | the digest binds every `NitroBatchAttestation` field of the batch plus verifier, config, genesis and destination chain (spec 003 §3); matching it to the operator's `submitBatch` is operator/auditor work, not enforced (Codex `pitch-v3-route-r1`) |
| 4.3 | — evidence, not yet a guarantee. | spec 003 §5 D2 (no caller check) and D4 (`attest` "moves nothing and stores nothing", must not be generalized to settlement), read now; README "It does not secure withdrawals" |
| 4.4 | Later, if Tempo builds proofs into settlement, withdrawals can wait for them; | spec 004 (read now): *"A proposal for Tempo, not something Sworn can deploy."*, *"Payouts wait for ZK."* |
| 4.5 | that design is written, not built. | spec 004 §6 status table (read now): guest commitment, range guest, invalidity guest, portal changes, config policy all "not built" |
| 4.6 | Either way, the provers must run on time and be rebuilt at each Tempo upgrade: | spec 004 §5 (read now): *"each hardfork that changes Zone execution needs a new guest and vkey"*, "on time, on an SLA"; README: T12 activates on Moderato 2026-10-08 14:00 UTC (read now) |
| 4.7 | the service we want to validate. | README "The plan" (no payer has agreed); no customers (6.4) |
| 5.1 | Tempo is built on Reth and Revm, | vendored `tempo/Cargo.toml` (read now): `reth-*` from `github.com/paradigmxyz/reth`, `revm = …` |
| 5.2 | the stack I work in and teach, | `github.com/psyto/rethlab` (public, read now): Reth source-reading courses; README "Who" |
| 5.3 | and my last project won a Uniswap Foundation prize at ETHGlobal Tokyo. | ethglobal.com/showcase/reckn-47t6m (read now): "Uniswap Foundation … 3rd place", "ETHGlobal Tokyo 2026" |
| 5.4 | Fifteen years in banking taught me why auditability matters. | README "Who" (read now): "15 years building banking systems in Japan"; the lesson is the founder's own testimony |
| 6.1 | It's testnet and unaudited, | README status (read now): "Moderato testnet only. Unaudited." |
| 6.2 | the batches come from Tempo's integration tests, | README "What the Zone verifier is, and is not" (read now): **"The batches are not from Moderato."** |
| 6.3 | Moderato has one Zone operator today, | read now on Moderato: `ZoneFactory.nextZoneId()` = 4; zones 1–3 share one admin and one sequencer set; `owner()` is a Safe whose only owner is that admin, threshold 1 (research §1) |
| 6.4 | and we have no customers. | README (read now): "Traction: none." |
| 6.5 | Next: one design partner, and a proof of a batch they supply. | the founder's next step; why: only an operator can supply a witness (1.3); "Today Moderato has one Zone operator and no external customers; our immediate milestone is a design-partner commitment and proof for an operator-supplied batch" (Codex `pitch-v31-r1`) |
| 6.6 | Sworn: Tempo's execution, proven. | tagline; what it points at is 3.1 (one Tempo Zone verification, proven and verified on Moderato). Codex suggested a narrower close; the founder kept this one |

**Not said, on purpose** (and not shown):
- "a proof for every batch", "every batch of a live Zone", or "for each batch" as a promise;
- that Sworn secures or protects withdrawals (in any tense but "later, if Tempo builds it");
- "our customers are…" as if they exist; any user, customer, partner, pilot or revenue;
- "the same input" for Moderato's verifier (the call is an **equivalent malformed batch**: pre-T13
  10-argument ABI, not `IVerifier`'s 12);
- that Tempo or Moderato is broken; Moderato's verifier is a pre-T13 prototype stub, described as such;
- that a Zone settles with Sworn, or that the batch is from Moderato;
- "reveals nothing" or "private": it exposes hashes and batch metadata;
- that Tempo will pay, is the only buyer, or has been asked; acquisition;
- "verification layer"; production, mainnet, audited; other chains by name;
- the bonded-answer slashes (the demo shows them; the pitch does not need them).
