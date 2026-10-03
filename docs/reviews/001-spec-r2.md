## Verified findings

- **BLOCKER — r2 is not implemented.** The only guest still commits the old `Output`; it has no `Q`, `A`, fee token, fee charged, receiver balances, or post-state fields. It still explicitly disables nonce, base-fee, balance, fee-charge, EIP-3607, and block-gas checks. `program/src/main.rs:5-8`, `core/src/lib.rs:74-94`, `core/src/lib.rs:190-250`. No bond contract, verifier adapter, SDK, or `no-owner.sh` exists outside the spec.

- **BLOCKER — B1/B2/B2b are not closed in source.** The r2 table describes an intended public-value binding, but the guest commits only the old output. A real proof today therefore cannot bind the answer, decode the receiver, or make `receiverDelta` slashable. `core/src/lib.rs:74-94`, `program/src/main.rs:5-8`, `docs/specs/001-bonded-answers.md:163-168`.

- **BLOCKER — even the r2 design fails to bind `Q.blockNumber` to the witnessed header/reservation.** `Q` contains `N`; `reserve` separately receives `n, hash`; challenge checks only `publicValues.Q == Q` and `publicValues.blockHash == reservation.hash`. It never requires `Q.N == reservation.n` or that the guest’s decoded header number equals `Q.N`. A lazy guest can commit a caller-provided Q while executing a different reserved header, creating a slash path against an answer correct for Q. `docs/specs/001-bonded-answers.md:125-149`.

- **BLOCKER — B3 remains unresolved.** The proposed “one transaction” omits transaction type, max fee/priority fee, access list, fee payer, nonce key, AA batch calls, validity bounds, key authorization, signature context, and the explicit defaults for all of them. Those are execution-relevant Tempo fields. Real AA conversion populates them all; fee payer is recovered from a signature. `tempo/crates/revm/src/tx.rs:83-112`, `tempo/crates/revm/src/tx.rs:303-387`, `tempo/crates/primitives/src/transaction/tempo_transaction.rs:173-246`.

  Tempo resolves an explicit fee token before stored user preference, inference, and default fallback, and charges the recovered fee payer before user execution. `tempo/crates/revm/src/fee_manager.rs:201-281`, `tempo/crates/revm/src/handler.rs:995-1015`, `tempo/crates/revm/src/handler.rs:1402-1483`. “Fee token from Q” is only deterministic if r2 explicitly defines a synthetic non-AA `TempoTxEnv`, forces fee payer = `from`, empty access list, no keychain/AA fields, and specifies every gas-price field. It does not.

- **MAJOR — 2D nonce, keychain, and gas-cap behavior are unaddressed, not merely untested.** Nonzero nonce keys read and increment the nonce precompile; keychain signatures impose stateful authorization and spending-limit effects before execution. `tempo/crates/revm/src/handler.rs:1166-1229`, `tempo/crates/revm/src/handler.rs:1241-1359`, `tempo/crates/precompiles/src/nonce/mod.rs:19-93`. `gasLimit` alone also does not define validity without `tx_gas_limit_cap` and intrinsic/floor-gas handling. `tempo/crates/revm/src/handler.rs:1063-1071`.

- **MAJOR — “eth_call at N with fees on” is not an RPC equivalence claim.** r2 defines post-N state with N’s header/base fee, which is a valid counterfactual only after the missing transaction defaults are fixed. It is not what a later N+1 transaction executes against. The current fetcher invokes a normal `eth_call`/`debug_traceCall` with only `from`, `to`, and calldata, so it cannot discover fee-manager, nonce, or keychain reads needed by a fees-on guest. `docs/specs/001-bonded-answers.md:132-135`, `witness/fetch.py:26-44`. `timestampMillis` is currently copied from the decoded header, which is good, but that does not repair the other divergence. `core/src/lib.rs:204-214`.

- **BLOCKER — AC-2 is not a sound authenticated equivalence test.** A transaction tracer’s prestate is the state after earlier transactions in the same block, not the block-boundary state committed by that block header. `eth_getProof(block B)` authenticates B’s final state, not the trace prestate. The prestate tracer output itself is unproven. Thus AC-2 either uses unauthenticated data or combines a transaction-interior state with the wrong state root; it cannot validate the claimed MPT-verified replay. `docs/specs/001-bonded-answers.md:216`, `core/src/lib.rs:138-187`.

- **MAJOR — B4 is closed only on paper.** Limiting calls to TIP-20 transfer selectors would remove arbitrary `BLOCKHASH` calls, and the witness DB correctly fails closed on `BLOCKHASH`. But the present guest accepts arbitrary `to` and calldata and has no such parser/restriction. `core/src/lib.rs:74-83`, `core/src/lib.rs:130-132`, `docs/specs/001-bonded-answers.md:163-168`.

## Receiver and answer defects

- **BLOCKER — several advertised answer fields are unslashable.** Challenge compares only success, return data, gas, fee, and delta. It does not compare `receiver`, either individual receiver balance, or either `from` balance, despite all being in A. A server can give wrong before/after balances with the same delta and retain the bond. `docs/specs/001-bonded-answers.md:127-129`, `docs/specs/001-bonded-answers.md:145-149`.

