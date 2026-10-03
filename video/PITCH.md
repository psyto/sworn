# Pitch video — Sworn (≤ 2 min, founder's voice)

**Form field:** *Pitch video · Public · ≤ 2 min · required.* Target **≈ 110 s** narration (≈ 2.2 words/s →
≈ 240 words), leaving margin under 120 s. The judges listed for CWF are not from Tempo: say what it is
in plain words first, the mechanism second, the proof of it third.

Every claim is mapped to its source in the table at the end. **A sentence without a row there is not
said.**

---

## Scene 1 — what users want · ≈ 20 s

**[Screen 1: an agent wallet on Tempo — "Pay 500 to R?" — and a small "Ask first" button. mpp.dev's line
"agents, apps, or humans pay as part of their request" underneath.]**

> On Tempo, MPP lets agents and apps pay per request — including paying for an answer before they send
> money. "Will this payment actually reach the receiver?" is worth paying for. But today, if that
> answer is wrong, MPP leaves the refund to the server.

## Scene 2 — why the answer is worth money on Tempo · ≈ 18 s

**[Screen 2: the Moderato explorer — a transfer with status "success", and the 500 held by
ReceivePolicyGuard, not by R]**

> On Tempo, a transfer can succeed while the receiver gets nothing: receive policies send it to a guard
> instead. Policies, fee tokens and balances all change the outcome — so a good answer is valuable, and a
> wrong one is costly.

## Scene 3 — Sworn · ≈ 27 s

**[Screen 3: three steps — Ask · Reserve · Prove — and two faces: the agent ("covered") and the seller
("stands behind its answer")]**

> Sworn lets the seller back its answer with money. The agent buys an answer about the current block; the
> seller locks part of its bond behind exactly that answer. If it's false, anyone can prove it, and the
> bond pays the agent. The agent gets an answer it can rely on; the seller gets proof it can be trusted.
> No judge, no owner.

## Scene 4 — built from Tempo's own parts · ≈ 30 s

**[Screen 4: tempo-revm → SP1 → Groth16 → verified on Tempo; beside it, Tempo's Zones code re-executing
Tempo against a state witness. Then "40 / 40" and the Moderato slash transaction.]**

> It's built from Tempo's own parts. Tempo's Zones work already re-runs Tempo's EVM against a proven state
> — Tempo needs this primitive too. I took it into a zero-knowledge proof: tempo-revm, proven against
> Tempo's own block hash. It matched forty of forty real Moderato transfers, and on Moderato it has
> already slashed a lying server.

## Scene 5 — who, and what's next · ≈ 18 s

**[Screen 5: github.com/psyto/sworn; rethlab; ETHGlobal Tokyo — Uniswap Foundation 3rd place]**

> I build on Reth and Revm; I teach them in rethlab. Next: a bonded-answer method any MPP seller on Tempo
> can switch on. Sworn — answers you can hold to account.

---

## Claims and sources

| claim | source |
|---|---|
| MPP lets agents and apps pay per request | mpp.dev: *"agents, apps, or humans pay as part of their request"* (read 2026-10-03) |
| MPP leaves the refund to the server | mpp.dev/advanced/refunds: *"Refund decisions are up to your service."* |
| succeeded ≠ paid; held by the guard | `tempo/crates/precompiles/src/tip20/mod.rs:1349`; Moderato tx `0x65bc…312a` (guard +500, receiver +0) |
| seller locks part of its own bond behind exactly that answer, on Tempo | `Sworn.sol` `reserve()`; Moderato reserve `0x08f6…0350` |
| no judge, no owner | `contracts/scripts/no-owner.sh` (gate); `challenge()` is permissionless |
| Tempo's own engine in a ZK proof against Tempo's own block hash | `core/`, `program/`; `Sworn.sol` checks `blockhash(N) == q.blockHash` |
| Tempo's Zones work re-runs Tempo's EVM against a proven state (so Tempo needs the primitive) | `tempoxyz/zones` `crates/spf/src/lib.rs`: *"Stateless state transition function for Tempo Zones"*, uses `tempo-revm` with a witness DB and MPT checks; *"presently a normal Rust verifier rather than a `no_std` proving guest"* (GitHub API, 2026-10-03). **Framed as shared direction, not as Tempo lagging.** |
| forty of forty | `out/ac2_run.log`: `AC-2: matched 40 / 40` |
| already slashed a lying server on Moderato | tx `0xa7b9…ab9b`, client +500 (`deployments/moderato.json`) |
| rethlab | github.com/psyto/rethlab, rethlab.fabrknt.com |
| (not narrated — on screen only) ETHGlobal Tokyo, Uniswap Foundation 3rd place | ethglobal.com/showcase/reckn-47t6m |

**Not said, on purpose:** any user, customer, partner or revenue (there are none); "mainnet";
"production"; a market size.
