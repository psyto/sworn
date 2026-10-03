# Sworn

**Paid answers about Tempo state that can be proven false — and paid for when they are.**

An agent about to send a stablecoin payment on [Tempo](https://tempo.xyz) can buy a preflight answer
over [MPP](https://mpp.dev): *"if this TIP-20 transfer ran on the state after block N, what would the
receiver actually be credited?"* The server commits to the answer on-chain and reserves part of its
bond against it. If the answer is wrong, anyone can prove it — by re-running **Tempo's own EVM
(`tempo-revm`) inside an SP1 zero-knowledge proof** against Tempo's own block hash — and the reserved
amount goes to the client. No judge, no owner.

Why it matters on Tempo: MPP defines no refund or dispute protocol — *"Refund decisions are up to your
service"* ([mpp.dev](https://mpp.dev/advanced/refunds)). And on Tempo, *"the transfer succeeded"* and
*"the receiver was paid"* are different facts: a transfer to an address whose receive policy blocks the
sender still succeeds, and the money lands in `ReceivePolicyGuard`. Sworn makes being wrong about that
cost the server, not the client.

> **Status (2026-10-03): built for Colosseum's Crypto World's Fair, Tempo track.** Deployed on Tempo
> **Moderato testnet** only. Unaudited. Traction: none. The first slash on Moderato itself has **not**
> happened yet — see [What is not done](#what-is-not-done).

## Deployed on Moderato (chain 42431)

| | address | |
|---|---|---|
| **Sworn** | [`0xc54b7e52B42F6150dA72c1147d25e8DDf83c02c6`](https://explore.testnet.tempo.xyz/address/0xc54b7e52B42F6150dA72c1147d25e8DDf83c02c6) | no owner, admin, pause or upgrade; every constant read back from chain |
| SP1VerifierGroth16 v6.1.0 | [`0x2c77329747b7C8B293514A6129404D4cefDd9B18`](https://explore.testnet.tempo.xyz/address/0x2c77329747b7C8B293514A6129404D4cefDd9B18) | codehash equals the local build of the vendored, unmodified `sp1-contracts` v6.1.0 |

Guest vkey `0x00727936…7fa9`, `GUEST_VERSION = keccak256("sworn-guest-v1")`. Everything is recorded
from receipts in [`deployments/moderato.json`](deployments/moderato.json).

## How it works

1. **Ask.** The client asks a `Question` (block N and its hash, sender, TIP-20 token, `transfer` /
   `transferWithMemo` calldata, fee token, gas limit) and pays for it with an ordinary MPP charge.
2. **Reserve.** The server computes the `Answer` (success, return data, gas, fee, the receiver's
   balance before and after) and calls `reserve(q, a, client, coverage)`. The contract computes the
   EIP-712 digest itself, checks `blockhash(N) == q.blockHash` within 32 blocks, refuses any question
   the proof could not cover, and locks `coverage` of the server's bond.
3. **Capture.** The client's SDK checks the reservation on-chain and captures its own state proofs for
   block N (the public RPC keeps them ~150 s) — so a server cannot make an answer unchallengeable by
   withholding evidence.
4. **Challenge.** If the answer is wrong, anyone runs `sworn-challenge`: `tempo-revm` runs the exact
   transaction inside SP1 over state MPT-verified against N's header, a Groth16 proof is made locally
   (~6.5 min), and `challenge()` pays the reserved coverage to the client. A correct answer cannot be
   slashed (`AnswerCorrect`).

The transaction is fully fixed (sender pays fees, explicit fee token, no account-abstraction batch,
no access key), and a transaction Tempo would reject before execution is itself a provable answer:
*"this payment would be rejected."* Spec: [`docs/specs/001-bonded-answers.md`](docs/specs/001-bonded-answers.md)
§R3 (normative).

## What is measured

All on 2026-10-03; logs are in `out/`.

| | result |
|---|---|
| fidelity to the live chain | **40 / 40** real Moderato transactions (first tx of a block; 34 type-2, 4 account-abstraction, 2 legacy) re-executed with Tempo's own engine on the previous block's MPT-verified state match their receipts: status, gas, fee, logs, balances (`out/ac2_run.log`) |
| execution vs. RPC | **5 / 5** countable cases match RPC `eth_call` / `callTracer` / `prestateTracer` diff (fees off, since the RPC's call path charges none); 3 cases the RPC cannot express are reported, not counted (`out/ac1_run3.log`) |
| proving | receive-policy case **5,970,394 cycles**; local Groth16 **391 s**, peak 15 GB (`out/ac7_groth16.log`) |
| contract | **59 / 59** forge tests; the gate requires 49 named tests and was seen to fail when one is missing. A **real Groth16 proof** slashes a lying answer and cannot slash the true one (`contracts/test/RealGroth16.t.sol`) |
| full flow | **30 / 30** checks on Tempo's own node (`tempo-localnet` at the vendored commit, chain 42431, Moderato's fork schedule): MPP charge → reserve → SDK verification → dishonest answer → own witness → local proof → challenge pays the client 500; honest answer → `AnswerCorrect`; 9 SDK rejections; live fork-schedule drift refused (`out/e2e/localnet-full-gate.log`) |

## What is not done

- **The slash on Moderato itself.** Deployed, not yet exercised there.
- **The demo's "diverted" scene.** In the localnet run the receive-policy-blocked transfer ran out of
  gas at the demo's 300,000 gas limit (Tempo prices cold storage ~11× Ethereum) instead of being
  diverted to `ReceivePolicyGuard`. The slash was still sound — the false claim was the receiver's
  balance — but the gas limit is being fixed and the run repeated.
- The p384 substitute patched into Tempo is still linked into the guest (not on the T11 path).
- No reverting real transaction is in the 40-transaction replay.

## Prior art

Tempo's own [`tempoxyz/zones`](https://github.com/tempoxyz/zones) `zone-spf` re-executes Tempo over a
witness but is *"presently a normal Rust verifier rather than a `no_std` proving guest"*;
[`succinctlabs/rsp`](https://github.com/succinctlabs/rsp) proves reth blocks in SP1 but not Tempo. Sworn
does not claim either as new — the new part is **a reserved, slashable answer sold over MPP**.

## Layout

| path | |
|---|---|
| `docs/specs/` | 001 (product; §R3 normative), 002 (server, SDK, challenger, demo) |
| `docs/reviews/` | independent adversarial reviews of each spec round, and the exact prompts sent (`payloads/`) |
| `core/` | `Question`/`Answer`, the fixed transaction, abort rules, EIP-712, header binding, MPT checks, `tempo-revm` execution |
| `program/`, `runner/`, `host/` | SP1 guest, SP1 execute/prove, native checks (AC-1, AC-2) |
| `contracts/` | `Sworn.sol`, vendored SP1 verifier, tests, `scripts/gate.sh`, `scripts/no-owner.sh`, deploy script |
| `answerer/`, `server/`, `sdk/`, `challenger/` | answer engine (Rust), MPP server (TS), client SDK (TS), `sworn-witness` / `sworn-challenge` (Rust) |
| `demo/` | agent wallet and owner's phone (Vite + React + viem); every number read from chain |
| `deployments/` | Moderato addresses, from receipts |
| `patches/tempo.patch`, `scripts/fetch-tempo.sh` | Tempo at `61c979a` + three patches so it builds for the zkVM |
| `_submission/` | CWF form draft, counted by `scripts/cwf-form.sh` |

```bash
scripts/fetch-tempo.sh                                   # tempoxyz/tempo at the pinned commit, patched
cd contracts && forge test                               # 59 tests incl. a real Groth16 slash
scripts/check-rust-tests.sh                              # required Rust tests
scripts/check-e2e.sh --log out/e2e/localnet-full-gate.log  # re-gate the recorded full-flow run
```

Keys are never stored in the repository: `scripts/with-keys.sh` loads Foundry keystores into one
command's environment at run time.

## Lineage

Design discipline (no owner/admin/pause/upgrade, permissionless settlement, a build check that fails if
an owner appears) comes from the author's earlier [`psyto/reckn`](https://github.com/psyto/reckn). No
Reckn code is used. Code review by OpenAI's Codex (prompts and results in `docs/reviews/`);
implementation assisted by Anthropic's Claude.

## License

Apache-2.0. Tempo (`tempoxyz/tempo`, fetched and patched, not vendored) is Apache-2.0; the vendored
`sp1-contracts` files carry `SPDX-License-Identifier: MIT`.
