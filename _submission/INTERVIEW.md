# Interview prep: Sworn (CWF, 15-minute Zoom)

Short answers first; "If pressed" adds one level of detail. Every number here is in the repo (source in brackets).
Rules:
- Say what is unknown, plainly.
- Never claim a customer, a hosted service, or protection of withdrawals on Tempo's Zones. The live settlement
  is our own Zone, one operator.
- Never say Tempo or Moderato is "broken".

## The 30-second answer

> Tempo Zones are private ledgers: only the operator holds the batch and its witness, so an auditor or a
> counterparty cannot check that money leaving a Zone came from correct execution. Sworn runs Tempo's own Zone
> verification code in a zero-knowledge VM and produces a proof anyone can verify on chain, without exposing the
> transactions. On Tempo's testnet we ran our own Zone whose portal settles a batch, and so lets a withdrawal be
> paid, only after that proof passes; change one field and it is rejected. No customers yet. Next is one design partner who supplies a real
> batch.

## Product and evidence

**1. What exactly works today?**
- Tempo's own Zone batch verifier (`prove_zone_batch`) runs inside SP1, on five batches from Tempo's integration
  tests. The output matches the native run, and tampering is rejected.
- A contract on Moderato verified the proof of a batch with one withdrawal and two user transactions
  (tx `0xa630…f770`).
- Our own Zone on Moderato (2026-10-06): three batches proven and settled through a portal that calls the
  verifier, then a withdrawal paid (tx `0xfc31…e1f1`). [spec 003 "Results (own Zone live run on Moderato)"]
- Tempo's EVM in SP1 matched 40 of 40 live Moderato transactions and 18 of 18 reverted ones.
- [README "What is measured"; deployments/moderato.json]

**2. Is the batch real?**
Two kinds. The fixtures are real Zone batches from Tempo's own sequencer code, in Tempo's integration tests on a
dev chain (1337). The live run is a real Moderato-anchored Zone, but it is our own Zone, run by us. An outsider
can't get a Tempo-run Zone's batch: only the operator holds the witness.
- *If pressed:* Zone creation on Moderato is limited to the factory owner, and all three Zones there are run by one
  party. [docs/research/moderato-zone-feasibility-20261004.md]

**3. Does it protect withdrawals?**
On our own Zone, yes in the narrow sense: its portal settles a batch, and queues its withdrawals, only after the
proof verifies. The proof is a necessary condition, not a guarantee: our sequencer then calls `processWithdrawals`,
and could also withhold it. We ran that on Moderato on 2026-10-06. On Tempo's Zones, no: their verifier is fixed by Tempo's
factory, so it stays evidence there. Spec 004 is the design for Tempo's side.
- *If pressed:* one operator, whose key also decrypts deposits; withdrawals wait for the proof but are not
  censorship-resistant (the operator must prove and process them); callback withdrawals bounce.

**4. "Audit-ready", but the code is unaudited?**
"Audit-ready" describes the output: evidence an auditor can check independently, against the chain. The prover
and contracts are unaudited, and we say so everywhere. An audit comes before anyone relies on it with real money.

**5. What does the proof reveal?**
Hashes and batch metadata: block hashes, deposit and withdrawal-queue hashes, counters, Zone id, Tempo block
numbers. Not transaction contents. [spec 003 §3]

**6. How does an auditor tie a proof to the batch that actually settled?**
On our own Zone, the portal forces it: `submitBatch` passes the batch's own fields to the verifier, so a proof of
any other batch is rejected. For Tempo's Zones it is still a manual step (compare the proved fields with the batch
the portal recorded); spec 004 would make it automatic there.

## Market and business

**7. Who pays?**
- *Hypothesis:* a business running a Zone that must give an auditor or a counterparty confidence before it
  settles.
- It would buy a Proof Operations contract: a proof for each batch it supplies, plus keeping the prover
  compatible through Tempo upgrades.
- Not validated: no customer, no price agreed.

**8. There is one Zone operator on Moderato. Where is the market?**
There is no demonstrated market today, and we say that. The immediate buyer hypothesis is either a Zone team
with a reviewer requirement or Tempo itself (proofs in settlement, spec 004). A design-partner conversation is the
next falsifiable test.

**9. Tempo chose a TEE (Nitro). Why would anyone need ZK?**
- A TEE means trusting one vendor's hardware; a ZK proof anyone can check.
- Tempo's docs: "ZK proof generation is not implemented".
- That is about Moderato's testnet today, not Tempo's production design: at the reviewed commit the Nitro
  verifier's approved measurements were unset, upstream defines a "NoProof" fallback, and Moderato's pre-T13
  reference verifier is a prototype stub that returns true for any input.
