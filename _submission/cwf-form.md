# CWF submission form: Sworn (v6, 2026-10-09: entered in Colosseum, still a draft until the founder submits)

**Every field below is written to be pasted.** Limits are the form's own (field list and limits taken
from the copy of this form kept for the previous entry); `scripts/cwf-form.sh` counts them.
The own-Zone live run happened on 2026-10-06 and its numbers are filled in (`deployments/moderato.json` → `OwnZone`).
**`[FILL AFTER MODERATO]`** marks numbers that exist only after a Moderato deployment — never paste a
draft with that marker in it. **`[FOUNDER]`** marks fields only the founder can write or enter.

This replaces the previous CWF entry (one product per team).

---

## Project name · Public

```
Sworn
```

## Brief description · Public · ≤500

```
Sworn proves a private Tempo Zone batch executed correctly—without publishing its transactions. Tempo's docs say ZK proof generation is not implemented for Zones. Sworn addresses this gap using Tempo's own Zone code to generate proofs anyone can check on-chain while keeping data private. On Moderato, 3 batches settled only after their proofs verified, and a forged batch was rejected. Testnet only: unaudited, operated on our own single-operator Zone, not Tempo-created.
```

## Project website · Public

```
https://psyto.github.io/sworn/
```

## What are you building, and who is it for? · ≤1000

```
Zone transactions are private, meaning external auditors and counterparties cannot recreate batches using public data alone. I am building Sworn for Zone operators and their external reviewers.
The workflow is concrete:
The operator provides a batch witness.
Sworn executes Tempo's Zone code inside the SP1 zkVM.
A contract on Tempo verifies the proof against the batch's public inputs (hashes and metadata).
This allows reviewers to independently verify that a specific batch was executed correctly without revealing private transaction contents.
Currently, this is only demonstrated on our own single-operator Zone. The initial validation step is to deliver a reproducible verification procedure for one actual operator's batch to their reviewer, for which I have opened an onboarding issue template.
```

## Why did you decide to build this, and why build it now? · ≤1000

```
I build in Rust on Tempo's stack (Reth, Revm, Alloy, Foundry) and wrote Fabrknt Dojo, 21 courses on that stack, and Veil, a privacy library (@fabrknt/veil-core). Reckn won a Uniswap Foundation sponsor prize at ETHGlobal Tokyo 2026; I was 3rd in the Superteam Japan × NTT DOCOMO R&D side track of Colosseum's Cypherpunk; and I spent 15 years building banking systems in Japan.

I believe privacy and batch processing matter to individuals and are essential for businesses. Tempo Zones offer both: private ledgers settling in batches. But the operator holds the witness, and an outside reviewer can't recreate a private batch from public data. Tempo Zones ship no native ZK proof today.

In this hackathon, Tempo's Zone verifier ran in SP1 and a contract on Moderato verified the proof. Separately, our own Zone's portal verified each proof before settling a batch; our sequencer then paid a withdrawal. Why now is a hypothesis: Zones are testnet, so a first operator can shape evidence requirements.
```

## How does your product use these chains? · ≤500

```
Tempo (Moderato). SwornZoneVerifier, with Tempo's IVerifier signature, verifies Groth16 proofs of Zone batches on Moderato through the SP1 Groth16 verifier deployed there: one instance for an integration-test fixture (dev chain 1337), a separate one for our own Zone, whose ZonePortal calls it in every submitBatch. Inside the proof runs Tempo Zones' own prove_zone_batch code, bound to the batch inputs and destination chain.
```

## What technologies are you using or integrating with? · ≤500

```
Tempo: Zones (zone-spf, the IVerifier interface, ZonePortal), Foundry on Tempo (67 forge tests, deployment), tempo-revm. Paradigm stack: Reth, Revm, Alloy. Succinct SP1 6.3: zkVM guests and Groth16, verified on-chain by SP1VerifierGroth16 v6.1.0. React for the live page and demo. A separate bonded-answers experiment in the repo also uses TIP-20 receive policies, Tempo transactions (type 0x76), MPP (mppx) and viem.
```

## Which chains · select

```
Tempo
```

## Category · Public

```
Developer Infrastructure
```

## Is your project a mobile-focused dApp?

```
No
```

## Where is your team primarily based? · Public

```
Japan
```

## Notes for judges — anyone not listed who did meaningful work · ≤600

```
Solo founder; no collaborators, contractors or teammates. AI tools used for code review and implementation assistance are documented in the repo (README, docs/reviews/).
```

## Anything else judges should know · ≤500

```
This entry began as Confide, carried over from Stocklana (check-in 1, Sep 21): private block trades for tokenized stocks, hot on Solana. A confidential transfer turned out to need the issuer to approve the recipient, so I judged it premature. Given my Reth/Revm work, Fabrknt Dojo, privacy work (Veil), attention on Zcash's privacy, and my view that Tempo will need private batch transactions, I moved to Tempo on Oct 3 and to Zones on Oct 4. No product code was reused (only recorder boilerplate).
```

---

# Media and code

## Project logo or graphic · Public · required

```
_submission/brand/mark-512.png (square mark); _submission/brand/card-1200x630.png (wide card)
```