- **MAJOR — receiver identity is ambiguous for virtual addresses.** TIP-20 resolves a virtual calldata recipient to a different effective balance-holder; it credits the target while events preserve the original virtual address. r2 says both “receiver decoded from calldata” and “receiver actually credited,” without choosing which address is measured. Two conforming implementations can produce different deltas and slash a semantically correct answer. `docs/specs/001-bonded-answers.md:127-129`, `tempo/crates/precompiles/src/tip20/mod.rs:1526-1568`.

- **MAJOR — self-transfer/fee-token cases leave delta arithmetic undefined.** If receiver equals from and token equals fee token, a self-transfer has zero transfer effect but the pre/post fee can make the net delta negative. r2 specifies `after − before` without signed representation or underflow semantics. `docs/specs/001-bonded-answers.md:127-129`, `tempo/crates/revm/src/handler.rs:1402-1483`. AA fee-payer cases are worse because Q does not define a fee payer.

- **MINOR — guarded transfer semantics are correctly described but not demonstrated.** A blocked inbound transfer succeeds, credits `ReceivePolicyGuard`, and leaves the intended receiver uncredited; TIP-403 rejection occurs earlier. `tempo/crates/precompiles/src/tip20/mod.rs:1172-1195`, `tempo/crates/precompiles/src/tip20/mod.rs:1349-1386`. The artifacts remain ordinary transfer/balance fixtures, not the required receiver-policy case.

## `reserve()` assessment

- **Verified design improvement:** if implemented exactly, `free >= coverage`, decrement-on-reserve, no reserves after `beginUnbond`, and withdrawal limited to free funds do close the prior aggregate-underbond and pending-unbond race. `docs/specs/001-bonded-answers.md:139-152`.

- **BLOCKER — it does not close stale-answer/witness availability.** The contract accepts an N within its claimed 8,191-block hash horizon, while the spec reports RPC proof retention of only about 250 blocks. A dishonest server can reserve an already-unwitnessable N; the client gets an event but cannot form a proof. `docs/specs/001-bonded-answers.md:81-83`, `docs/specs/001-bonded-answers.md:140-143`, `docs/specs/001-bonded-answers.md:172-174`.

- **MAJOR — no reservation means the paid client has no remedy.** MPP payment precedes the reserve; the server can simply not reserve or not answer. There is no payment escrow, timeout refund, or enforceable delivery obligation. `docs/specs/001-bonded-answers.md:111-120`.

- **MAJOR — digest handling is underspecified.** `digest(Q,A)` and `keccak(Q,A)` do not define canonical encoding, type/version/domain separation, or post-expiry state. With dynamic calldata/return data, a careless packed encoding is collision-prone. A party that learns Q/A can also pre-reserve the global unused digest and block the intended server; the SDK checks no expected server address. `docs/specs/001-bonded-answers.md:112-115`, `docs/specs/001-bonded-answers.md:140-149`.

- **Inferred:** permissionless `release` is not itself an early-drain attack if expiry checks are exact. Client/challenger collusion also gains nothing beyond a valid slash. Both depend on the absent contract implementing ordering and state transitions correctly.

## Acceptance-criteria holes

AC-1 can pass guest=native while both share a wrong model; ordinary `eth_call` cannot yield a persisted fees-on poststate for the claimed “after” balance comparison. `docs/specs/001-bonded-answers.md:215`, `witness/fetch.py:28-44`.

AC-2 can pass on selected uncomplicated transactions, while its state-root methodology is unsound and it never proves the product’s synthetic post-N model. `docs/specs/001-bonded-answers.md:216`.

AC-3/4 omit negative tests for header-number/Q-number mismatch, virtual recipient resolution, negative self/fee delta, wrong individual balance fields, stale-but-8,191-valid N, digest encoding, and expected-server identity. `docs/specs/001-bonded-answers.md:217-220`.

AC-8 can demonstrate a founder-controlled dishonest server yet still fail to establish independent fees-on equivalence or client-witness availability. `docs/specs/001-bonded-answers.md:222`.

## Prize estimate

**Verified inputs:** track submission count is explicitly unknown; the ~7 public GitHub entries and 8,150 registrations are not submission measurements. `docs/reviews/payloads/001-spec-r2.md:17-24`. The current tree also lacks the promised production path, making the asserted 60% completion probability unsupported. `core/src/lib.rs:190-235`, `docs/reviews/payloads/001-spec-r2.md:48-55`.

Claude’s estimate compounds arbitrary assumptions: 40–120 track entries, 60% completion, 90% eligibility, and 40%/15% conditional placement. General/Public-Goods odds should not be added as independent events. Testnet qualification is still an open founder action in the r2 spec. `docs/specs/001-bonded-answers.md:250`.

My estimate: **1–8% any prize, central ~3%**. Assumptions: 15–30% probability of a genuinely replayable fees-on, reserved, client-witnessed AC-8 by deadline; 50–80% eligibility; and 12–30% conditional Tempo placement if complete. The upside exists because the ZK/Tempo angle is materially more distinctive than payment UI, and ten slots is meaningful. The downside is that judges will score the missing production proof, viability, and collateral model before rewarding novelty.

The largest variable is **credible completion of AC-8**, not total registrations. The cheapest immediate probability-improver is obtaining written Moderato eligibility confirmation—the spec already identifies this unresolved binary—though it does not repair the larger completion risk. `docs/specs/001-bonded-answers.md:250`.

VERDICT: CHANGES