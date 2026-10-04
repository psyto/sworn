# CWF submission form: Sworn (draft v3.2, 2026-10-04, follows video/PITCH.md v3.2 and _submission/CRITERIA-MAP.md)

**Every field below is written to be pasted.** Limits are the form's own (field list and limits taken
from the copy of this form kept for the previous entry); `scripts/cwf-form.sh` counts them.
**`[FILL AFTER MODERATO]`** marks numbers that exist only after the 10-07 deployment — never paste a
draft with that marker in it. **`[FOUNDER]`** marks fields only the founder can write or enter.

This replaces the previous CWF entry (one product per team).

---

## Project name · Public

```
Sworn
```

## Brief description · Public · ≤500

```
Tempo Zones are private blockchains on Tempo: the operator sees everything, each user only their own account, so no one outside can check the operator ran the ledger correctly. Sworn makes that checkable: for a batch the operator supplies, a zero-knowledge proof that Tempo's own Zone code accepts it, verifiable by anyone on chain, exposing hashes, not transactions. A contract on Tempo's testnet verified one for a test batch with a withdrawal.
```

## Project website · Public

```
https://psyto.github.io/sworn/
```

## What are you building, and who is it for? · ≤1000

```
Sworn runs Tempo's own Zone batch verifier (zone_spf::prove_zone_batch) inside the SP1 zkVM. For a batch the operator supplies, it produces a proof that Tempo's code accepts that batch, bound to the inputs of Tempo's IVerifier. Anyone can verify it on chain; its public values are hashes and batch metadata, not transaction contents. On Moderato, SwornZoneVerifier verified a test batch with a withdrawal (tx 0xa63009fd…f770); change one field and it is rejected.

Who it is for. Near term: businesses that run Zones and answer to auditors. They get independent evidence they can match to each batch they settle. It is evidence, not yet a guarantee: no portal calls the verifier and it stores nothing. Later: if Tempo builds proofs into settlement, withdrawals can wait for them (spec 004: written, not built). Either way, the service is running provers on time and rebuilding them at each Tempo upgrade.
```

## Why did you decide to build this, and why build it now? · ≤1000

```
I work in Rust on the stack Tempo is built on: Reth, Revm, Alloy, Foundry. I wrote rethlab (rethlab.fabrknt.com), source-reading courses on Reth, and rdk, a DeFi kit on Reth. My previous project, Reckn, took 3rd place for Uniswap Foundation at ETHGlobal Tokyo 2026, adjudicating payments by deterministic re-execution.

Reading Tempo's Zones docs, I found the gap: the check on a Zone batch is an attestation or a stub, and ZK proving "is not implemented". Tempo's own batch verifier exists as ordinary Rust. Nobody had put it, or Tempo's EVM, inside a zkVM.

On 2026-10-03, tempo-revm ran in SP1 and matched 40 of 40 real Moderato transactions. On 10-04, Tempo's Zone batch verifier ran in SP1, and a contract on Moderato verified the proof.

Why now: Zones are on testnet, before operators settle real money and before their auditors settle on what evidence to ask for. Tempo's attestation verifier arrives with T13; a check anyone can re-run is easiest to add beside it now.
```

## How does your product use these chains? · ≤500

```
Tempo (Moderato). SwornZoneVerifier, with Tempo's IVerifier signature, verifies a Groth16 proof of a Tempo Zone batch on Tempo (0x00F6ed34…64e5). Sworn.sol holds bonds and pays slashes in PathUSD (0xc54b7e52…02c6). Both use the SP1 Groth16 verifier deployed on Tempo. Inside the proofs run Tempo's own code: Zones' prove_zone_batch, and tempo-revm with the TIP-20, TIP-403 and fee-token precompiles, bound to Tempo's block hash.
```

## What technologies are you using or integrating with? · ≤500

```
Tempo: Tempo Zones (zone-spf, the IVerifier interface, the Nitro attestation fields), tempo-revm (patched to build for the zkVM), TIP-20, TIP-403 receive policies, fee tokens, MPP (mppx). The Paradigm stack: Reth, Revm, Alloy (sol!, EIP-712), Foundry (forge, anvil). Succinct SP1 6.3 (zkVM guests, Groth16, verified on-chain by SP1VerifierGroth16 v6.1.0). TypeScript, viem and React for the SDK, server, demo and live page.
```

## Which chains · select

```
Tempo
```

## Category · Public

```
[FOUNDER — choose from the form's list. Recommendation: Infrastructure, since the product is a proof engine for Tempo's execution; Payments is the fallback.]
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
Solo founder; no collaborators, contractors or teammates. AI tools used for code review and implementation assistance are documented in the repo (README, docs/reviews/). [FOUNDER: confirm]
```

