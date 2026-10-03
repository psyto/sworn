# CWF submission form — Sworn (draft, 2026-10-03)

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
Paid answers about Tempo state that can be proven false. Before an agent pays, it buys an MPP answer: "if this TIP-20 transfer ran on the state after block N, how much would the receiver actually get?" The server reserves part of its bond behind that exact answer on-chain. If the answer is wrong, anyone can prove it by re-running Tempo's own EVM (tempo-revm) inside an SP1 zero-knowledge proof, and the reserved bond pays the client. No judge, no owner.
```

## Project website · Public

```
https://github.com/psyto/sworn
```

## What are you building, and who is it for? · ≤1000

```
On MPP, the client pays and the server answers. If the answer is wrong, the protocol has no recourse: MPP's own docs say refunds are out-of-protocol and "up to your service".

Sworn adds recourse for one answer that matters on Tempo: will this payment actually reach the receiver? It is not obvious. A transfer to an address whose receive policy blocks the sender still succeeds, and the money lands in ReceivePolicyGuard instead. TIP-403 policies and fee tokens change it too.

The server answers about a named block, then calls reserve() on a contract with no owner, locking part of its bond behind that answer. The client's SDK captures the state proofs for that block itself. If the answer is wrong, a zero-knowledge proof of Tempo's own execution engine running on that state slashes the reservation to the client.

It is for agents and treasuries sending payments where a wrong preflight costs more than the answer, and for MPP sellers who want to stand behind their answers.
```

## Why did you decide to build this, and why build it now? · ≤1000

```
[FOUNDER — draft to edit] I work in Rust on the Reth/Revm/Alloy/Foundry stack: I wrote rethlab (rethlab.fabrknt.com), a set of source-reading courses on Reth, and rdk, a DeFi kit on Reth (github.com/psyto/rdk). Before this, my escrow Reckn placed 3rd for Uniswap Foundation at ETHGlobal Tokyo 2026, adjudicating payments by deterministic re-execution.

Tempo is built on that stack, and agentic payments over MPP are one of the build paths in its own docs. Reading MPP, I found it defines charges, sessions and subscriptions, but no way for a client to hold a server to its answer. Tempo's own zones code re-executes Tempo over a witness, but says it is "presently a normal Rust verifier rather than a no_std proving guest".

