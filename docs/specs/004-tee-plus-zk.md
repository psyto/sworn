# 004 — TEE + ZK for Tempo Zone batches: a design proposal

Status: **r3 (2026-10-04)**, after Codex r1 and r2 CHANGES (`docs/reviews/004-spec-r1.md`, `-r2.md`). r2's remaining
findings are about pieces this proposal deliberately leaves to Tempo or to future work; r3 makes those
explicit preconditions and non-guarantees rather than claims.

**A proposal for Tempo, not something Sworn can deploy.** Tempo's factory fixes each Zone's verifier
(`zone_factory/mod.rs:110,172`), so every change below lands in Tempo's verifier or portal, or nowhere.
It builds on spec 003: an `IVerifier`-shaped ZK verifier, verified on Moderato (tx `0xb14b7127…3b80`). As
§6 says, **the statement this design needs is not the one spec 003 proves.**

## 1. Where Tempo is today (verified)

| | source |
|---|---|
| `submitBatch` (sequencer-only) calls **one** `IVerifier.verify(…, verifierConfig, proof)` and reverts if false | `ZonePortal.sol:1313-1327`, `:1413-1428` |
| `verifierConfig` is batch calldata whose hash is in the **quorum-signed** settlement attestation, so it is chosen per batch **by the sequencer quorum** | `ZonePortal.sol:108`, `:1482-1522` |
| Settlement and payout are separate. `submitBatch` enqueues the batch's withdrawal hash-chain into a queue **slot** (`:1442-1455`); `processWithdrawals` (sequencer-only, `whenNotPaused`) dequeues **FIFO from the head slot** (`:1090-1125`). Empty batches take no slot, so batch index ≠ slot index | `WithdrawalQueueLib.sol:13-18`, `:53-61` |
| Money also leaves the portal outside `processWithdrawals`: deposit bounce-back and `claimRefund` | `ZonePortal.sol:1129-1139`, `:1215-1247` |
| `pause()` is discretionary (admin, sequencer or guardian). It also pauses deposits, expires after 30 days, and the admin can resume | `ZonePortal.sol:96`, `:622-645` |
| The portal keeps only queue hashes and indices per slot. Other settlement fields are overwritten global state or are emitted in events | `ZonePortal.sol:580-589`, `:1430-1455` |
| `0x01` = Nitro. T13's native verifier checks the certificate chain, signature, enclave measurements and batch digest; *"approved enclave measurements are unset, so it rejects proofs"* | Tempo docs, *Zone proving and settlement* |
| `0x02` = NoProof, *"a temporary fallback that keeps settlement moving when no Nitro proof is available"* | zones `344ff785`, `bin/prover/enclave/README.md` |
| Moderato today: every Zone uses `0x5A56…`, which returns `true` for any input; zone 3 submits `0x02` with empty proofs | `docs/research/moderato-zone-feasibility-20261004.md` |
| An outsider cannot obtain a Zone's blocks, state witness or genesis; only the operator can build a witness | same, §2 |
| *"ZK proof generation is not implemented"* | Tempo docs |

**Structural point:** the quorum picks `verifierConfig`, so adding ZK as one more accepted config adds an
option and removes no risk. The quorum can always choose the weakest config the verifier accepts.
Policy on **which configs a Zone accepts** has to sit in the verifier or the portal.

## 2. What we want

- **G1 Safety:** no money leaves the portal (withdrawal, bounce-back, refund) as a result of a batch,
  unless that batch has passed **both** checks: the TEE and a ZK proof of `prove_zone_batch` for **exactly
  that batch**.
- **G2 Liveness, stated honestly:** settlement, deposits and Zone execution never wait for ZK. Payouts
  wait for ZK. Because only the operator holds the witness (§1), payouts depend on the operator proving.
  That is the same dependence Zones already have on a live sequencer (`processWithdrawals` and forced
  exits both require one; `crates/exithatch/README.md`), now extended to proving. **B does not remove
  operator liveness risk.**