## GitHub link · Public · required

```
https://github.com/psyto/sworn
```

## Important context about the repo · ≤500

```
The repo starts 2026-10-03, inside the window. Start at README.md. docs/specs/ has the specs (003 = Zone verifier); docs/reviews/ has independent reviews. spikes/zone-spf/ holds the Zone guest; spikes/own-zone/ the own-Zone run. deployments/moderato.json records every Moderato transaction from receipts. contracts/: 67 forge tests. Confide, the earlier entry, is a separate repo begun Sep 12 for Stocklana, before the window; none of its product code is in Sworn.
```

## Demo video · ≤3 min · required

```
https://youtu.be/GZz52yUDJKo
```

## Live product link

```
https://psyto.github.io/sworn/
```

## Access instructions · ≤300

```
Open https://psyto.github.io/sworn/evidence/ — no signing or install. It reads Moderato public RPC. Re-verify on chain repeats a recorded proof: exact call succeeds; changing one field reverts InvalidProof. Tests: git clone https://github.com/psyto/sworn && cd sworn/contracts && forge test
```

## Pitch video · Public · ≤2 min · required

```
https://youtu.be/qTBetXF5SPY
```

## X profile · Public

```
@psyto
```

---

# Accelerator questions

## How do you know people actually need, or will need this product? · ≤1000

```
No direct demand validation yet: $0 revenue, no requests from customers, design partners, or auditors. Technical proof is not customer traction.

From my background in banking and settlement systems, I observe that corporate high-value batch processing requires mandatory reconciliation, auditability, and counterparty explanation. Tempo targets batch flows like payroll and merchant payouts. While Zones protect transaction privacy, external auditors and counterparties cannot verify the operator’s private ledger. I believe demand for such privacy will grow. Sworn bridges this: the operator generates a proof allowing external parties to verify batch validity independently without revealing details or trusting the operator.

Outreach via X, Tempo GitHub issue, and an intake template yielded zero responses as of Oct 11.

The first true demand signal is when proof is requested for the next batch and a budget owner is identified. If no operator values this, the service thesis fails.
```

## How far along are you? Do you have users? · ≤1000

```
No users, no revenue. On-chain verification and the own-Zone run are on Moderato testnet, the fixture batches ran on dev chain 1337:
- Our own Zone on Moderato: 3 batches proven and settled through a portal that calls Sworn's verifier; then our sequencer separately paid a withdrawal via processWithdrawals (tx 0xfc311841…e1f1); a forged, sequencer-signed batch reusing a real proof was rejected (tx 0x3a154e4e…167d). One operator, not a Tempo-created Zone.
- Tempo Zones: Tempo's own batch verifier runs in SP1 on 4 integration-test batches, matching native output (19-26M cycles; tampering rejected). Proofs bound to IVerifier's inputs were verified on Moderato, including a fixture with a withdrawal (tx 0xa63009fd…f770; also 0xb14b7127…3b80).
- 67 forge tests, incl. real proofs and the live batches'; the verifiers have no owner (our Zone's portal keeps upstream admin controls).
- A public page that reads the on-chain evidence and re-runs the Zone proof check in your browser.
```

## Who else is building in this space, and what are they getting wrong? · ≤1000

```
Tempo's Zone design includes an AWS Nitro attestation path; Tempo's docs also state that ZK proof generation is not implemented. Tempo can build ZK internally, and may be the most natural eventual competitor or partner. Sworn is a working proof beside the attestation path, not a replacement or claimed adoption.

General-purpose provers such as SP1, RISC Zero and Boundless can prove programs. The Tempo-specific work is porting the code, binding the proof to the batch-input shape a Zone portal understands, and rebuilding it whenever Tempo execution changes. Sworn needed patches across tempo-revm, zone-spf and dependencies to reach a real on-chain proof.

The differentiation is therefore execution and maintenance, not exclusive cryptography. It is only defensible if a first operator values the operational service enough to repeat it.
```

## How do you make money, or how do you plan to? · ≤500

```
Hypothesis: a Zone business pays for a Proof Operations agreement — proof generation for each batch it supplies plus compatibility maintenance through Tempo upgrades. The initial sale is a paid or unpaid design-partner proof; conversion is a repeat batch or upgrade need that has an identified budget owner. I do not have a price, payer agreement, customer or revenue yet. The market grows with Zones × batches × upgrades, if Zones are adopted.
```

## How long have you each been working on this? Full time? · ≤500

```
One founder, part-time, about 20 hours a week. Sworn started on 2026-10-03; the Reth/Revm and privacy work it rests on goes back to 2026 (Fabrknt Dojo, Veil, rdk, Reckn). Next 90 days: one design partner and a proof of a batch they supply; faster proving, so a Zone can keep running instead of stopping after a demo; tracking Tempo upgrades (T13) in the guest; and pricing a proof.
```

## Where is each member based? Do you work in-person? · ≤500

```
One founder, based in Japan.
```

## Legal entity / investment / fundraising / live token

```
Legal entity: No. Investment raised: No. Currently fundraising: No. Live token: No.
```
