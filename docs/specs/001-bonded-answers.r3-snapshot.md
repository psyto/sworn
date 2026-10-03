# 001 r2 — Sworn: a reserved, provable answer about a TIP-20 payment at a named Tempo block

> **Status: spec, round 2. Written 2026-10-03.** r1 was reviewed the same day:
> [`../reviews/001-spec-r1.md`](../reviews/001-spec-r1.md) — `VERDICT: CHANGES`, 5 BLOCKER. The
> response table is §0. **Product name: Sworn** (founder, 2026-10-03; was the working name "Bonded
> answers"). Local directory `/Users/hiroyusai/src/sworn` (renamed from `tempo-spike` the same day; the
> r1/r2 reviews cite the old path). GitHub repo not yet created (§9 F-2).
>
> **Founder ruling, 2026-10-03:** the Crypto World's Fair entry switches to this product (Tempo
> track). **Moderato testnet only.** No key is generated, stored or used by an agent.
>
> **Lane:** CWF Tempo track (`$100,000` / ten; rules §14(f) *"products that integrate with the Tempo
> blockchain"*). Window ends **2026-10-12 23:59 PT**. Everything in this directory is from 2026-10-03.
>
> **Provenance.** **[measured]** = measured 2026-10-03 on the public Moderato RPC / this machine,
> files under `out/`, `witness/`. **[source]** = `tempoxyz/tempo` at `61c979a` (vendored in `tempo/`).
> **[mpp.dev]** = read 2026-10-03. **[unknown]** is assumed nowhere.

---

## R3. Round 3 — normative. **Where this section and §3/§6 disagree, this section wins.**

Written 2026-10-03 in response to [`../reviews/001-spec-r2.md`](../reviews/001-spec-r2.md)
(`VERDICT: CHANGES`). Its two "r2 is not implemented" BLOCKERs are about code, not the spec, and are
answered by building it. Every other finding is closed below.

### R3.1 The interface both halves build against (Rust guest ↔ Solidity contract)

```solidity
struct Question {
    uint64  chainId;      // must be 42431
    uint64  blockNumber;  // N; the guest asserts header.number == N
    address from;
    address token;        // a TIP-20 precompile (address prefix 0x20C0…); guest aborts otherwise
    bytes   data;         // exactly transfer(address,uint256) or transferWithMemo(address,uint256,bytes32)
    address feeToken;     // explicit fee token (resolved before any stored preference)
    uint64  gasLimit;     // ≤ tx_gas_limit_cap of the hardfork at N
}
struct Answer {
    bool    success;
    bytes32 returnDataHash;   // keccak256(returnData)
    uint64  gasUsed;
    uint256 feeCharged;       // in feeToken units
    address receiver;         // decoded from `data` by the guest
    uint256 receiverBefore;   // balanceOf(receiver) in `token`, state after N
    uint256 receiverAfter;    // same, after the transaction
}
publicValues = abi.encode(bytes32 GUEST_VERSION, bytes32 blockHash, Question q, Answer a)
```

**Every `Answer` field is compared** in `challenge`: slashable iff
`keccak256(abi.encode(pv.a)) != keccak256(abi.encode(a))`. No field is decorative.

### R3.2 The transaction, fully fixed (closes "B3: the transaction is under-specified")

The guest builds exactly one `TempoTxEnv`; every field not listed is its `Default`:

| field | value |
|---|---|
| `inner.caller` | `q.from` |
| `inner.kind` | `Call(q.token)` |
| `inner.data` | `q.data` |
| `inner.value` | 0 |
| `inner.gas_limit` | `q.gasLimit` |
| `inner.nonce` | `from`'s account nonce in the witness at N |
| `inner.gas_price` | N's base fee; `gas_priority_fee` = 0 |
| `inner.access_list` | empty |
| `inner.chain_id` | 42431 |
| `fee_token` | `Some(q.feeToken)` |
| `fee_payer` | `None` (the sender pays) |
| `tempo_tx_env` | `None` — **no AA batch, no keychain/access key, no 2D nonce key** |
| `execution_context` | `Simulation` |
| `is_system_tx` | false |

Cfg: **nonce, balance, base-fee and fee-charge checks ON**; `disable_eip3607` and
`disable_block_gas_limit` may stay on (they model "first tx on top of N", not a validity rule the answer
claims). Block env = N's header, as in the spike (incl. `timestamp_millis_part`). Hardfork schedule from
`tempo-chainspec` (no hard-coded table). This is a *defined* counterfactual: **"the first transaction
executed on the state after N, with N's block environment."** The answer page says exactly that.

### R3.3 Abort rules (no proof is produced, so nothing is slashable)

The guest aborts if: `keccak(rawHeader) != blockHash`; `header.number != q.blockNumber`;
`q.chainId != 42431`; `q.token` is not a TIP-20 address; `q.data`'s selector is not one of the two;
the decoded receiver is a **virtual address** (v1 does not model the forward) or **equals `from`**; any
`BLOCKHASH` read; any account/slot missing from the witness; any MPT proof failure.
The server's own answering code applies the same rules and refuses those questions.

### R3.4 Contract changes

- `reserve(Question q, Answer a, address client, uint256 coverage)` — the contract **computes the
  digest itself** (EIP-712: domain `{name:"Sworn", version:"1", chainId, verifyingContract}`, typed
  structs `Question` and `Answer` exactly as R3.1). Reservation key = `keccak256(abi.encode(msg.sender,
  digest))` — **per server**, so nobody can pre-occupy another server's digest. Requires
  `block.number - MAX_AGE <= q.blockNumber < block.number` with **`MAX_AGE = 32`** (≈ 19 s at
  0.6 s/block; R3.5), and stores `blockhash(q.blockNumber)` (plain
  `BLOCKHASH` suffices inside 32 blocks; EIP-2935 is no longer needed).
- `challenge(address server, Question q, Answer a, bytes publicValues, bytes proof)` — requires the
  reservation for `(server, digest(q,a))`; `pv.version == GUEST_VERSION`; `pv.blockHash ==
  reservation.blockHash`; `keccak256(abi.encode(pv.q)) == keccak256(abi.encode(q))`; the SP1 Groth16
  verifier (`SP1VerifierGroth16V6`, the version this guest is proven with) accepts `(GUEST_VKEY, pv,
  proof)`; answers differ (R3.1). Pays `coverage` to `client`; marks slashed.
- Everything else in §3.3 stands (`bond`, `beginUnbond` refuses new reserves, `withdraw` only free funds
  after `UNBOND_DELAY > CHALLENGE_PERIOD`, permissionless `release`, constants not arguments).

### R3.5 Witness freshness

The public RPC keeps proofs ~250 blocks (~150 s). `MAX_AGE = 32` means a fresh reservation always names
a block still provable for **≥ ~130 s**. The client SDK fetches its witness **for N** the moment it sees
`Reserved`. **Witness discovery** for the fees-on execution is not `debug_traceCall` (the RPC's
`eth_call` path may skip fee-manager reads): the host runs the same executor over an **RPC-backed lazy
DB** that records every account/slot touched, then fetches `eth_getProof` for that set at N.

### R3.6 Acceptance criteria — replacing AC-2, adding to the rest

- **AC-2 (replaced):** pick ≥ 30 blocks whose **first** transaction is a TIP-20 transfer. Prestate =
  state after B−1, **MPT-verified** against B−1's header. Execute the real transaction (its real
  `TempoTxEnv`, via Tempo's own tx→env conversion) and compare with its receipt: status, `gasUsed`, fee
  token, fee charged (from receipt `effectiveGasPrice`), and the post balances of sender and receiver
  (read at B, also MPT-verified). This checks Tempo-EVM fidelity on authenticated state. It does **not**
  check the synthetic R3.2 tx type; AC-1 does that against the RPC.
- **AC-1 (amended):** compare the guest's fees-on answer with the RPC by sending the **same R3.2
  fields** through `eth_call` at N with `feeToken` and `gasPrice` set, plus `balanceOf` at N; where the
  RPC cannot express a field, say so and do not count the case.
- **AC-3/4 (added cases):** header number ≠ `q.blockNumber` → abort; reservation with `q.blockNumber`
  outside `MAX_AGE` → revert; `challenge` with each `Answer` field changed alone → pays; with `pv.q`
  differing in one field → reverts; another server's reservation → not found; virtual receiver and
  `receiver == from` → guest aborts.
- **AC-7:** fees-on cycle count and Groth16 time re-measured.
- **Gate for 2026-10-07 (founder-approved fallback trigger):** a fees-on proof of a deliberately wrong
  `Answer` slashes a real reservation on Moderato. If not reached, the entry reverts to the previous one.

---

## 0. r1 → r2: what changed and why

| r1 finding | r2 |
|---|---|
| **B1** proof does not bind the answer's call | §3.4: every field of the question is a **public value**; the answer's on-chain digest is over exactly those fields |
| **B2** `receiverDelta` does not exist | §3.4: guest computes it from the post-state; AC-1 requires it, including the guarded receiver |
| **B2b** receiver/token not bound → a challenger could pick another receiver and slash a correct answer | the guest **decodes the receiver from the calldata itself**; the token is `to`. Neither is a separate input, so neither can be chosen apart from the question |
| **B3** an `eth_call`-style fee-free simulation, not a payment | §1/§3.2: the question is now a **transaction** — nonce, fee token, gas price, fee charging all on. The claim is narrowed to **"what this transaction does on the state after block N"**, never "your payment will land later" |
| **B4** `BLOCKHASH` mis-modelled | §3.2: scope is **TIP-20 `transfer` / `transferWithMemo` to a TIP-20 precompile only**. A guest run that touches `BLOCKHASH` or anything outside the witness is an operational failure and **produces no slashable proof** |
| **B5** drift: four favourable cases cannot show equivalence | AC-2: **replay real Moderato TIP-20 transactions** and match their receipts (status, gas, fee, logs, balances). The server re-runs it hourly and stops answering on any mismatch |
| MAJOR unbond race / coverage > bond / stale block | §3.3: **`reserve()`** — the server's own on-chain commitment locks the coverage, pins the block hash, and is refused while unbonding. One mechanism closes all three |
| MAJOR server withholds the witness | §3.5: **the client captures its own witness** within the ~150 s proof window; the server's witness is optional |
| MAJOR "1-cent answer, 500 covered" economics | §5: answers are priced to cover the reservation (~0.4 PathUSD of gas, measured basis below); the product is **a preflight bought before a high-value payment**, not a penny API |
| MAJOR gas equality claimed but not checked | **Correction:** r1 §2.1 said gas was identical to `debug_traceCall`. The host compares only success and return bytes (`host/src/main.rs`); **gas was never checked by code.** AC-2 now checks it |
| MINOR p384 substitute | Q5 → decided: feature-gated **out** of the guest |

---

## 1. The claim (one sentence; the wording is load-bearing)

**Before paying, a client buys an answer to "if `from` sent this TIP-20 transfer on the state after
block N, what would happen — and how much would the receiver actually be credited?"; the server
commits to the answer on-chain with a reserved amount of its bond, and if the answer is wrong, anyone
can prove it with Tempo's own EVM inside a zk proof and the reserved amount goes to the client.**

### 1.1 What this does NOT claim — said before anything else

- **Not that a later payment will land.** The answer is about the state after block N. A receive
  policy changed at N+1 makes a correct answer stale, not wrong. The UI says *"as of block N"*.
- **Not arbitrary calls.** TIP-20 `transfer` / `transferWithMemo` only (§3.2).
- **Not mainnet; not a light client; not a judge.**

### 1.2 New vs. existing

| | status |
|---|---|
| reth in SP1 | exists: `succinctlabs/rsp` (no Tempo) |
| tempo-revm over a witness vs. the state root | exists, **not proving**: `tempoxyz/zones` `zone-spf` (*"presently a normal Rust verifier rather than a `no_std` proving guest"*) |
| tempo-revm **in an SP1 guest**, matching the live chain | **done here** (§2.1) |
| **a reserved, slashable answer sold over MPP** | **new.** MPP: *"MPP does not define a dedicated refund protocol … Refund decisions are up to your service"* [mpp.dev] |

---

## 2. What exists

### 2.1 Kill gate [measured]

| gate | result |
|---|---|
| H | `tempo-revm` (T11) over a witness MPT-verified against the header's stateRoot; **success + return bytes** byte-identical to RPC `eth_call` for `balanceOf`, two `transfer`s, one reverting `transfer`. Tamper tests fail closed. **Gas was not compared by code** (§0) |
| G | builds for SP1 with 3 patches to vendored Tempo (`out/tempo-patches.diff`) |
| C | `transfer` **3,500,181 cycles**; guest = native output |
| prove | local Groth16 **352 s**, verify ok, public values match; peak RSS 15.6 GB |

**The spike ran fee-free** (`disable_fee_charge`, `disable_nonce_check`, `disable_balance_check`,
`disable_base_fee` — `core/src/lib.rs:195-201`). r2 turns these **on** (§3.4); cycle and proving numbers
above are for the fee-free run and must be re-measured (AC-7).

### 2.2 Chain facts [measured]

- Raw header = RLP `[generalGasLimit, sharedGasLimit, timestampMillisPart, <21-field Ethereum header>,
  <consensusContext(4)>]`; `keccak(raw) == blockHash`; stateRoot = inner `[3]`.
- EIP-2935 history contract deployed; 8191 blocks ≈ 4,902 s.
- Public `eth_getProof` window ≈ 250 blocks (≈150 s): 100 back OK, 300 back → `-32602 … maximum
  proof window`.
- **Real TIP-20 transfers are frequent**: e.g. block 37936925, tx `0xbd42e2…1499` to `0x20C0…`;
  `debug_traceTransaction` with `prestateTracer` returns its prestate; its receipt carries
  `feeToken`, `feePayer`, `effectiveGasPrice`, `gasUsed`. This is what AC-2 replays.
- TIP-20 = precompile (`code = 0xef`). Receive-policy guard active from T6 [source
  `precompiles/src/lib.rs:250`]; Moderato is T11. A blocked inbound transfer **succeeds** and moves the
  funds to `ReceivePolicyGuard` [source `tip20/mod.rs:1349`]; a TIP-403 rejection **reverts** before
  that [source `tip20/mod.rs:1180`].
- Real execution resolves the fee token and collects the fee **before** the call [source
  `revm/src/handler.rs:995, 1402, 1450`] — so a transfer of the whole balance in the fee token fails
  in reality and succeeded in the spike.
- Cold `SSTORE` on Tempo ≈ **254,347 gas** vs 22,147 on Ethereum; fee units = `gasUsed ×
  effectiveGasPrice / 1e12` (founder's `reckn` spec 011 §2.2c, measured 2026-09-08).
- RPC reports `tempo/v1.16.0-384456f`, not in the public repo (§8 Q2).

### 2.3 Lineage — disclosed

Design discipline (no owner/admin/pause/upgrade; build check that fails if one appears; permissionless
settlement) from the founder's `psyto/reckn` (pre-existing, Apache-2.0). **No Reckn code is used.**
Reckn spec-015 r1's BLOCKERs 2 (seller-chosen verifier) and 3 (one proof, many payouts) are designed
out (§3.3).

---

## 3. Design

### 3.1 Flow

1. Client asks the server (HTTP, paid with an ordinary MPP `tempo` charge): *question* `Q` (§3.2).
2. Server executes `Q` on the state after the **latest** block N, then sends **`reserve(digest(Q, A),
   client, coverage, N, blockHash(N))`** on-chain, and returns `(Q, A, N, reserveTx)`.
3. **Client SDK, within ~150 s:** checks the `Reserved` event (digest, client = itself, coverage, block
   hash), and **captures its own witness** for `Q` at N (`debug_traceCall` prestate + `eth_getProof`).
   It may also compare `A` with its own `eth_call`. Only then does it act on `A`.
4. If `A` is wrong: anyone runs the challenger CLI (Rust) on the captured witness → Groth16 proof →
   `challenge(Q, A, publicValues, proof)` → the reserved coverage goes to the client.
5. After the challenge period, anyone calls `release(digest)` → coverage returns to the server's free
   bond.

### 3.2 The question and the answer

```
Q = { chainId, blockNumber N, from, token (= `to`, must be a TIP-20 precompile),
      calldata (selector ∈ {transfer, transferWithMemo}), feeToken, gasLimit }
A = { success, returnData, gasUsed, feeCharged,
      receiver (decoded from calldata), receiverBefore, receiverAfter,   // receiverDelta = after − before
      fromBefore, fromAfter }
```

Execution model, stated exactly: **one transaction from `from`, with `from`'s account nonce at N, the
given fee token and gas limit, gas price = N's base fee, fee charging on, block environment = N's
header, executed on the state after N.** This is a defined hypothetical — what `eth_call` at N would
return with fees on — and the answer says so.

### 3.3 The bond contract (no keys)

- `bond(server, amount)` — anyone funds; one TIP-20 bond token, fixed in code.
- `reserve(digest, client, coverage, n, hash)` — **`msg.sender` is the server.** Requires: not
  unbonding; `free ≥ coverage`; `hash == blockhash(n)` (via `BLOCKHASH` or EIP-2935, so `n` must be
  within 8191 blocks **at reserve time**); `digest` unused. Stores `{server, client, coverage, n, hash,
  expiry = now + CHALLENGE_PERIOD}`; `free -= coverage`. **The server's own transaction is its
  signature** — no off-chain signature to check.
- `challenge(Q, A, publicValues, proof)` — permissionless. Requires: reservation for
  `keccak(Q, A)` exists, unexpired, unslashed; `publicValues.Q == Q` field by field and
  `publicValues.blockHash == reservation.hash`; `SP1_VERIFIER.verifyProof(GUEST_VKEY, publicValues,
  proof)`; and `publicValues.A ≠ A` in at least one of `success, returnData, gasUsed, feeCharged,
  receiverAfter − receiverBefore`. Then marks slashed and pays `coverage` to `client`.
- `beginUnbond()` — refuses all new `reserve`. `withdraw()` — only `free` funds, only after
  `UNBOND_DELAY > CHALLENGE_PERIOD`.
- `release(digest)` — permissionless after expiry; returns coverage to `free`.
- `SP1_VERIFIER`, `GUEST_VKEY`, the bond token and both periods are **constants in the code** — no
  constructor argument, no setter. A new guest = a new contract.
- `no-owner.sh`: build fails on any owner/admin/pause/upgrade/`selfdestruct`/`delegatecall`, or a
  `fallback`/`receive` that moves funds.

`CHALLENGE_PERIOD` is not limited by EIP-2935: the hash is stored at reserve time. **Recommendation:
24 h.**

### 3.4 The guest

The spike guest, changed: fee charging, nonce, balance and base-fee checks **on**; fee token from `Q`;
receiver decoded from calldata; `balanceOf(receiver)` and `balanceOf(from)` in the fee token and in
`token` read from the witness DB before and from the post-state after; **public values =
`(Q, A, blockHash, GUEST_VERSION)`**. A `BLOCKHASH` request, a missing witness entry, or a target
that is not a TIP-20 precompile **aborts** (no proof). Hardfork schedule from `tempo-chainspec`. The
p384 substitute is feature-gated out.

### 3.5 Witness

The client captures its own (§3.1 step 3) — the server cannot make an answer unchallengeable by
withholding. The TypeScript SDK only fetches and stores JSON (`debug_traceCall`, `eth_getProof`,
`debug_getRawHeader`); verification and proving are the Rust CLI's job.

---

## 4. The demo — what a judge sees first

The CWF judges listed are not from Tempo, so the depth must be visible and the claim must survive the
first question.

**Web — a treasury agent about to pay 500 USD to `R`.** It buys a preflight answer (price shown:
~0.50) → *"As of block N: receiver +500.00. Reserved 500 from the server's bond — tx ↗"*. A second,
**dishonest** server answers the same question the same way — but `R`'s receive policy blocks the
sender, and the truth at N is *receiver +0, 500 to ReceivePolicyGuard*. The client's SDK has
already captured the witness. **Challenge** → progress *"Re-running Tempo's own EVM on the proven state
of block N"* (~6 min, time-lapsed on screen with the real duration shown) → **the 500 reserved goes to
the agent.** Every line links to the Moderato explorer, labelled *testnet*.

**Mobile:** the owner's notification — *"A preflight answer about block N was wrong. You were paid
500 from the server's reserved bond."*

**First 60 s:** (1) *"On MPP, if a paid answer is wrong, a refund is the server's choice."* (2) the
diverted transfer and the wrong answer. (3) on screen: *"Tempo's execution engine, inside a
zero-knowledge proof, against Tempo's own block hash. No judge, no owner."*

---

## 5. Economics, honestly

- Reservation ≈ 2–3 cold `SSTORE`s ≈ **0.6–0.8 M gas** on Tempo; at the 2026-09-08 price
  (31 M gas ≈ 15.5 PathUSD) that is **≈ 0.3–0.4 PathUSD** per answer. The answer must be priced above
  that, so this is **for payments where a wrong preflight costs far more than 0.50**, not for API calls.
- The bond is locked per answer for `CHALLENGE_PERIOD`; a server's capacity = bond ÷ (answers in flight
  × coverage). Who funds bonds and why (trust signal for an MPP data seller; premium as a % of
  coverage) is a hypothesis, not evidence.

---

## 6. Acceptance criteria — each mechanically checkable

| id | criterion |
|---|---|
| AC-1 | for ≥ 6 questions — ordinary receiver; receiver whose receive policy blocks `from`; TIP-403-rejected; insufficient balance; whole balance in the fee token (fails on the fee); `transferWithMemo` — guest = host, and `A` matches the RPC (`eth_call` at N with the same fields + `eth_getBalance`-equivalent `balanceOf` reads at N and after) |
| AC-2 | **replay ≥ 50 real Moderato TIP-20 transfer transactions** (prestate via `debug_traceTransaction` `prestateTracer`) through the guest's core: status, `gasUsed`, fee charged, logs and touched balances equal the receipts. Every mismatch is listed, none is skipped. Re-run hourly by the server; it stops answering on a mismatch |
| AC-3 | `challenge` pays for a real proof of a wrong answer, separately for a wrong `success`, `returnData`, `gasUsed`, `feeCharged`, and receiver delta |
| AC-4 | `challenge` reverts for: a correct answer; each `Q` field changed alone in the proof; a different block hash; no reservation; an expired reservation; a second challenge; any vkey ≠ `GUEST_VKEY` |
| AC-5 | `reserve` reverts when: unbonding; `free < coverage`; wrong or unreadable block hash; reused digest; `msg.sender` has no bond |
| AC-6 | `withdraw` cannot take reserved funds and reverts before `UNBOND_DELAY`; a challenge on a reservation made before `beginUnbond` still pays during the delay |
| AC-7 | fees-on guest: cycle count and local Groth16 time re-measured and recorded; the demo's stated proving time is that measurement |
| AC-8 | **production path on Moderato, in-window:** a paid HTTP answer from the dishonest demo server → its `reserve` tx → the client SDK's own witness → Groth16 proof → `challenge` tx paying the client; plus one correct answer whose challenge reverts. Derived from receipts by a reader script |
| AC-9 | `no-owner.sh` passes and is seen to **fail** on a planted owner, `delegatecall`, and funds-moving `fallback` |
| AC-10 | demo pages render only chain-read values |

Gate rule: assert the **set** of required test ids exists and passed; zero matches is not a pass.

---

## 7. Rules boundary & non-goals

In-window only. Form discloses: `psyto/reckn` as design lineage; vendored `tempoxyz/tempo` + patches;
prior art `rsp`, `zone-spf`. **Non-goals:** mainnet, arbitrary calls, forward-looking guarantees,
other chains, prover networks, LLM judging, a custom MPP payment method.

## 8. Open questions — two readings each and a recommendation

- **Q1 coverage pricing** — fixed price vs. % of coverage. **Rec:** show both on the demo page; do not
  claim a market price.
- **Q2 version drift** (`v1.16.0-384456f`) — **Rec:** AC-2 hourly replay is the guard; the answer names
  `GUEST_VERSION`; on mismatch the server stops.
- **Q3 who proves** — **Rec:** challenger CLI on a ≥ 16 GB machine; state it on screen.
- **Q4 the "dishonest server" in the demo** — it is the founder's own second server configured to lie.
  **Rec:** say so on screen.

## 9. Founder decisions

| | |
|---|---|
| F-1 | ask Colosseum (Discord): does Moderato-only qualify; are track winners chosen separately |
| F-2 | ~~product name~~ **Sworn** (decided 2026-10-03). Repo `psyto/sworn` — creation and publication still the founder's call |
| F-3 | keys for the two demo servers and the client; faucet PathUSD for bonds and fees |
| F-4 | the previous CWF form is replaced |