- We propose ZK as a second, independent check next to the TEE, not a replacement (spec 004).

**10. Why not Succinct, RISC Zero, or Tempo itself?**
- They could. Generic provers run programs; someone still has to port Tempo's code and keep it current.
- It took patches to tempo-revm, zone-spf and two crates, a proof bound to exactly what the portal checks, and a
  rebuild at every hardfork that changes execution.
- That is the operational work we sell. It is speed and focus, not a durable moat; we say that.

**11. What does a proof cost?**
- Measured on one laptop (12 cores, 32 GB): the fixture batches took 19–26 M cycles, 701–891 s and 18.5–19.8 GB
  peak RAM each. The live own-Zone batches took 26–124 M cycles and 664–1,881 s, depending on how many blocks the
  batch replays. Production cost, throughput and proving networks are not measured.
- We have not priced it: cost per batch on rented hardware or a proving network, aggregation and pricing are next.
- [spec 003 Results]

**12. Why you?**
- Tempo is built on Reth and Revm. I work on that stack and teach it (Fabrknt Dojo, fabrknt.com/dojo: 21 source-grounded courses on Rust, Reth, Revm and Alloy).
- My last project took a Uniswap Foundation prize at ETHGlobal Tokyo.
- Fifteen years building banking systems: I know what auditors ask an operator for.

**13. Solo founder. Can you run an operations business?**
Proving is automated. The hard part is Tempo-specific engineering, which is what I do. A first hire would be on
operations and partner integration, once a design partner exists.

## Hard questions to expect

**14. Isn't the bonded-answer demo pointless if a client can just simulate the transfer?**
For that question, yes. Anyone can reproduce it with `eth_simulateV1`, and we say so. It was the first proof that
the engine works on the live chain; the product is proofs for Zones, where outsiders cannot simulate anything
because the data is private.

**15. What happens at T12 (2026-10-08) and T13?**
- Each upgrade that changes execution needs a new guest and verifier key; that is the maintenance we sell.
- Our pinned code predates Moderato's T12 schedule, so the bonded-answer server stops answering at T12 by design.
- The proofs already on chain are unaffected.

**16. What did you get wrong along the way?**
- The first framing (paid preflight answers) turned out to be reproducible for free, so we moved to Zones.
- Our first verifier used the config tag `0x02`, which upstream later defined as NoProof, so we redeployed with a
  self-describing tag.
- Both are in the repo.

**17. What would you do with the next 90 days?**
1. One design partner and a proof of a batch they supply.
2. Turn the one-off own-Zone run into something repeatable: faster proving (rented hardware or a prover
   network), so the Zone can keep running instead of stopping after the demo.
3. Track T12/T13 in the guest.
4. Price a proof (rented hardware, aggregation).

**18. What do you want from Colosseum?**
Introductions to teams building Zones or private payment ledgers on Tempo, and to Tempo's Zones engineers.

**19. A TEE attests in moments; your proof takes 12–15 minutes. Why ZK at all?**
- For Tempo's Zones, the evidence product is off the settlement path, so its speed never delays their settlement.
  It only sets when the evidence reaches the auditor.
- On our own Zone, the proof *is* on the path, and it does delay settlement: in the live run each batch waited
  11–32 minutes for its proof (payout 58.5 minutes after the anchor). That is why the Zone was stopped after
  the demo: this prover cannot keep up with a continuously running Zone.
- In the settlement design (spec 004), the TEE settles at once and ZK only gates the payout of withdrawals.
  Deposits and Zone execution never wait for it.
- The trade-off: a TEE is fast but means trusting one vendor's hardware; a ZK proof is slow but anyone can check
  it. Hence a second check, not a replacement.
- 12–15 minutes is one laptop. GPU or proving-network times are unmeasured, so we don't quote them.

## Numbers to have ready

| | value |
|---|---|
| withdrawal batch | 1 withdrawal, 2 user txs; 24,443,996 cycles; Groth16 891 s; tx `0xa630…f770` |
| first batch | 25,536,122 cycles; Groth16 701 s; tx `0xb14b…3b80` |
| mutation | one field changed → `InvalidProof()` (live `eth_call` on the page) |
| live-chain fidelity | 40/40 transactions; 18/18 reverted transactions |
| Moderato Zones | 3, one operator; their verifier returns true for any input |
| slashes on Moderato | three recorded in deployments/moderato.json |
| status | testnet, unaudited, no customers, no revenue |
