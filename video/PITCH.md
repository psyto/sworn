# Pitch video — Sworn (≤ 2 min, founder's voice)

**Form field:** *Pitch video · Public · ≤ 2 min · required.* Target **≈ 110 s** narration (≈ 2.2 words/s →
≈ 240 words), leaving margin under 120 s. The judges listed for CWF are not from Tempo: say what it is
in plain words first, the mechanism second, the proof of it third.

Every claim is mapped to its source in the table at the end. **A sentence without a row there is not
said.**

---

## Scene 1 — the problem · ≈ 22 s

**[Screen 1: one line of mpp.dev, highlighted — "Refund decisions are up to your service." Then a phone:
an agent wallet, "Pay 500 to R?"]**

> Agents are starting to pay for things on their own — and to pay for answers before they pay for
> things. On Tempo, they do it over MPP. But if a paid answer is wrong, MPP's own docs say the refund is
> up to the server. The agent has no recourse.

## Scene 2 — why it matters on Tempo · ≈ 20 s

**[Screen 2: the Moderato explorer — a transfer with status "success", and the 500 landing in
ReceivePolicyGuard, not at R]**

> And on Tempo, "the transfer succeeded" and "the receiver was paid" are different facts. If the
> receiver's policy blocks the sender, the transfer still succeeds — and the money is held by Tempo's
> receive-policy guard. You only see that by executing the payment.

## Scene 3 — what Sworn is · ≈ 25 s

**[Screen 3: three steps, drawn — Ask · Reserve · Prove]**

> Sworn makes being wrong cost the server. Before an agent pays, it buys an answer: how much would the
> receiver actually get, as of this block. The server locks part of its own bond behind that exact answer,
> on-chain. If the answer is false, anyone can prove it — and the bond pays the agent. No judge. No owner.

## Scene 4 — how it is proven · ≈ 23 s

**[Screen 4: tempo-revm → SP1 → Groth16 → Tempo, as one line; then "40 / 40" and the Moderato slash
transaction]**

> The proof runs Tempo's own execution engine inside a zero-knowledge proof, against Tempo's own block
> hash. Tempo's team hasn't shipped that as a proving guest yet; I have. It matches the live chain on forty
> of forty real transactions, and on Moderato it has already slashed a lying server.

## Scene 5 — who builds it, and what's next · ≈ 20 s

**[Screen 5: github.com/psyto/sworn; rethlab; the ETHGlobal Tokyo Uniswap Foundation 3rd place]**

> I build on Reth and Revm — I teach them in rethlab, and my last escrow placed third for Uniswap
> Foundation at ETHGlobal Tokyo. Next: bonded answers for MPP sellers who want to stand behind what they
> sell. Sworn — paid answers that can be proven false.

---

## Claims and sources

| claim | source |
|---|---|
| refund is up to the server | mpp.dev/advanced/refunds: *"Refund decisions are up to your service."* |
| succeeded ≠ paid; held by the guard | `tempo/crates/precompiles/src/tip20/mod.rs:1349`; Moderato tx `0x65bc…312a` (guard +500, receiver +0) |
| server locks part of its bond behind that exact answer, on-chain | `Sworn.sol` `reserve()`; Moderato reserve `0x08f6…0350` |
| no judge, no owner | `contracts/scripts/no-owner.sh` (gate); `challenge()` is permissionless |
| Tempo's own engine in a ZK proof against Tempo's own block hash | `core/`, `program/`; `Sworn.sol` checks `blockhash(N) == q.blockHash` |
| Tempo's team hasn't shipped it as a proving guest yet | `tempoxyz/zones` `crates/spf/src/lib.rs`: *"presently a normal Rust verifier rather than a `no_std` proving guest"* (read 2026-10-03) |
| forty of forty | `out/ac2_run.log`: `AC-2: matched 40 / 40` |
| already slashed a lying server on Moderato | tx `0xa7b9…ab9b`, client +500 (`deployments/moderato.json`) |
| rethlab | github.com/psyto/rethlab, rethlab.fabrknt.com |
| third for Uniswap Foundation at ETHGlobal Tokyo | ethglobal.com/showcase/reckn-47t6m |

**Not said, on purpose:** any user, customer, partner or revenue (there are none); "mainnet";
"production"; a market size.
