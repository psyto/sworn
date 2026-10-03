# Adversarial review — spec 001 r3 "Sworn" (round 3)

Independent adversarial review. Break it; do not polish. Read-only.

Read `docs/specs/001-bonded-answers.r3-snapshot.md` (frozen copy of r3 — the live file may change while
implementation agents work) — **§R3 is normative and supersedes §3/§6**. Also read your previous
reviews `docs/reviews/001-spec-r1.md` and `001-spec-r2.md`, the spike code (`core/`, `program/`,
`host/`, `witness/`), and vendored Tempo `tempo/` (esp. `crates/revm/src/{tx.rs,handler.rs,fee_manager.rs}`,
`crates/precompiles/src/{tip20,receive_policy_guard,tip403_registry,nonce}`).

Note: implementation of r3 is starting concurrently; findings of the form "not yet implemented" are not
spec defects — skip them. Judge the **design**.

1. Does §R3 close each r2 finding (verify against Tempo source, not against R3's own claims)? Especially:
   is the R3.2 fixed `TempoTxEnv` actually executable by Tempo's handler as written (does fee-token
   resolution with `fee_token: Some(..)` and `fee_payer: None` behave as R3 assumes; does
   `ExecutionContext::Simulation` change validation or fee collection; is the nonce read from the
   witness the one the handler checks; does `gas_price = basefee(N)` with priority 0 pass validation)?
2. Honest-server safety: any remaining way a correct answer can be "proven different" (R3.1 encoding
   ambiguities, EIP-712 vs abi.encode mismatch between server/contract/guest, receiverBefore read point,
   fee in the same token as the transfer, receive-policy guard credit, hardfork boundary inside the window).
3. Is AC-2 as redefined (first tx of block, B−1 prestate MPT-verified, compare with receipt and B's
   balances) sound? Is "first tx of the block" actually at the B−1 boundary on Tempo (system txs?
   subblocks? fee-manager or other pre-block system calls that change state before tx 0?) — check the
   Tempo source for block-level pre-execution hooks.
4. MAX_AGE = 32 / BLOCKHASH / freshness: any race (reorgs/finality on Tempo, block.number semantics)?
5. Any remaining AC hole a lazy implementation passes while the claim is false.

Cite file:line; BLOCKER/MAJOR/MINOR; verified vs inferred. End with exactly one line:
`VERDICT: APPROVE` or `VERDICT: CHANGES`.
