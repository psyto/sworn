# CWF submission form: Sworn (draft v2, 2026-10-04, follows video/PITCH.md v2 and _submission/CRITERIA-MAP.md)

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
Zero-knowledge proofs of Tempo's own execution. Tempo's docs say ZK proving for Tempo Zones "is not implemented": today a Zone batch is checked by a hardware attestation, or by a reference contract that returns true. Sworn runs Tempo's own Zone batch verifier inside SP1, binds the proof to the exact inputs of Tempo's IVerifier, and a contract on Moderato verified it. The same engine re-runs Tempo's EVM and has slashed a lying server three times on Moderato.
```

## Project website · Public

```
https://psyto.github.io/sworn/
```

## What are you building, and who is it for? · ≤1000

```
Sworn proves Tempo's execution in zero knowledge, so a contract on Tempo can act on it without trusting whoever ran it.

The first use is Tempo Zones: private blockchains anchored to Tempo. A Zone's withdrawals are only as trustworthy as the check on each batch. Today that check is an AWS Nitro attestation, trusting one vendor's hardware, and Tempo's reference verifier returns true without checking. Tempo's docs: ZK proof generation "is not implemented".

What is built: Tempo's own Zone batch verifier (zone_spf::prove_zone_batch) runs inside SP1. The proof is bound to every input Tempo's IVerifier receives, plus the chain and the genesis. SwornZoneVerifier, with IVerifier's exact signature, verified a test batch with a withdrawal on Moderato (tx 0xa63009fd…f770).

It is for Tempo first, since Tempo chooses each Zone's verifier: ZK as a second, independent check beside the attestation. Then it is for the Zones that need a proof for every batch, on time, through every Tempo upgrade.
```

## Why did you decide to build this, and why build it now? · ≤1000

```
I work in Rust on the stack Tempo is built on: Reth, Revm, Alloy, Foundry. I wrote rethlab (rethlab.fabrknt.com), source-reading courses on Reth, and rdk, a DeFi kit on Reth. My previous project, Reckn, took 3rd place for Uniswap Foundation at ETHGlobal Tokyo 2026, adjudicating payments by deterministic re-execution.

Reading Tempo's Zones docs, I found the gap: the check on a Zone batch is an attestation or a stub, and ZK proving "is not implemented". Tempo's own batch verifier exists as ordinary Rust. Nobody had put it, or Tempo's EVM, inside a zkVM.

On 2026-10-03, tempo-revm ran in SP1 and matched 40 of 40 real Moderato transactions. On 10-04, Tempo's Zone batch verifier ran in SP1, and a contract on Moderato verified the proof.

Why now: Zones are on testnet and Tempo's attestation verifier arrives with the T13 upgrade. A second, independent check is cheapest to add before Zones hold real money.
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
I do not have a user yet, and I will not claim one. What I can show is the gap, in Tempo's own words and code. The Zones reference verifier returns true without checking execution. The native verifier is a Nitro attestation, whose approved measurements were unset at the reviewed commit. Tempo's docs say ZK proof generation "is not implemented". Zones are on Tempo testnet now, and every Zone that holds money needs withdrawals the parent chain can trust.

The need is clearest for Tempo itself, which chooses each Zone's verifier, and for institutions that will run Zones and must show their withdrawals are backed by correct execution, not one vendor's chip.

The next test is direct: put a TEE plus ZK design in front of Tempo and the first Zone operators, and ask whether they would run it.
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
Tempo itself: Zones use an AWS Nitro attestation. That is fast, but it is trust in one vendor's hardware, and Tempo's docs say ZK proving is not implemented. Tempo could build ZK in-house; Sworn is the working version today, offered as a second check, not a replacement.

General-purpose provers (Succinct SP1, RISC Zero, Boundless) prove programs. Someone still has to port Tempo's code (Sworn needed patches to tempo-revm, zone-spf and two crates) and re-verify it at every Tempo upgrade. Succinct's rsp proves reth blocks, not Tempo.

Nobody is getting the engine wrong. What is missing is the Tempo-specific work: a guest that tracks Tempo's hardforks, a proof bound to exactly what the ZonePortal checks, and someone accountable for running it on time.
```

## How do you make money, or how do you plan to? · ≤500

```
Step 1: Tempo adds ZK as a second check. Revenue is a contract or grant to build and maintain the verifier. Step 2: proving operations, a fee per batch proved on an SLA plus maintenance at every Tempo upgrade, paid by Tempo or by Zone operators. That is still open. Today: zero revenue, and no payer has agreed.
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