So the question was whether tempo-revm could run inside a zkVM against real Moderato state. On 2026-10-03 it did: a TIP-20 transfer re-executed in SP1 matched the chain, and a Groth16 proof took about six minutes on a laptop. That made recourse cheap enough to build now.
```

## How does your product use these chains? · ≤500

```
Tempo (Moderato): the answer is about Tempo state; the bond, reservation and slashing live in a Tempo contract paid in PathUSD; the SP1 Groth16 proof is verified on Tempo; the block hash binding uses Tempo's own BLOCKHASH. Inside the proof runs Tempo's execution engine (tempo-revm) with TIP-20, fee-token and receive-policy precompiles, over state MPT-verified against Tempo's header. The answer is sold over MPP. [FILL AFTER MODERATO: contract address]
```

## What technologies are you using or integrating with? · ≤500

```
Tempo: tempo-revm (patched to build for the zkVM), TIP-20, receive policies / ReceivePolicyGuard, TIP-403, fee tokens, MPP (mppx). Paradigm stack: Reth, Revm, Alloy (sol! types, EIP-712), Foundry (forge tests, anvil). Succinct SP1 (zkVM guest + Groth16, verified on-chain with SP1VerifierGroth16 v6.1.0). TypeScript SDK and server (viem, mppx), React demo.
```

## Which chains · select

```
Tempo
```

## Category · Public

```
[FOUNDER — choose from the form's list; the options were never pasted. Candidates in order: Payments / Infrastructure / DeFi. Recommendation: Payments — the product is a guarantee on a payment preflight sold over MPP.]
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
Sworn is one person's work. Code review was done by OpenAI's Codex against prompts committed alongside the results in docs/reviews/, and implementation was assisted by Anthropic's Claude; every finding either produced was checked against the real files before being acted on, and several were rejected as wrong. No collaborator, contractor or teammate contributed. [FOUNDER: confirm; add "the narration is the founder's own voice" once recorded]
```

## Anything else judges should know · ≤500

```
Everything in github.com/psyto/sworn was written inside the window, from 2026-10-03. Pre-existing work, disclosed: the design discipline (no owner, permissionless settlement) comes from my earlier psyto/reckn; no Reckn code is used. tempoxyz/tempo is used at 61c979a with three patches so it builds for SP1 (patches/tempo.patch). Prior art cited: Succinct's rsp (reth in SP1, no Tempo) and Tempo's zone-spf (not a proving guest). Moderato testnet only; unaudited. Traction is zero.
```

---

# Media and code

## Project logo or graphic · Public · required

```
[TO MAKE — not yet created]
```

## GitHub link · Public · required

```
https://github.com/psyto/sworn
```

## Important context about the repo · ≤500

```
The repository starts on 2026-10-03, inside the window; every commit is CWF work. docs/specs/ holds three spec rounds and docs/reviews/ the independent reviews of each, with the exact prompts sent. tempoxyz/tempo is not vendored: scripts/fetch-tempo.sh checks out 61c979a and applies patches/tempo.patch. Measured results are in out/: AC-2 replays 40 real Moderato transactions against receipts; a real Groth16 proof slashes a wrong answer in contracts/test/RealGroth16.t.sol.
```

## Demo video · ≤3 min · required

```
[TO RECORD after the Moderato run — script in _submission/DEMO-SCRIPT.md (to write)]
```

## Live product link

```
[FILL AFTER MODERATO — demo page URL]
```

## Access instructions · ≤300

```
[FILL AFTER MODERATO] The demo page reads Moderato in your browser. To re-check the slash yourself: git clone https://github.com/psyto/sworn && cd sworn/contracts && forge test --match-contract RealGroth16
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
I do not know yet, and I will not claim a user I do not have. What is measured is the gap: MPP specifies charges, sessions and subscriptions, and its refunds page says refunds are out-of-protocol and the server's decision. The nearest entries building on Tempo resolve disputes with a human or a resolver. Tempo's receive policies make "the transfer succeeded" and "the receiver was paid" different facts, which a paying agent cannot see without executing the transfer.

The demand hypothesis is two-sided and testable: agents and treasuries pay for a preflight when a wrong one costs more than the answer (so: payments well above the ~0.4 PathUSD a reservation costs), and MPP data sellers bond their answers because "slashable if wrong" is a stronger claim than "trusted". The first test after the window is to offer a bonded endpoint to MPP service operators and count how many bond.
```

## How far along are you? Do you have users? · ≤1000

```
No users. Built and measured inside the window:
- tempo-revm runs in an SP1 guest over Moderato state MPT-verified against the header; three small patches to Tempo.
- Fidelity: 40 of 40 real Moderato transactions (type-2, account-abstraction and legacy) replayed with Tempo's own engine match their receipts — status, gas, fee, logs, balances.
- A receive-policy-blocked transfer: 5.97M cycles, Groth16 proof in 391 s on a laptop.
- Sworn.sol: bond, reserve, challenge, release; no owner; 59 tests including a real proof that slashes a wrong answer and cannot slash the right one.
- [FILL AFTER MODERATO: deployment and the live slash transaction]
- Server, SDK and demo: [state at submission]
```

## Who else is building in this space, and what are they getting wrong? · ≤1000

```
Tempo itself: zones' zone-spf re-executes Tempo over a witness, but for rollup batches, and not yet as a proving guest. Succinct's rsp proves reth blocks in SP1, not Tempo and not single answers. Light clients like Helios let a client verify an RPC read, but detection is not recourse: a wrong answer still costs the client.

On Tempo, buyer-protection escrows resolve disputes with a human or resolver; that brings back a party who decides. MPP sessions refund only what the server did not claim.

Nobody is getting the engine wrong; the missing piece is binding a paid answer to money that a proof, not a person, can move.
```

## How do you make money, or how do you plan to? · ≤500

```
A fee per bonded answer, priced above the reservation's own cost, and later a share of the premium servers charge for bonded endpoints. Running a challenger is open to anyone; the protocol takes nothing from slashes. The honest number today: zero revenue, and the price a buyer will pay for a guarantee is an untested hypothesis.
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
