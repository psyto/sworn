# Pitch D: Sworn (≤ 2 min, founder voice), v8.3-D, 2026-10-08

**Purpose.** Pitch C's story and motion, rebuilt to score on every CWF criterion. Tempo Zones are named in the
first sentence. Pitch C's two evidence scenes become one. The two results stay visibly and audibly separate:
scene 3 is labelled as the fixture run (dev chain 1337, read-only, nothing sent), and scene 4 opens with
"Separately" under a "separate run · our own Zone · one operator · not Tempo-created" chip.
The freed time goes to the buyer and the business: the first buyer, Proof Operations, and beside Tempo's TEE.
The scope, including "no customers yet", is said once aloud. v8.1 adds a forward hook in scene 1, why now (Tempo Zones ship no native ZK proof today) in scene 3, and the market mechanism without a TAM in scene 5.

## Scene 1 — the trust gap · ≈ 15 s

> Sworn is for Tempo Zones. They keep payments private: users see only their own; only the operator sees every transaction. So before a withdrawal, no outside reviewer can verify the private batch.

## Scene 2 — private execution, checkable validity · ≈ 15 s

> Zcash uses zero knowledge to prove a transaction is valid without revealing it. Sworn uses it differently: it proves a Zone batch executed correctly, without publishing transactions; the operator still sees them.

## Scene 3 — difficult work, shipped · ≈ 18 s

> Tempo Zones ship no native ZK proof today. We compiled Tempo's own Zone verifier for SP1, with its logic unchanged, bound it to the portal's batch inputs, and verified a test-fixture proof read-only on Moderato.

## Scene 4 — the proof is the control · ≈ 20 s

> Separately, on our own one-operator Zone, the portal settled three batches only after the proof passed; then our sequencer, not the proof, paid a withdrawal. Then our own sequencer signed a forged batch. It was rejected: a real proof cannot authorize a different batch.

## Scene 5 — the business · ≈ 22 s

> First buyer: a Zone business whose reviewer cannot reconstruct the witness. One batch tests demand; repeats and upgrades become Proof Operations. The market grows with Zones, batches and upgrades, if Zones are adopted. Later, beside Tempo's TEE.

## Scene 6 — why I can carry it forward · ≈ 20 s

> I build on Tempo's stack, Reth and Revm, and teach it through Fabrknt Dojo. Uniswap Foundation sponsor prize at ETHGlobal Tokyo; third in Superteam Japan and NTT DOCOMO R&D's side track at Colosseum's Cypherpunk hackathon. Before crypto, fifteen years of banking systems.

## Scene 7 — the honest ask · ≈ 16 s

> Today: testnet, unaudited, no customers yet. Next, one design partner supplies a batch, and its reviewer decides whether the evidence is worth paying for. Sworn: verifiable evidence for private execution.

## Claims and sources

| Claim | Source and boundary |
|---|---|
| Only the operator sees every transaction | `tempoxyz/zones` README at `ac49071f`; `docs/research/moderato-zone-feasibility-20261004.md` §2. The reviewer, delay and risk are the buyer hypothesis. |
| Tempo's own Zone code in SP1, logic unchanged | `README.md`: "build patches to zones, tempo and two dependency crates; the verification logic is Tempo's, unchanged" (reread by the recorder); spec 003. |
| Verified on Moderato, bound to the portal's batch inputs | `deployments/moderato.json` → `SwornZoneVerifierWithdrawal` (fixture from Tempo's integration tests, dev chain 1337) and `OwnZone`; receipts and bytecode reread while recording. |
| Our own Zone settled three batches after the proof; a withdrawal was paid | `OwnZone`: zone 4242, three `submitBatch` receipts, payout `0xfc31…e1f1` (`WithdrawalProcessed`, 500000 = 0.5 pathUSD). Our own Zone, one operator, not Tempo-created. The proof is necessary for settlement; the payout is the sequencer's `processWithdrawals` (not censorship-resistant). |
| Forged batch rejected | `OwnZone.forgedBatch` `0x3a15…167d`, status 0: valid sequencer certificate, a real blocks-56–61 proof replayed with a made-up withdrawal queue; the verifier reverts `InvalidProof()`. The proof was not tampered with. |
| Tempo Zones ship no native ZK proof today | Moderato's current Zone verifier is the pre-T13 reference stub that returns true without checking execution (demo scene 4, `README.md`); Tempo's production path is its TEE. |
| Market grows with Zones × batches × upgrades, if Zones are adopted | Expansion mechanism, not a TAM (`_submission/CRITERIA-MAP.md`: do not invent a TAM). |
| On screen, scene 7: “For Tempo: evaluate independent evidence beside the TEE — a proposal, not adoption” | Spec 004 is a proposal; Tempo has not adopted Sworn. |
| Users see their own; only the operator sees every transaction | `tempoxyz/zones` README at `ac49071f` (RPC-level account authentication; the operator has full visibility). Zones are private from the public, not from the operator. |
| Zcash comparison (scene 2) | A narrow analogy only: both use zero knowledge to verify a claim without revealing private data. Zcash proves shielded transaction validity; Sworn proves a Zone batch executed correctly and does not shield anything from the operator. Never "Zcash for Tempo", "Zcash-level privacy" or "the same privacy model" (Codex, `docs/reviews/pitch-privacy-r1.md`). |
| Buyer, Proof Operations, beside TEE | Commercial hypotheses (`_submission/CRITERIA-MAP.md`); beside Tempo's TEE is a proposal (spec 004), not adoption. |
| Founder | `tempo/Cargo.toml` (Reth, Revm); `https://fabrknt.com/dojo` (21 courses); ETHGlobal Reckn showcase (Uniswap Foundation sponsor prize, Best Uniswap Stack Contribution, 3rd place, ETHGlobal Tokyo 2026); Superteam official winner data for the Superteam Japan × NTT DOCOMO R&D side track of Colosseum's Solana Cypherpunk Hackathon (Sept 25 – Oct 30, 2025): psyto / Hiroyuki Saito, position 3; `README.md` Who (15 years of banking systems in Japan). All reread by the recorder. |

**Not claimed:** a customer, partner, price or revenue; that Sworn protects withdrawals on Tempo's Zones; that our
Zone is Tempo-created or a running service; censorship resistance; Tempo adoption.
