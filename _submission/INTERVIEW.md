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
> paid, only after that proof passes; a forged batch, even signed by our own sequencer, was rejected on chain. No customers yet. Next is one design partner who supplies a real
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
and could also withhold it. We also showed the rejection side: our own sequencer, with a valid signature, submitted a
forged batch replaying a real proof, and it reverted on the proof (tx `0x3a15…167d`, state unchanged). We ran that on Moderato on 2026-10-07. On Tempo's Zones, no: their verifier is fixed by Tempo's
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
There is no demonstrated market today, and we say that. The immediate buyer hypothesis is a Zone business
whose reviewer cannot reconstruct the private witness. Tempo itself (an independent check beside its TEE, spec 004)
is a later proposal, not the first buyer. A design-partner conversation is the
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
- My last project, Reckn, took a Uniswap Foundation sponsor prize (Best Uniswap Stack Contribution, 3rd place) at
  ETHGlobal Tokyo 2026; I also placed 3rd in the Superteam Japan × NTT DOCOMO R&D side track of Colosseum's Solana
  Cypherpunk Hackathon (2025). Fabrknt Dojo has 21 courses and 234 lessons.
- Fifteen years building banking systems: I know what auditors ask an operator for.

**13. Solo founder. Can you run an operations business?**
Proving is automated. The hard part is Tempo-specific engineering, which is what I do. A first hire would be on
operations and partner integration, once a design partner exists.

## Hard questions to expect

**14. Isn't the bonded-answer demo pointless if a client can just simulate the transfer?**
For that question, yes. Anyone can reproduce it with `eth_simulateV1`, and we say so. It was the first proof that
the engine works on the live chain; the product is proofs for Zones, where outsiders cannot simulate anything
because the data is private.

**15. What happened at T12 (2026-10-08), and what about T13?**
- Each upgrade that changes execution needs a new guest and verifier key; that is the maintenance we sell.
- T12 activated on schedule. Our pinned Tempo already had its activation time, so the bonded-answer server's
  schedule check still matches. After T12, 20 / 20 transfers and 10 / 10 reverted transactions replayed with the
  pinned engine matched their receipts (samples, 2026-10-09).
- T13 is not scheduled on Moderato yet. When it is, the live schedule changes and the server refuses until the
  guest is updated, by design.
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
3. Track T13 in the guest (T12 re-checked 2026-10-09).
4. Price a proof (rented hardware, aggregation).
5. Benchmark batch size: one proof amortises on-chain verification over more transactions, but proving time,
   memory, hardware cost and settlement latency can rise with batch size. The ≈ 260k-gas attest is one fixture
   measurement, not a production per-transaction price.
6. Prototype one narrowly specified audit-property proof (per token, for a named Zone and a finalized Tempo
   checkpoint) and measure what extra public commitments, circuit work, proving cost and reviewer workflow it needs.
   Solvency or TIP-403 compliance are examples that need their own statement design; today's proof does not cover them.
7. Agent payments only with a design partner: a counterparty could verify settlement evidence without seeing the
   ledger, but Sworn has no agent integration or MPP product and does not solve operator liveness or finality.

**18. What do you want from Colosseum?**
Introductions to teams building Zones or private payment ledgers on Tempo, and to Tempo's Zones engineers.

**19. A TEE attests in moments; your proof takes 12–15 minutes. Why ZK at all?**
- For Tempo's Zones, the evidence product is off the settlement path, so its speed never delays their settlement.
  It only sets when the evidence reaches the auditor.
- On our own Zone, the proof *is* on the path, and it does delay settlement: in the live run each batch waited
  11–31 minutes for its proof (payout 58.5 minutes after the anchor). That is why the Zone was stopped after
  the demo: this prover cannot keep up with a continuously running Zone.
- In the settlement design (spec 004), the TEE settles at once and ZK only gates the payout of withdrawals.
  Deposits and Zone execution never wait for it.
- The trade-off: a TEE is fast but means trusting one vendor's hardware; a ZK proof is slow but anyone can check
  it. Hence a second check, not a replacement.
- 12–15 minutes is one laptop. GPU or proving-network times are unmeasured, so we don't quote them.

**20. Isn't this just Zcash for Tempo?**
- No. Both use zero knowledge to verify a claim without revealing private data, and that is all they share.
- Zcash proves each shielded transaction is valid and hides it from everyone. Sworn proves a Zone batch was
  executed correctly by Tempo's own Zone code; it shields nothing from the operator, who still sees every
  transaction. Zones are private from the public, not from their sequencers.
- So the shared part is only "verify without revealing"; Sworn is not Zcash-level privacy.

**21. How is a Zone different from Solana's Contra or a Lightning channel?**
- Contra is the closer analogy: operator-run private execution backed by public escrow (Contra holds SPL tokens
  in an onchain escrow program; a Zone's portal holds the deposits). Sworn does not prove Contra's code.
- Lightning is different: each party holds signed state and can enforce it on chain alone. A Zone user cannot;
  the operator runs the ledger. Sworn does not change that.

**22. What exactly does Sworn prove, and what does it not guarantee?**
- Proves: a specified private batch executes correctly under Tempo's own Zone verifier, bound to the inputs the
  portal's `IVerifier` receives. On our own Zone, the portal settles a batch only if that proof passes.
- Does not guarantee: data availability, that a transaction was included, that proving keeps going, that the
  sequencer processes withdrawals (it paid ours, but could withhold), or censorship resistance. The proof is a
  necessary condition for a payout, not a guarantee.

**23. Is Sworn an AI-agent payments product?**
- No. The product today is independent validity evidence for private Zone execution.
- Agent payments are a possible application only after a buyer validates the core proof workflow.
- The hard constraints remain proving latency, the counterparty's settlement requirements, policy enforcement and
  operator withholding.

**24. "Only the operator sees every transaction": isn't it the sequencers?**
- Yes: a Zone is run by its operator's sequencer set (a leader and followers). "The operator" in the pitch means
  that set. Account holders see only their own activity (RPC-level authentication); the public sees none.

**25. What existed before the hackathon?**
- The repo started inside the window (2026-10-03). It vendors Succinct's SP1 verifier contracts (v6.1.0,
  unmodified) and fetches and patches Tempo and Tempo Zones at pinned commits; none of that is my code.
- The design discipline (no owner, no admin, a build check that fails if one appears) comes from my earlier
  project Reckn; no Reckn code is used. All of this is in the README and should be in the form's disclosure.

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
