# CWF submission form: Sworn (submission draft v5.2, 2026-10-05)

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
Before a private Tempo Zone releases a withdrawal batch, Sworn creates independently verifiable, audit-ready evidence for that operator-supplied batch without exposing customer transaction contents. It runs Tempo's own Zone verifier in SP1. On Moderato, our own Zone's portal settled each batch only after Sworn's proof passed; then a withdrawal was paid. Testnet only: not a Tempo-created Zone; no customers or revenue.
```

## Project website · Public

```
https://psyto.github.io/sworn/
```

## What are you building, and who is it for? · ≤1000

```
Sworn runs Tempo's own Zone batch verifier (zone_spf::prove_zone_batch) inside the SP1 zkVM. For a batch an operator supplies, it produces a proof bound to Tempo's IVerifier-shaped inputs. Anyone can verify it on chain; public values are hashes and batch metadata, not transaction contents. On Moderato, SwornZoneVerifier verified a Tempo integration-test batch with one withdrawal (tx 0xa63009fd…f770); changing one field is rejected.

The first product hypothesis is Proof Operations for a Zone business that must give a reviewer evidence before settlement: per-batch proof generation plus maintenance through Tempo upgrades. This is not withdrawal protection for Tempo's Zones: only our own Zone's portal calls Sworn, and no customer has requested or paid for it. The first test is one operator-supplied batch, delivered with reproducible verification instructions to its reviewer.
```

## Why did you decide to build this, and why build it now? · ≤1000

```
I work in Rust on Tempo's stack: Reth, Revm, Alloy and Foundry. I wrote Fabrknt Dojo (fabrknt.com/dojo), 21 source-grounded courses on that stack, and rdk, a Reth-based DeFi kit. Reckn, my previous project, won a Uniswap Foundation prize at ETHGlobal Tokyo 2026; I also spent 15 years building banking systems in Japan.

Tempo Zones make the operational gap concrete: the operator has the witness, but an outside reviewer cannot recreate the complete private batch from public data. Tempo's verifier is Rust code; I tested whether it could run in a zkVM and be bound to the inputs a Zone portal understands.

Inside this hackathon, Tempo's Zone verifier ran in SP1, a contract on Moderato verified the proof, and our own Zone's portal settled batches, and so a withdrawal, only after it. Why now is a hypothesis, not a claim of demand: Zones are still testnet, so a first operator can shape evidence requirements before a workflow is entrenched.
```

## How does your product use these chains? · ≤500

```
Tempo (Moderato). SwornZoneVerifier, with Tempo's IVerifier signature, verifies a Groth16 proof of a Tempo Zone batch on Tempo, through the SP1 Groth16 verifier deployed there. Inside the proof runs Tempo Zones' own prove_zone_batch code, bound to the batch inputs and destination chain. Our own Zone's ZonePortal on Moderato calls it in every submitBatch.
```

## What technologies are you using or integrating with? · ≤500

```
Tempo: Zones (zone-spf, the IVerifier interface, ZonePortal), Foundry on Tempo (64 forge tests, deployment), the TypeScript SDK (viem), Tempo transactions (type 0x76), TIP-20 and receive policies (a blocked transfer that succeeds), the Machine Payments Protocol (mppx), tempo-revm. Paradigm stack: Reth, Revm, Alloy (sol!, EIP-712). Succinct SP1 6.3: zkVM guests and Groth16, verified on-chain by SP1VerifierGroth16 v6.1.0. React for the live page and demo.
```

## Which chains · select

```
Tempo
```

## Category · Public

```
Infrastructure
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
Everything in github.com/psyto/sworn was written inside the window, from 2026-10-03. Tempo and Tempo Zones are fetched at pinned commits and patched, not vendored. The live settlement is our own Zone on Moderato (one operator, not Tempo-created); the fixture proofs come from Tempo's integration tests on dev chain 1337. The public page re-checks both from a browser. Testnet-only, unaudited, no customer or revenue claim.
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
The repo starts 2026-10-03, inside the window. Start at README.md. docs/specs/ has the specs (003 = Zone verifier); docs/reviews/ has independent reviews with the exact prompts. spikes/zone-spf/ holds the Zone guest; spikes/own-zone/ the own-Zone run. deployments/moderato.json records every Moderato transaction from receipts. contracts/: 64 forge tests, including real Groth16 proofs.
```

## Demo video · ≤3 min · required

```
[FOUNDER: paste the public demo-video URL after adding your narration to video/demo.mp4]
```

## Live product link

```
https://psyto.github.io/sworn/
```

## Access instructions · ≤300

```
https://psyto.github.io/sworn/ reads Moderato in your browser. Nothing to sign or install. "Verify again" re-checks the Zone proof on Moderato live. To re-run locally: git clone https://github.com/psyto/sworn && cd sworn/contracts && forge test
```

## Pitch video · Public · ≤2 min · required

```
[FOUNDER: paste the public pitch-video URL after adding your narration to video/pitch.mp4]
```

## X profile · Public

```
@psyto
```

---

# Accelerator questions

## How do you know people actually need, or will need this product? · ≤1000

```
No direct demand validation yet: no customer, design partner, auditor request or revenue. Tempo's Zones on Moderato have one effective operator and creation is owner-gated. I will not treat technical proof as customer traction.