## Anything else judges should know · ≤500

```
Everything in github.com/psyto/sworn was written inside the window, from 2026-10-03. Prior work, disclosed: the no-owner design discipline comes from my earlier psyto/reckn (no code reused). Tempo and Tempo Zones are fetched at pinned commits and patched, not vendored. The Zone batch proved comes from Tempo's own zones integration tests (dev chain), not from Moderato. Testnet only, unaudited, no revenue.
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
The repo starts 2026-10-03, inside the window. Start at README.md. docs/specs/ has the specs (003 = Zone verifier); docs/reviews/ has independent reviews with the exact prompts. spikes/zone-spf/ holds the Zone guest and logs, and fetch.sh rebuilds Tempo and Zones from pinned commits. deployments/moderato.json records every Moderato transaction from receipts. contracts/: 64 forge tests, including real Groth16 proofs.
```

## Demo video · ≤3 min · required

```
[TO RECORD after the Moderato run — script in _submission/DEMO-SCRIPT.md (to write)]
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
[TO RECORD — founder's voice]
```

## X profile · Public

```
@psyto
```

---

# Accelerator questions

## How do you know people actually need, or will need this product? · ≤1000

```
I have no customers, and I will not claim one. Moderato has one Zone operator today, and Zone creation is owner-gated.

What I can show is the gap, in Tempo's own words and code. A Zone's operator sees everything and each user sees only their own account, so no outsider can check the ledger. Tempo's design checks batches with a Nitro attestation (T13); today's testnet verifier returns true for any input; Tempo's docs say ZK proof generation "is not implemented". The Zones README says the operator keeps full visibility "for compliance", which is where auditors come in.

The need is a hypothesis to test with one party: a business running a Zone that must show an auditor its batches were executed correctly, and would value independent evidence it can match to each batch it settles. The next step is one design partner, and a proof of a batch they supply. If no operator wants that evidence, the later route is Tempo building proofs into settlement (spec 004).
```

## How far along are you? Do you have users? · ≤1000

```
No users, no revenue. Built and measured inside the window, all on Moderato testnet:
- Tempo Zones: Tempo's own batch verifier runs in SP1 on 5 real batches from Tempo's zones integration tests, matching native output (19-26M cycles; tampering rejected). Proofs bound to IVerifier's inputs were verified on Moderato, including a batch with a withdrawal (tx 0xa63009fd…f770; also 0xb14b7127…3b80).
- tempo-revm in SP1: 40 of 40 real Moderato transactions re-executed match their receipts.
- Three real slashes on Moderato: a lying answer server's bond paid the client, each by a Groth16 proof.
- 64 forge tests, including real proofs; contracts with no owner.
- A public page that reads the on-chain evidence and re-runs the Zone proof check in your browser. Pitch and demo videos.
```

## Who else is building in this space, and what are they getting wrong? · ≤1000

```
Tempo itself: Zones' design (T13) checks batches with an AWS Nitro attestation. It is fast, but it is trust in one vendor's hardware, and an outsider cannot re-check it. Tempo's docs say ZK proving is not implemented. Tempo could build ZK in-house; Sworn is a working version today, offered beside the attestation, not instead of it.

General-purpose provers (Succinct SP1, RISC Zero, Boundless) prove programs. Someone still has to port Tempo's code (Sworn needed patches to tempo-revm, zone-spf and two crates), bind the proof to exactly what a Zone's portal checks, and rebuild it at each Tempo upgrade. Succinct's rsp proves reth blocks, not Tempo.

What is missing is not the engine but the Tempo-specific service: someone accountable for running the provers on time for an operator, and keeping them in step with Tempo's hardforks. That service is what we want to validate.
```

## How do you make money, or how do you plan to? · ≤500

```
Near term: Zone operators that answer to auditors pay for the service: proving the batches they supply, on time, plus rebuilding the prover at each Tempo upgrade. Later, if Tempo builds proofs into settlement (spec 004, written, not built), the same service runs for Tempo's design. Today: no customers, no revenue, and no payer has agreed. Next: one design partner.
```

## How long have you each been working on this? Full time? · ≤500

```
[FOUNDER] Sworn itself since 2026-10-03. Draft: "One founder. Sworn started on 2026-10-03; the Reth/Revm work it rests on goes back to 2026 (rethlab, rdk, Reckn). [full-time / part-time — founder to state]"
```

## Where is each member based? Do you work in-person? · ≤500

```
One founder, based in Japan.
```

## Legal entity / investment / fundraising / live token

```
[FOUNDER]
```