- **G3 No new unilateral power:** no prover operator, guardian or Sworn can release money or settle a batch
  alone.
- **G4 Disagreement is provable on chain:** a ZK proof that a settled batch is invalid freezes payouts
  permissionlessly, and only payouts.

## 3. Recommended: B, where the TEE settles and ZK releases payouts

### 3.1 Settlement stores an immutable per-batch commitment

**Precondition (TEE policy, r2 BLOCKER 1).** A commitment is created only when the batch was settled under
the Zone's **approved TEE config** (`verifierConfig == 0x01`, Nitro, with measurements set). The portal
checks this itself and records it, alongside the commitment, as an immutable `teeFinal` fact. "`verify`
returned true" is not enough: today's reference verifier returns true for anything (§1). A Zone whose
policy is not in place gets **no** B guarantees.

On `submitBatch`, with that precondition met, the portal stores:

```
batchCommitment[batchIndex] = keccak256(abi.encode(
    zoneId, tempoBlockNumber, anchorBlockNumber, anchorBlockHash,
    expectedWithdrawalBatchIndex, nextZoneHeight,
    blockTransition, depositQueueTransition, tokenEnablementTransition, withdrawalQueueHash))
batchSlot[batchIndex] = assigned slot, or NONE if the batch enqueued no withdrawals
```

The commitment covers the batch's **inputs and outputs only**, not the verifier or `verifierConfig`.
The same batch therefore has the same commitment whichever check settled it. It is written once and
never overwritten. This answers r1 BLOCKER 2: the proof is checked against stored state, not against the
portal's current global fields.

### 3.2 The ZK statement (new, not spec 003's)

The guest runs `prove_zone_batch(witness)` and commits `abi.encode(GUEST_VERSION, batchCommitment)`,
computed exactly as in §3.1 from `witness.public_inputs` and the `BatchOutput`.

**This is not what spec 003's guest commits.** Spec 003's digest binds a verifier address and
`"sworn-sp1-groth16-v1"`, and it aborts on other configs (r1 BLOCKER 1). The execution, binding code and
measurements carry over; the committed statement is a new guest version.

### 3.3 Finalising, one batch or a range

`finalizeWithZk(firstBatch, lastBatch, proof)` is permissionless.

- **Range proofs** commit the **ordered vector** of per-batch commitments, as a hash chain
  `h_i = keccak256(h_{i-1}, batchCommitment_i)`. The contract recomputes the chain from storage over
  exactly `[firstBatch, lastBatch]`, so it cannot be fed a gap, an omission or a reordered batch.
- Consecutive batches are linked anyway (`blockTransition.prevBlockHash` must equal the previous
  `nextBlockHash`, `ZonePortal.sol:1328`). The aggregated guest checks that link too.
- On success, every batch in the range is marked `zkFinal`.

### 3.4 Every payout path checks `zkFinal`

