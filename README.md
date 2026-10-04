# Sworn

**Zero-knowledge proofs of Tempo's own execution.**

Sworn runs Tempo's own code inside an [SP1](https://github.com/succinctlabs/sp1) zero-knowledge VM and
checks the resulting Groth16 proof in a contract on [Tempo](https://tempo.xyz). Two things are built on
that engine:

1. **Tempo Zone batches.** Tempo's own Zone batch verifier (`zone_spf::prove_zone_batch`) runs inside
   SP1, and the proof is bound to the same inputs Tempo's `IVerifier` receives from a ZonePortal.
   `SwornZoneVerifier` is deployed on Moderato. Tempo's docs say ZK proving for Zones *"is not
   implemented"*: today the reference verifier returns `true` without checking execution, and the
   native verifier is a Nitro TEE attestation. **On 2026-10-04 a contract on Moderato verified a real
   Zone batch proof** ([tx](https://explore.testnet.tempo.xyz/tx/0x9aa938e8c311c0a9b62c50a312129dde4cc1223c45f3b72ff41ff89503d5dfbd)).
2. **Bonded answers (the demo).** A server sells an answer about a TIP-20 transfer over
   [MPP](https://mpp.dev) and reserves bond behind it. A wrong answer is proven false by re-running
   **Tempo's own EVM (`tempo-revm`)** inside SP1 against Tempo's own block hash, and the bond pays the
   client. No judge, no owner. This has slashed a lying server **three times on Moderato**.

> **Status (2026-10-04): built for Colosseum's Crypto World's Fair, Tempo track.** Tempo **Moderato
> testnet** only. Unaudited. Traction: none.

## Why it matters

Zones are private blockchains anchored to Tempo. Money comes back out through withdrawals, and those are
only as trustworthy as the check on each batch. A hardware attestation means trusting one vendor's chip.
A zero-knowledge proof can be checked by anyone, on chain.

## The plan

1. **Tempo adds ZK as a second, independent check** next to the Nitro attestation. Tempo's factory fixes
   each Zone's verifier, so adoption runs through Tempo. Next deliverable: a design for running both
   checks together, covering what happens when they disagree or one is late, and who pays for proving.
2. **Proving operations.** Produce a proof for every batch, on time, and re-verify the guest at every
   Tempo upgrade (T12 activates on Moderato 2026-10-08; T13 brings the attestation verifier). That is
   ongoing, Tempo-specific work, and it grows with every Zone.

Who pays first, Tempo or Zone operators, is open. Revenue today: zero.

## Who

One founder, Hiro ([@psyto](https://github.com/psyto)), working in the stack Tempo is built on:
Reth, Revm, Alloy and Foundry. Writes [rethlab](https://rethlab.fabrknt.com), source-reading courses on
Reth, and [rdk](https://github.com/psyto/rdk), a DeFi kit on Reth. The previous project,
[Reckn](https://github.com/psyto/reckn), took 3rd place for Uniswap Foundation at ETHGlobal Tokyo 2026.
Getting Tempo's code into a zkVM meant patching it (`patches/`, `spikes/zone-spf/patches/`).

## What the Zone verifier is, and is not

**Is:**
- Tempo Zones' own batch verifier, executed inside SP1.
- A digest bound to everything a Nitro attestation commits, plus the destination chain and the exact
  genesis artifact.
- Verified on chain by a contract with `IVerifier`'s exact signature. [Spec 003](docs/specs/003-zone-verifier.md).

**Is not, yet** (spec 003 §5 D1–D4, §7):
- **The batch is not from Moderato.** It is `hardfork_t13_recovery`, from Tempo's zones integration tests
  on a dev chain (1337), and has no withdrawals or user transactions.
- **No Zone settles with it.** Each Zone's verifier is fixed by Tempo's factory when the Zone is created,
  so only Tempo can adopt it.
- **No portal caller check.** That is safe only because the contract moves and stores nothing.
- **The pinned genesis is a trusted choice.** Its hash pins exact bytes; it does not prove they are
  Tempo's authentic spec.
- **It does not secure withdrawals, is not production-ready, and is not audited.**

## Deployed on Moderato (chain 42431)

| | address | |
|---|---|---|
| **Sworn** | [`0xc54b7e52B42F6150dA72c1147d25e8DDf83c02c6`](https://explore.testnet.tempo.xyz/address/0xc54b7e52B42F6150dA72c1147d25e8DDf83c02c6) | no owner, admin, pause or upgrade; every constant read back from chain |
| SP1VerifierGroth16 v6.1.0 | [`0x2c77329747b7C8B293514A6129404D4cefDd9B18`](https://explore.testnet.tempo.xyz/address/0x2c77329747b7C8B293514A6129404D4cefDd9B18) | codehash equals the local build of the vendored, unmodified `sp1-contracts` v6.1.0 |

| **SwornZoneVerifier** | [`0x64bA9F6481aA06cCF505DA3Bd6d0dce6180A42De`](https://explore.testnet.tempo.xyz/address/0x64bA9F6481aA06cCF505DA3Bd6d0dce6180A42De) | `IVerifier`-shaped Zone batch verifier; immutables only, no storage writes; deployed 2026-10-04 (block 38070241) |

Sworn guest vkey `0x00727936…7fa9`, `GUEST_VERSION = keccak256("sworn-guest-v1")`. Zone guest vkey
`0x006c1531…293d`, pinned genesis artifact `0xd39aa765…c11e`. Everything is recorded
from receipts in [`deployments/moderato.json`](deployments/moderato.json).

## How the Zone verifier works

1. **Execute.** The SP1 guest runs `zone_spf::prove_zone_batch` (zones `ac49071f`, five zkVM patches in
   `spikes/zone-spf/patches/`) on a batch witness.
2. **Commit.** The guest commits one EIP-712 digest. It covers the zone, Tempo block, anchor, expected
   withdrawal index, the batch's state transitions and withdrawal queue hash (the same fields as Tempo's
   `NitroBatchAttestation`), plus the verifier address, its config, the genesis artifact hash and the
   destination chain.
3. **Verify.** `SwornZoneVerifier.verify(...)`, with `IVerifier`'s exact signature, recomputes the digest
   from its arguments and checks the Groth16 proof. `attest(...)` does the same and emits
   `ZoneBatchVerified`.

## How bonded answers work

**An honest note on the demo.** The demo's question ("if I send this transfer, what is the receiver credited?") is one a client can
check for itself: `eth_simulateV1` with `validation: true` and a fee token reproduces the answer,
including the fee charge and a receive-policy block (measured 2026-10-04). That is why it makes a good
demo: anyone can check that the server lied, without trusting us. It is not the product. The product is
the engine behind the slash: proving Tempo's execution so that a contract on Tempo can act on it.

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

**Zone verifier** (2026-10-04; logs in `spikes/zone-spf/z-logs/`, numbers in spec 003 "Results"):

| | result |
|---|---|
| four real batches from Tempo's zones integration tests | guest public values equal the native host's; batch outputs equal the integration tests' own; 19.1M–25.5M cycles |
| rejection | a tampered deposit, and each of the six public inputs changed one at a time, are rejected by Tempo's own code |
| proving | `hardfork_t13_recovery`: 25.5M cycles, local Groth16 **816 s**, peak 19.9 GB |
| on Moderato | `verify` returns true for the real proof and reverts when one field changes; `attest` emitted `ZoneBatchVerified` for zone 1, height 10 ([`0x9aa9…dfbd`](https://explore.testnet.tempo.xyz/tx/0x9aa938e8c311c0a9b62c50a312129dde4cc1223c45f3b72ff41ff89503d5dfbd), block 38071845, 260,152 gas) |
| contract | every digest field, the immutables (via clone deployments), the chain id, the proof and the vkey are each shown to matter, against the **real** SP1 Groth16 verifier |

**Bonded answers** (2026-10-03; logs in `out/`):

| | result |
|---|---|
| fidelity to the live chain | **40 / 40** real Moderato transactions (first tx of a block; 34 type-2, 4 account-abstraction, 2 legacy) re-executed with Tempo's own engine on the previous block's MPT-verified state match their receipts: status, gas, fee, logs, balances (`out/ac2_run.log`) |
| execution vs. RPC | **5 / 5** countable cases match RPC `eth_call` / `callTracer` / `prestateTracer` diff (fees off, since the RPC's call path charges none); 3 cases the RPC cannot express are reported, not counted (`out/ac1_run3.log`) |
| proving | receive-policy case **5,970,394 cycles**; local Groth16 **391 s**, peak 15 GB (`out/ac7_groth16.log`) |
| contract | **59 / 59** forge tests for `Sworn.sol` (64 with the Zone verifier); the gate requires 49 named tests and was seen to fail when one is missing. A **real Groth16 proof** slashes a lying answer and cannot slash the true one (`contracts/test/RealGroth16.t.sol`) |
| full flow | **32 / 32** checks on Tempo's own node (`tempo-localnet` at the vendored commit, chain 42431, Moderato's fork schedule): MPP charge → reserve → SDK verification → dishonest answer → own witness → local proof → challenge pays the client 500; honest answer → `AnswerCorrect`; 9 SDK rejections; live fork-schedule drift refused (`out/e2e/localnet-full-gate.log`) |

## On Moderato — the first of three slashes (2026-10-03)

| step | tx |
|---|---|
| dishonest server reserves 500 behind "the receiver gets +500" | [`0x08f6…0350`](https://explore.testnet.tempo.xyz/tx/0x08f614340b1a6a7fe07dfc3923341332a33d9e9174e41c9847372a11cdb20350) |
| the client's real payment — **diverted to `ReceivePolicyGuard`** (guard +500, receiver +0) | [`0x65bc…312a`](https://explore.testnet.tempo.xyz/tx/0x65bc66fa56f866149348cc5f7346bf4fe9345cf819642269870a94bf8183312a) |
| challenge with a real Groth16 proof (414 s, local) → `Slashed`, **client +500** | [`0xa7b9…ab9b`](https://explore.testnet.tempo.xyz/tx/0xa7b90b8cd4909bcdae03e5e78281ceeabda7d2976e692d33888f4f006924ab9b) |

The honest server's answer, challenged with a real proof, is rejected with `AnswerCorrect` — which
`Sworn.sol` raises only after `verifyProof` succeeds. Run log `out/e2e/moderato-20261003T064745Z.log`
(33 of 34 checks; the 34th, `S-2.honestReverts`, failed in the harness: the second proof took ~48 min under
load and the tool's output was lost — re-checked with the same proof in
`out/e2e/moderato-20261003T064745Z-honestReverts-recheck.log`). Recorded in
[`deployments/moderato.json`](deployments/moderato.json).

Two more slashes were recorded live for the demo video, on the same day:
[`0xbf8e…f046`](https://explore.testnet.tempo.xyz/tx/0xbf8ef2e317359cceee89bc29ea2ef9512bd13b9a916805751e2653c71f39f046) and
[`0x69ab…5188`](https://explore.testnet.tempo.xyz/tx/0x69abea9b6d5a54150486701f2f1deddc0843dc488a07765553a11e7cd2ce5188)
(`demoLiveTakeFirst`, `demoLiveTake`).

## What is not done

- **No TEE + ZK design yet.** How a ZK proof would sit alongside Tempo's Nitro attestation (one verifier
  checking both, what happens when they disagree or one is late, who pays for proving) is unwritten.

- **Moderato's next hardfork, T12, activates at 2026-10-08 14:00 UTC (23:00 JST)** (`1791468000`). The answerer refuses on a schedule
  it does not know, so it stops answering at T12 until the guest is checked against it.
- The run harness treats a challenger that dies mid-proof as "did not revert"; it should report it as a
  harness failure.
- The p384 substitute patched into Tempo is still linked into the guest (not on the T11 path).
- No reverting real transaction is in the 40-transaction replay.

## Prior art

Tempo's own [`tempoxyz/zones`](https://github.com/tempoxyz/zones) `zone-spf` re-executes Zone batches
over a witness, and is *"presently a normal Rust verifier rather than a `no_std` proving guest"*. Sworn
runs that same code inside SP1 with five zkVM patches; the verification logic is Tempo's, unchanged.
[`succinctlabs/rsp`](https://github.com/succinctlabs/rsp) proves reth blocks in SP1, but not Tempo. We
found no public example of `tempo-revm` or `zone-spf` proven in a zkVM.

## Layout

| path | |
|---|---|
| `docs/specs/` | 001 (product; §R3 normative), 002 (server, SDK, challenger, demo), 003 (Zone verifier) |
| `docs/research/` | sourced research behind the positioning (pre-send checks on Tempo, payment exception rates) |
| `docs/reviews/` | independent adversarial reviews of each spec round, and the exact prompts sent (`payloads/`) |
| `core/` | `Question`/`Answer`, the fixed transaction, abort rules, EIP-712, header binding, MPT checks, `tempo-revm` execution |
| `program/`, `runner/`, `host/` | SP1 guest, SP1 execute/prove, native checks (AC-1, AC-2) |
| `contracts/` | `Sworn.sol`, `SwornZoneVerifier.sol`, vendored SP1 verifier, tests, `scripts/gate.sh`, `scripts/no-owner.sh`, deploy scripts |
| `spikes/zone-spf/` | Zone guest, shared digest code (`attest/`), native host, patches, pinned genesis, witnesses, logs; `fetch.sh` rebuilds the large trees |
| `answerer/`, `server/`, `sdk/`, `challenger/` | answer engine (Rust), MPP server (TS), client SDK (TS), `sworn-witness` / `sworn-challenge` (Rust) |
| `demo/` | agent wallet and owner's phone (Vite + React + viem); every number read from chain |
| `deployments/` | Moderato addresses, from receipts |
| `patches/tempo.patch`, `scripts/fetch-tempo.sh` | Tempo at `61c979a` + three patches so it builds for the zkVM |
| `_submission/` | CWF form draft, counted by `scripts/cwf-form.sh` |

```bash
scripts/fetch-tempo.sh                                   # tempoxyz/tempo at the pinned commit, patched
cd contracts && forge test                               # 64 tests incl. a real Groth16 slash and a real Zone proof
spikes/zone-spf/fetch.sh && spikes/zone-spf/build-guest.sh  # Tempo zones + tempo at pinned commits, patched; Zone guest
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

Apache-2.0. Tempo (`tempoxyz/tempo`, Apache-2.0) and Tempo Zones (`tempoxyz/zones`, MIT OR Apache-2.0) are fetched and patched, not vendored; the two crates.io crates patched for the Zone guest (c-kzg, reth-primitives-traits) are likewise fetched, not committed; the vendored
`sp1-contracts` files carry `SPDX-License-Identifier: MIT`.