The reason to test the hypothesis is structural. A Zone operator has the private ledger and witness; an outside reviewer cannot recreate its batch from public data. Sworn can turn an operator-supplied batch into independently checkable evidence without publishing transactions. Whether that changes an audit, sales or settlement-review outcome is unproven.

The validation sequence is concrete: find a Zone business that can supply a witness and has a reviewer; prove one supplied batch; give the reviewer reproducible verification instructions; ask whether the operator needs the next batch or upgrade proved and who owns that budget. A repeat need is the first demand signal. If no operator values it, the service thesis fails rather than becoming a claimed market.
```

## How far along are you? Do you have users? · ≤1000

```
No users, no revenue. Built inside the window; on-chain verification and the own-Zone run are on Moderato testnet, the fixture batches ran on dev chain 1337:
- Our own Zone on Moderato: 3 batches proven and settled through a portal that calls Sworn's verifier; a withdrawal paid after the proof (tx 0xfc311841…e1f1). One operator, not a Tempo-created Zone.
- Tempo Zones: Tempo's own batch verifier runs in SP1 on 5 integration-test batches, matching native output (19-26M cycles; tampering rejected). Proofs bound to IVerifier's inputs were verified on Moderato, including a fixture with a withdrawal (tx 0xa63009fd…f770; also 0xb14b7127…3b80).
- 64 forge tests, including real proofs; the verifiers have no owner (our Zone's portal keeps upstream admin controls).
- A public page that reads the on-chain evidence and re-runs the Zone proof check in your browser. Pitch and demo videos.
```

## Who else is building in this space, and what are they getting wrong? · ≤1000

```
Tempo's Zone design includes an AWS Nitro attestation path; Tempo's docs also state that ZK proof generation is not implemented. Tempo can build ZK internally, and may be the most natural eventual competitor or partner. Sworn is a working proof beside the attestation path, not a replacement or claimed adoption.

General-purpose provers such as SP1, RISC Zero and Boundless can prove programs. The Tempo-specific work is porting the code, binding the proof to the batch-input shape a Zone portal understands, and rebuilding it whenever Tempo execution changes. Sworn needed patches across tempo-revm, zone-spf and dependencies to reach a real on-chain proof.

The differentiation is therefore execution and maintenance, not exclusive cryptography. It is only defensible if a first operator values the operational service enough to repeat it.
```

## How do you make money, or how do you plan to? · ≤500

```
Hypothesis: a Zone business pays for a Proof Operations agreement — proof generation for each batch it supplies plus compatibility maintenance through Tempo upgrades. The initial sale is a paid or unpaid design-partner proof; conversion is a repeat batch or upgrade need that has an identified budget owner. I do not have a price, payer agreement, customer or revenue yet. Integration with Tempo's own Zones is a separate proposal, not a prerequisite for testing this evidence service.
```

## How long have you each been working on this? Full time? · ≤500

```
One founder. Sworn started on 2026-10-03; the Reth/Revm work it rests on goes back to 2026 (Fabrknt Dojo, rdk, Reckn). Part-time.
```

## Where is each member based? Do you work in-person? · ≤500

```
One founder, based in Japan.
```

## Legal entity / investment / fundraising / live token

```
Legal entity: No. Investment raised: No. Currently fundraising: No. Live token: No.
```