- **`processWithdrawals`:** may dequeue the head slot only if the batch that enqueued it is `zkFinal`.
  Payouts stay FIFO; one unfinalised head slot blocks later payouts. That is intended (order is part of
  the queue's semantics), and it is a liveness cost.
- **Bounce-back and `claimRefund`:** the funds trace back to a batch, so the same check applies to the
  originating batch. Each path needs its own audit.

### 3.5 Proving a mismatch (G4)

`proveInvalid(batchIndex, proof)` is permissionless. It takes a ZK proof that re-executing the Zone blocks
committed by `blockTransition.nextBlockHash`, from the committed previous state, **fails or yields
different outputs** from those in `batchCommitment[batchIndex]`. On success:

- it sets `payoutsFrozen`, a new flag that is not the existing `pause()`;
- deposits and Zone execution continue;
- only a Tempo upgrade or governance can unfreeze.

This is a third guest statement, an invalidity proof, and it is **not built**. It must be a total,
deterministic statement: bound to the exact predecessor, the batch's committed inputs, and the divergent
result, and still yielding an accepting proof when execution diverges. Unfreeze and recovery rules are
Tempo's. **G4 is therefore a target, not a property of this design today.** What B guarantees without it:
a wrong batch is never finalised, so its money stays locked. That is safe, but it is not a signal.

### 3.6 What B removes

- **No "late past a bound" exception.** r1 found that a guardian-signed release would give guardians
  unilateral payout power, which breaks G1 and G3.
- If ZK never arrives, payouts wait. Resolution is a Tempo upgrade, not a role.

## 3.7 What B does not guarantee

- **Withdrawal liveness against a withholding operator.** A sequencer can settle batches and never
  produce the proofs. Outsiders cannot reconstruct witnesses (§1), and FIFO means one unproven head slot
  blocks every later payout. B makes that visible (§5), not impossible.
- **G4**, until §3.5 is built (above).
- **Anything on today's Moderato.** Moderato is pre-T13: its portals use the older `IVerifier`. B is a
  protocol migration (portal state, payout paths, verifier policy, existing queues), not a patch.

## 4. Alternatives

- **A, both on every batch (2-of-2 in `verify`):** safest, but settlement latency becomes proving latency.
  The only measurement is 25,536,122 cycles and 701 s Groth16 for one dev-chain batch on one laptop (spec
  003 "Results (AC-Z5, sworn-sp1-groth16-v1)"). Viable only with much faster proving or aggregation.
- **C, ZK only above a threshold:** a refinement of B. Attackers split withdrawals around per-batch
  thresholds, so the threshold needs a time window.
- **Rejected:**
  - ZK as one more accepted `verifierConfig` (§1);
  - ZK replacing Nitro (latency, and it discards a check Tempo built);
  - any guardian release path (§3.6).

## 5. Who proves, and who pays

- Submitting a proof is permissionless; **producing** one requires the witness, which only the operator
  has (§1). So the realistic shape is: **the operator, or a prover it contracts, proves every batch.**
  Sworn's commercial role is that contracted prover: on time, on an SLA, with the guest kept in step with
  each Tempo hardfork.
- A public **"oldest unfinalised batch"** age makes delay visible to users.
- **Who pays** (the operator, as the cost of offering withdrawals, or a per-withdrawal fee) is **open**.
- **Upgrades:** each hardfork that changes Zone execution needs a new guest and vkey. The verifier must
  accept the vkey **for each batch's fork**, never "any vkey".

## 6. Status: what exists and what doesn't

| | status |
|---|---|
| `prove_zone_batch` in SP1, bound to `IVerifier`'s inputs, verified on Moderato | **done**, spec 003 (different statement from §3.2) |
| a portal that settles only after the ZK proof, on our own Zone (ZK-only, synchronous; not this spec's TEE + ZK design) | **done once on Moderato**, 2026-10-06: 3 batches, 1 withdrawal paid (spec 003 "Results (own Zone live run on Moderato)") |
| guest committing `batchCommitment` (§3.2) | not built; same execution with a new commitment |
| aggregated range guest (§3.3) | not built; SP1 recursion; not measured |
| invalidity-proof guest (§3.5) | not built; the hardest piece |
| portal: commitment storage, `finalizeWithZk`, `zkFinal` checks on all payout paths, `payoutsFrozen`, `proveInvalid` | not built; a Tempo portal change, with each payout path audited |
| per-Zone accepted-config policy | not built; Tempo's verifier or portal |
| latency and cost at production batch rates | **not measured** |
| migration of existing Zones and queues | not designed |

## 7. Questions for Tempo

1. Where should per-Zone config policy live: in the native verifier or in the portal?
2. Is a payout delay until ZK finality acceptable to Zones' users, and should it be FIFO-blocking?
3. Is a permissionless, proof-triggered `payoutsFrozen` acceptable, as distinct from `pause()`?
4. Witness availability: should operators publish witnesses (encrypted, or to a committee) so that proving
   is not operator-only?
5. Should there be one verifier entry per hardfork, set by Tempo?

## 8. Non-goals

Implementing any of this in Tempo's code; a production prover service; a specific prover network; prices.
