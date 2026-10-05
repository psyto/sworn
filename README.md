# Sworn

**Audit-ready proof for private execution on Tempo.** Zero-knowledge proofs of Tempo's own Zone execution.

Tempo Zones are private blockchains on Tempo. The operator sees everything; each user sees only their own
account. So no one outside can check that the operator ran the ledger correctly. Sworn makes that
checkable: for a batch the operator supplies, it produces a zero-knowledge proof that Tempo's own Zone code
accepts it. Anyone can verify the proof on chain, and its public values are hashes and batch metadata, not
transaction contents.

Sworn runs Tempo's own code inside an [SP1](https://github.com/succinctlabs/sp1) zero-knowledge VM and
checks the resulting Groth16 proof in a contract on [Tempo](https://tempo.xyz). Two things are built on
that engine:

1. **Tempo Zone batches.** Tempo's own Zone batch verifier (`zone_spf::prove_zone_batch`) runs inside
   SP1, and the proof is bound to the exact inputs Tempo's `IVerifier` receives from a ZonePortal.
   `SwornZoneVerifier` is deployed on Moderato. Tempo's docs say ZK proving for Zones *"is not
   implemented"*. Tempo's design (T13) checks batches with a Nitro hardware attestation; on Moderato
   today, which is pre-T13, the reference verifier is a prototype stub that returns `true` without checking
   execution. **On 2026-10-04 a contract on Moderato verified the proof of a test batch with a withdrawal**
   ([tx](https://explore.testnet.tempo.xyz/tx/0xa63009fd13648ed246885b7b476e8284e55bab4d5a9325127155fe292b3df770)),
   after a first batch without one
   ([tx](https://explore.testnet.tempo.xyz/tx/0xb14b7127895ed8431e63154a4d665d0c19492fbb7c09152c13844e35c5023b80)).
   Both batches come from Tempo's integration tests, not from a Moderato Zone.
2. **Bonded answers (the demo).** A server sells an answer about a TIP-20 transfer over
   [MPP](https://mpp.dev) and reserves bond behind it. A wrong answer is proven false by re-running
   **Tempo's own EVM (`tempo-revm`)** inside SP1 against Tempo's own block hash, and the bond pays the
   client. No judge, no owner. This has slashed a lying server **three times on Moderato**.

> **For judges, the fast path:** the [live page](https://psyto.github.io/sworn/) ·
> [the Moderato proof tx](https://explore.testnet.tempo.xyz/tx/0xa63009fd13648ed246885b7b476e8284e55bab4d5a9325127155fe292b3df770)
> (a Zone batch with one withdrawal, from Tempo's integration tests) ·
> "Verify again" on the page (three live `eth_call`s: Sworn, the real proof → true; one field changed →
> `InvalidProof`; for comparison, Moderato's current prototype verifier, the pre-T13 reference stub, returns
> true for an equivalent malformed batch) ·
> pitch (≤ 2 min) and demo (2:32) videos: *links added once published*.
>
> **Status (2026-10-04): built for Colosseum's Crypto World's Fair, Tempo track.** Tempo **Moderato
> testnet** only. Unaudited. Traction: none. Moderato has one Zone operator today, and we have no customers.

## Why it matters

Zones are private by design: the operator has full visibility, and each user can see only their own
balances and history. That leaves anyone outside with no way to check that the operator ran the ledger
correctly. Tempo's design (T13) checks each batch with a hardware attestation, which means trusting one
vendor's chip; on Moderato today, the pre-T13 reference verifier is a prototype stub that returns true
without checking. A zero-knowledge proof of Tempo's own Zone code can be checked by anyone, on chain, and it
exposes hashes and batch metadata, not transaction contents.

## The plan

1. **Near term: businesses that run Zones and answer to auditors.** The offer is independent evidence they
   can match to each batch they settle. It is evidence, not yet a guarantee: the proof is checked off to
   the side, no portal calls `SwornZoneVerifier`, and `attest` stores nothing (spec 003 §5 D2, D4).
   Matching a proof to a settled batch is the operator's and auditor's step. It needs the operator: only
   the operator holds a Zone's witness, and a real Zone needs its own deployment (its genesis and parent
   chain, and version work, since Moderato's portals are pre-T13). A [local Operator Console](docs/operator-console.md)
   can start the existing real proof job for the withdrawal fixture and run read-only checks after it; it is
   deliberately fixture-only, loopback-only and not a hosted service. It rejects other websites (non-loopback
   `Host`, cross-site `Origin`) and needs an `X-Sworn-Operator` header to start a job; that is a cross-site
   boundary, not authorization against other local processes.
2. **Later: Tempo builds proofs into settlement.** [Spec 004](docs/specs/004-tee-plus-zk.md) proposes that
   payouts wait for a ZK proof of the exact batch. That design is written, not built, and it would land in
   Tempo's portal and verifier, not in our code.
3. **Either way, the service:** running the provers on time and rebuilding the guest and vkey at each Tempo
   upgrade that changes Zone execution (T12 activates on Moderato 2026-10-08; T13 brings the attestation
   verifier). That service is what we want to validate.

**Today:** Moderato has one Zone operator (three Zones with one admin; Zone creation is owner-gated), and
we have no customers. Revenue today: zero. **Next:** one design partner, and a proof of a batch they supply.

## Who

**Hiroyuki Saito** ([@psyto](https://github.com/psyto)), solo founder, Japan.
- **Rust engineer on Tempo's stack:** Reth, Revm, Alloy and Foundry. Author of
  [RethLab](https://rethlab.fabrknt.com) (21 source-reading courses on that stack) and
  [rdk](https://github.com/psyto/rdk), a DeFi kit on Reth.
- **Previous project:** [Reckn](https://github.com/psyto/reckn) won a Uniswap Foundation prize at
  ETHGlobal Tokyo 2026.
- **Before that:** 15 years building banking systems in Japan, familiar with banking regulation;
  earlier, software development in Hong Kong and India.

Getting Tempo's code into a zkVM meant patching it (`patches/`, `spikes/zone-spf/patches/`).

## What the Zone verifier is, and is not

**Is:**
- Tempo Zones' own batch verifier, executed inside SP1.
- A digest bound to everything a Nitro attestation commits, plus the destination chain and the exact
  genesis artifact.
- Verified on chain by a contract with `IVerifier`'s exact signature. [Spec 003](docs/specs/003-zone-verifier.md).

**Is not, yet** (spec 003 §5 D1–D4, §7):
- **The batches are not from Moderato.** Both come from Tempo's zones integration tests on a dev chain
  (1337). `hardfork_t13_recovery` has no withdrawals or user transactions. `deposit_and_withdrawal_blocks5-6`,
  taken from the Zone sequencer's own batch-validation path, has **one withdrawal and two user
  transactions** ([tx](https://explore.testnet.tempo.xyz/tx/0xa63009fd13648ed246885b7b476e8284e55bab4d5a9325127155fe292b3df770)). That shows a withdrawal inside a proven batch, not that withdrawals are
  secured.
- **No Zone settles with it.** Each Zone's verifier is fixed by Tempo's factory when the Zone is created,
  so only Tempo can adopt it.
- **Not usable on a current Moderato Zone as is.** It pins parent chain 1337 and one test genesis, and it
  implements T13's `IVerifier`; Moderato's portals are pre-T13. A real Zone needs its own deployment, its
  operator's witness and genesis, and version work
  ([`docs/research/moderato-zone-feasibility-20261004.md`](docs/research/moderato-zone-feasibility-20261004.md)).
- **No portal caller check.** That is safe only because the contract moves and stores nothing.
- **The pinned genesis is a trusted choice.** Its hash pins exact bytes; it does not prove they are
  Tempo's authentic spec.
- **It does not secure withdrawals, is not production-ready, and is not audited.**

## Deployed on Moderato (chain 42431)

| | address | |
|---|---|---|
| **Sworn** | [`0xc54b7e52B42F6150dA72c1147d25e8DDf83c02c6`](https://explore.testnet.tempo.xyz/address/0xc54b7e52B42F6150dA72c1147d25e8DDf83c02c6) | no owner, admin, pause or upgrade; every constant read back from chain |
| SP1VerifierGroth16 v6.1.0 | [`0x2c77329747b7C8B293514A6129404D4cefDd9B18`](https://explore.testnet.tempo.xyz/address/0x2c77329747b7C8B293514A6129404D4cefDd9B18) | codehash equals the local build of the vendored, unmodified `sp1-contracts` v6.1.0 |

| **SwornZoneVerifier** | [`0x00F6ed344B9C7F5eBA8788A115f8d6B4c00564e5`](https://explore.testnet.tempo.xyz/address/0x00F6ed344B9C7F5eBA8788A115f8d6B4c00564e5) | `IVerifier`-shaped Zone batch verifier; immutables only, no storage writes; deployed 2026-10-04 (block 38078600) |
| **SwornZoneVerifier (withdrawal batch)** | [`0xF2e1E74c14B10bE4dda591dbE50F91b88bDcBA11`](https://explore.testnet.tempo.xyz/address/0xF2e1E74c14B10bE4dda591dbE50F91b88bDcBA11) | same code and vkey, pinned to the genesis of the batch with a withdrawal |
| SwornZoneVerifier, superseded | [`0x64bA9F6481aA06cCF505DA3Bd6d0dce6180A42De`](https://explore.testnet.tempo.xyz/address/0x64bA9F6481aA06cCF505DA3Bd6d0dce6180A42De) | first deployment; its `verifierConfig` was `0x02`, which upstream zones (`344ff785`, 10-01) defines as NoProof, so it was redeployed with the self-describing tag `"sworn-sp1-groth16-v1"` |

Sworn guest vkey `0x00727936…7fa9`, `GUEST_VERSION = keccak256("sworn-guest-v1")`. Zone guest vkey
`0x007ef731…5b39`, pinned genesis artifact `0xd39aa765…c11e`. Everything is recorded
from receipts in [`deployments/moderato.json`](deployments/moderato.json).

## How the Zone verifier works

1. **Execute.** The SP1 guest runs `zone_spf::prove_zone_batch` (zones `ac49071f`, built for the zkVM with patches in
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
| proving | `hardfork_t13_recovery`: 25.5M cycles, local Groth16 **701 s**, peak 18.5 GB |
| on Moderato | `verify` returns true for the real proof and reverts when one field changes; `attest` emitted `ZoneBatchVerified` for zone 1, height 10 ([`0xb14b…3b80`](https://explore.testnet.tempo.xyz/tx/0xb14b7127895ed8431e63154a4d665d0c19492fbb7c09152c13844e35c5023b80), block 38080441, 260,419 gas) |
| a batch with a withdrawal | `deposit_and_withdrawal_blocks5-6` (1 withdrawal, 2 user transactions), 24.4M cycles, Groth16 891 s; verified on Moderato by a second instance ([`0xa630…f770`](https://explore.testnet.tempo.xyz/tx/0xa63009fd13648ed246885b7b476e8284e55bab4d5a9325127155fe292b3df770), block 38097996) |
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

- **Being checked (2026-10-05): our own Zone on Moderato.** Running a Zone sequencer and a Solidity
  `ZonePortal` of our own on Moderato, with `SwornZoneVerifier` as its verifier, would let a portal accept a
  batch and queue its withdrawals only after the ZK proof verifies. A feasibility check is under way
  (`spikes/own-zone/`); until it reports, the batches above remain integration-test batches and no portal
  calls the verifier.

- **TEE + ZK is a design proposal, not built.** [Spec 004](docs/specs/004-tee-plus-zk.md) proposes that Nitro settles
  and a ZK proof of the exact batch commitment releases payouts. The proof statement it needs, the portal
  changes and an invalidity proof are not built, and all of it would land in Tempo's code, not ours.

- **Moderato's next hardfork, T12, activates at 2026-10-08 14:00 UTC (23:00 JST)** (`1791468000`). The answerer refuses on a schedule
  it does not know, so it stops answering at T12 until the guest is checked against it.
- The p384 substitute patched into Tempo is still linked into the guest. It is not on the T11 path, and
  removing it would change `GUEST_VKEY`, so it stays until the next redeploy
  ([`docs/notes/p384-substitute.md`](docs/notes/p384-substitute.md)).
- `release`, `beginUnbond` and `withdraw` have not been exercised on Moderato yet. They are prepared in
  `scripts/moderato-release-withdraw.sh`, which only reads unless it is run with `--send`.

Fixed 2026-10-04:
- A challenger that dies, times out or loses its output is now reported as `HARNESS-FAILURE`
  (gate exit 3), not as "did not revert" (`sdk/test/harness-selftest.ts`). Re-gated, the
  2026-10-03 Moderato run's `S-2.honestReverts` now reads as a harness failure. Its recheck with the
  same proof reverted `AnswerCorrect`.
- Reverting transactions: **18 / 18** recent reverted Moderato transactions match their receipts when
  replayed the same way as AC-2 (`spike-host ac2-reverts`, `out/ac2_reverts_20261004.log`). Six are
  TIP-20 transfers: 4 ran out of gas with ~100–110k gas limits to empty receivers, and 2 hit
  `InsufficientBalance`.

## Prior art

Tempo's own [`tempoxyz/zones`](https://github.com/tempoxyz/zones) `zone-spf` re-executes Zone batches
over a witness, and is *"presently a normal Rust verifier rather than a `no_std` proving guest"*. Sworn
runs that same code inside SP1, with build patches to zones, tempo and two dependency crates; the verification logic is Tempo's, unchanged.
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
| `site/` | the live page ([psyto.github.io/sworn](https://psyto.github.io/sworn/)): read-only, published by `.github/workflows/pages.yml` |
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
