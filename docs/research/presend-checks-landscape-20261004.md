# Pre-send payment checks on Tempo: who already ships them (2026-10-04)

**Question.** Does anyone already ship, in the same form, a layer that stops bad payments on Tempo before they're sent? That means: evaluate the receiver's TIP-403 / TIP-1028 receive policy (a blocked transfer "succeeds" but lands in `ReceivePolicyGuard`), plus fee token, balance, nonce and expiry; return Ready / Blocked / Needs review with a reason and a fix; then reconcile after execution and keep an audit trail. If someone does, would Sworn still have a structural advantage?

**Method.** I used the web and public GitHub only. I made shallow clones of the tempoxyz repos (`docs`, `accounts`, `wallet-cli`, `wallet-rs`, `tempo-apps`, `tempo-std`, `mpp`, `plugins`, `skills`, `examples`) and of `wevm/viem` (`src/tempo`, `site/pages/tempo`) and `wevm/mppx`. I grepped them for `ReceivePolicyGuard`, `receive.?policy`, `TransferBlocked`, `0xb10c…`, `validateReceivePolicy`, `simulat`, `eth_simulateV1`, `tempo_simulateV1`, `preflight`, `dry-run` and `feeToken`. I also ran `gh search code --owner tempoxyz receive_policy` and read vendor docs and blogs. Commits read: viem `26d5bd2` (10-02), accounts `b3a49f7` (10-02), docs `28a05b3` (10-01), wallet-cli `3e33817` (10-01, v0.11.0), wallet-rs `e8e37d9` (09-02, deprecated), mppx `44c4c85` (10-02, v0.13.1), tempo-apps `e6a6c36`, tempo-std `701c4bf`. Nothing was signed up for, sent or committed.

Labels used below: **[V]** = verified in code or docs; **[I]** = inferred.

---

## TL;DR

1. **The pre-send receive-policy check is a free, first-party primitive, not a gap.** [V]
   - The protocol exposes `TIP403Registry.validateReceivePolicy(token, sender, receiver) → (authorized, blockedReason)` as a view call.
   - viem ships it as `Actions.receivePolicy.validate`.
   - viem's guide is titled "Validate Transfers" and says *"Before sending a payment, you can check whether it would pass the recipient's receive policy."*
   - Tempo's T6 integrator checklist says *"Warn users before sends that are likely to be held."*
2. **Fee-token, balance and simulation checks are also shipped by Tempo/wevm.** [V]
   - `Actions.fee.validateToken`.
   - The `accounts` SDK relay's `eth_fillTransaction` returns `balanceDiffs`, a `fee` breakdown, a `requireFunds` deficit on `InsufficientBalance`, fee-token resolution and auto-swap.
   - `tempo_simulateV1` with `traceTransfers`.
3. **What is *not* shipped is the packaged verdict.** I found no product (Tempo, Stripe, wallet vendors, security vendors or payment-ops incumbents) that combines receive policy + fee token + balance + nonce/expiry into Ready / Blocked / Needs review with a fix, and then reconciles "held" against intent with an audit trail. [V for "not found" in the places listed; absence is not proof]
4. **Even Tempo's own tools don't wire the primitive in yet.** [V] In `tempo wallet transfer` (wallet-cli 0.11.0):
   - `--dry-run` just echoes the inputs back;
   - the real send reports `status: "success"` with no receive-policy check before sending and no held-transfer detection afterwards.

   The deprecated Rust wallet had post-send "held" detection written but sitting in an unreleased changeset.
5. **Verdict in short:**
   - (a) The exact packaged capability isn't shipped, but every ingredient is a free SDK call.
   - (b) The most likely entrant is Tempo/wevm, which is one PR into wallet-cli/accounts away. Stripe is next: stablecoin payouts on Tempo are on its Q4 roadmap, and its agent-ready financial accounts with human-in-the-loop confirmation are in preview.
   - (c) "Stops bad payments before sending" has **no structural moat** for Sworn. The only defensible part is what Sworn already is: an independent, bonded, ZK-provable answer about a stated block, from a contract with no owner. That only matters where the asker doesn't trust whoever answers and can't cheaply check for itself, which is narrow, since `validateReceivePolicy` is one `eth_call`.

---

## 1. Tempo's own tooling

### 1.1 Protocol: `validateReceivePolicy` view: SHIPPED (T6, mainnet 2026-07)

- **What it does.**
  - [V] `tempo-std/src/interfaces/ITIP403Registry.sol:232-241`: `function validateReceivePolicy(address token, address sender, address receiver) external view returns (bool authorized, BlockedReason blockedReason);`.
  - Also at `:220`: `receivePolicy(account)` returns the full config, including `recoveryAuthority`.
- **Receive-policy aware:** yes, it is the same function the TIP-20 transfer path calls.
  - Docs: `docs/src/pages/docs/protocol/upgrades/t6.mdx:109` says policies are *"enforced through `validateReceivePolicy(...)`"*.
- **Status and dates:** shipped.
  - T6 blog dated 2026-06-23 (`docs/blogs/t6.md`).
  - Mainnet launch on 07-13, per https://www.timesofblockchain.com/news/tempo-receive-policies-token/ (secondary source).
- **What Tempo tells senders:**
  - `docs/blogs/t6.md:22`: *"senders initiating transfers and issuers minting assets still do not need to check the recipient's policy in advance."* In other words, the protocol does not require a pre-check.
  - The integrator checklist at `docs/src/pages/docs/protocol/upgrades/t6.mdx:105`, step 4, recommends one: *"Warn users before sends that are likely to be held."* (https://tempo.xyz/developers/docs/protocol/upgrades/t6)

### 1.2 viem Tempo extension (maintained by wevm, Tempo's SDK partner): SHIPPED

| Capability | Code | Since |
|---|---|---|
| `receivePolicy.validate(token, sender, receiver)` → `{authorized, blockedReason: 'none' \| 'tokenFilter' \| 'receivePolicy'}` | `viem/src/tempo/actions/receivePolicy.ts:884` (call def `:919-931`, reasons `:58`) | `0e826149` "feat(tempo): receive policy actions (#4687)", 2026-05-30 |
| `receivePolicy.watchBlocked` / `getBlockedBalance` / `claim` / `burn` (post-send handling) | `receivePolicy.ts:960, :582, :299, :117` | same |
| `fee.validateToken`: rejects a fee token that is not TIP-20, not USD-denominated or paused | `viem/src/tempo/actions/fee.ts:62-120` | `a9bfd944` "feat: add Tempo fee token validation (#4590)", 2026-05-17 |
| `simulate.simulateCalls` via `tempo_simulateV1` (`traceTransfers`) | `viem/src/tempo/actions/simulate.ts:177` | shipped |

The guide is at `viem/site/pages/tempo/guides/receive-policies/validate.mdx` (https://viem.sh/tempo/guides/receive-policies/validate; added 2026-05-31 in `f810bbff`).
- `:11-12`: *"Before sending a payment, you can check whether it would pass the recipient's receive policy. This lets you surface a clear error to a user up front instead of having the transfer blocked onchain."*
- `:50-52`: *"Run validation in your payment flow before submitting a transfer so you can show the user a useful message…"*
- `:56-58`: *"Map it to user-facing copy so people understand whether to switch tokens, contact the recipient, or stop."* This is the "reason + fix" idea, documented as best practice.
- `:62-63`: *"Policies can change between your check and the actual transfer. Validation reduces surprises but is not a guarantee."*

The tempo-alloy Rust crate (`tempoxyz/tempo crates/alloy/src/provider/receive_policy.rs`, 06-22 / 07-07) has set, claim and burn helpers plus a `TransferBlocked` decoder. I saw no validate helper in its function list. [V, partial read]

**Gap [V]:** `Actions.token.transfer` / `transferSync` do **not** call `receivePolicy.validate` automatically; there is no `receivePolicy` reference in `viem/src/tempo/actions/token.ts`. The check is opt-in.

### 1.3 `accounts` SDK relay (`Handler.relay`, wallet/app backend): SHIPPED, partly aware

`accounts/src/server/internal/handlers/relay.ts`:
- **`features: 'all'`** (`:96-100`) turns on fee-token resolution, auto-swap and simulation.
- **`eth_fillTransaction`** (`:393-431`) runs, in parallel:
  - `simulateAndParseDiffs`, which produces `balanceDiffs` and a `fee` breakdown;
  - fee-payer signing;
  - auto-swap metadata;
  - virtual-address → master resolution, *"so wallets can show the eventual master address before signing"*.
- **On `InsufficientBalance`** (`:476-528`), it returns `capabilities.requireFunds` with the exact deficit, token and symbol. That is a balance check with a fix.
- **Fee-token resolution** picks the user's preferred token if it has a balance, otherwise the highest-balance token. Auto-swap prepends a DEX swap when the fee token is short.
- **Simulation** (`:1091-1113`) uses `tempo_simulateV1` and falls back to `eth_simulateV1`.
- **Receive policy:** not explicitly handled. Grepping `accounts/src` for `ReceivePolicyGuard`, `b10c`, `TransferBlocked` or `validateReceivePolicy` finds nothing; the only hit is the error string `InvalidReceivePolicyType` in `src/core/ExecutionError.ts:197`.
  - [I] A blocked transfer simulates as *success*. `buildBalanceDiffs` (`:1223`) would list `0xB10C…` as the recipient, so a careful UI *could* notice, but nothing flags it as "held".
- **Docs:** https://tempo.xyz/developers/docs/server/relay-handler (`docs/src/pages/docs/server/relay-handler.mdx:233-251`).

### 1.4 `tempo` CLI / Tempo Wallet CLI: SHIPPED, NOT aware

- **wallet-cli** (current, TS, v0.11.0, 2026-09-09), `wallet-cli/src/commands/transfer.ts`:
  - `:47-52`: `--dry-run` returns `{status: "dry_run", ...inputs}`. No simulation and no policy check.
  - `:60-79`: sends with `eth_sendTransactionSync` and returns `status: "success"` without inspecting the logs for `ReceivePolicyGuard`.
  - `swap.ts:62-94` does validate the fee-token address format and the balance for swaps.
- **wallet-rs** (deprecated; its README says "This repo is now deprecated"):
  - `crates/tempo-wallet/src/commands/transfer.rs:34-38, :374-416` classifies a confirmed transfer as `"held"` by matching `TransferBlocked` logs from `0xb10c…` and prints *"Held by recipient's receive policy… Funds were redirected to ReceivePolicyGuard"*.
  - This was **post-send detection only**, and it sits in `.changelog/detect-held-transfers.md`, an unreleased changeset. The TS rewrite did not carry it over. [V]
- **Docs:** https://tempo.xyz/developers/docs/cli/wallet. `--dry-run` is described as *"Preview a token transfer"* (`docs/src/pages/docs/wallet/reference.mdx:41`).

### 1.5 Tempo docs: SHIPPED guidance, putting the burden on the integrator

- `docs/src/pages/docs/guide/payments/send-a-payment.mdx:19-26`, a warning box titled "Confirm delivery, not just transaction success":
  - *"On post-T6 networks, a blocked TIP-20 `transfer` / `transferFrom` still succeeds, but credits `ReceivePolicyGuard`…"*
  - *"Before marking a payment… delivered, confirm the `Transfer` recipient is the intended receiver…"*
  - *"Index `ReceivePolicyGuard.TransferBlocked`…"*
  - https://tempo.xyz/developers/docs/guide/payments/send-a-payment
- `docs/src/pages/docs/guide/payments/configure-receive-policies.mdx:14-16, 33-37, 96`: the three delivery states (failed / credited / held) and *"`ReceivePolicyGuard` does not enumerate receipts onchain. Claimers need the receipt bytes, usually by indexing `TransferBlocked` events."*

### 1.6 Explorer: SHIPPED, post-send only

`tempo-apps/apps/explorer/src/lib/domain/known-events.ts:1491` labels the event `'transfer blocked'`, and `receipt-presentation.ts:202-216` hides the misleading `Transfer`-to-guard row. This is after the fact.

### 1.7 MPP (`mppx`): SHIPPED, revert-only preflight; the server rejects held payments

- `mppx/src/tempo/internal/fee-payer.ts:309-335`, `preflightSponsorship`:
  - simulates the sender calls, then the co-signed envelope, before the sponsor signs or broadcasts;
  - **it only catches reverts.** [I] A held transfer doesn't revert, so it passes preflight.
- `mppx/src/tempo/server/Charge.ts:1184`: server verification requires a `Transfer` log whose `to` equals the expected recipient.
  - [I] A payment that ends up held fails verification, so the service isn't credited. The payer then holds a receipt that only the recovery authority can claim. Nothing in mppx warns the payer beforehand; grepping `mppx/src` for receivePolicy, b10c and TransferBlocked finds nothing.

### 1.8 Searched but not found in the Tempo repos

- `plugins`, `skills`, `mpp` site, `examples`, `tip.bot`: no receive-policy pre-send logic.
- Tempo Wallet web app (wallet.tempo.xyz) and its iframe dialog: I couldn't find public source beyond `accounts`, so this is **not inspected**.

---

## 2. Stripe / Bridge / Privy

| Offering | What it does relevant here | Tempo-aware (policy / fee token) | Status | Source |
|---|---|---|---|---|
| Stripe Treasury: stablecoin balance → external crypto wallet | Sends USDC/USDC.e. **Tempo is listed** (USDC.e) among the supported networks | No documented receive-policy or held handling; no pre-send wallet validation described [V not found] | US public preview; other countries private preview | https://docs.stripe.com/treasury/stablecoins, https://docs.stripe.com/treasury/transfer-send (read 10-04) |
| Stripe Global Payouts (OutboundPayment / PayoutIntent) | Statuses `processing / failed / canceled / posted / returned`; PayoutIntent `requires_action` with `next_action.handle_failure.failure_reason` (private preview). *"posted… doesn't guarantee the recipient received funds"* | Generic exception states. There is no "held" state; [I] a Tempo held transfer would look `posted` unless Stripe adds logic | Public preview (API version `2026-09-30.preview`) | https://docs.stripe.com/global-payouts/manage-payouts |
| Stripe Sessions 2026 roadmap | **"Roadmap Q4: Send money on Tempo blockchains via stablecoin payouts"**; Preview: *"Agent-ready financial accounts… with human-in-the-loop confirmation"*; GA: Link agent wallet with spending approvals; GA: agents transact via MPP | Not stated | Announced 2026-04-29 | https://stripe.com/blog/everything-we-announced-at-sessions-2026 |
| Stripe × Tempo | Money management, Connect payouts, issuing and onramp run on Tempo | No validation detail | Blog 2026-04-21 | https://tempo.xyz/blog/stripe-and-tempo-stablecoin-settlement-for-global-money-movement/ |
| Bridge Transfers API | States include `undeliverable` (*"invalid account or unsupported asset at the destination"*), `returned`, `error` (*"requires manual review or developer action"*), `refunded` | Post-submission states only; no pre-send destination validation documented; Tempo supported as a chain (Sessions 2026 GA) | Shipped | https://apidocs.bridge.xyz/platform/orchestration/transfers/transfer-states |
| Privy | Policy engine: transfer limits, recipient allow/deny lists, contract and chain allow/deny. *"Limiting transfer sizes requires transaction simulation which runs outside the enclave."* Tempo is supported via the `ethereum` chain_type; an MPP recipe exists | Generic EVM; no receive-policy or fee-token rule found | Shipped | https://docs.privy.io/controls/policies/overview, https://docs.privy.io/recipes/tempo/send-transactions |

**Reading [I]:** Stripe owns the custody, payout and agent-wallet surfaces where a held Tempo payout would actually hurt. Today its exception model is generic (`returned` / `failed`) and doesn't model "held". If Stripe ships Tempo payouts (Q4 roadmap), adding a `validateReceivePolicy` call is cheap for them, and they control both ends.

## 3. Wallet, custody, security and agent-payment infrastructure

| Vendor | Pre-send simulation / policy | Tempo-specific | Receive policy / fee token | Status / date | Source |
|---|---|---|---|---|---|
| Turnkey | Policy engine parses Tempo tx: `tempo.tx.fee_token`, `gas_limit`, `max_fee_per_gas`, `valid_before`, `calls[i].to/function_signature/input` | **Yes (tx shape)** | Fee token: yes (as a signing rule). Receive policy: not mentioned. No simulation | Shipped | https://docs.turnkey.com/concepts/policies/examples/tempo |
| Blockaid | Real-time tx simulation and validation, fraud prevention, Cosigner | Yes (chain support) | Not mentioned; the post **predates T6** | 2025-12-09 | https://blockaid.io/blog/blockaid-expands-protection-to-the-tempo-network |
| Tenderly | Simulation API, forked Virtual Environments, debugger and alerts on Tempo mainnet | Yes (chain support) | Not mentioned | 2026-03-18 | https://tenderly.co/blog/build-on-tempo-mainnet-with-tenderly |
| Fireblocks | Generic transaction simulation (contract calls) and Policy Inspector | Tempo testnet and mainnet supported | Support article returned 403; not inspected | Shipped | https://support.fireblocks.io/hc/en-us/articles/12405923879196-Transaction-Simulation |
| BitGo | Tempo wallets in all custody models; SendMany bulk payouts *"with reconciliation-ready reporting"*; *"nonce management stability built in"*; fees *"payable in any TIP-20 stablecoin"*; wallet spending policies as a *"circuit breaker against agent-initiated transactions"* | Yes | Fee token: yes. Receive policy / held: not mentioned | Shipped (blog undated) | https://www.bitgo.com/resources/blog/bitgo-deepens-tempo-integration-full-institutional-wallet-support/ |
| Crossmint | Agent stablecoin wallets, x402 and transfers; Tempo partnership | Yes (chain) | Not found | Shipped | https://docs.crossmint.com/solutions/ai-agents/agent-wallets/stablecoin-wallet |
| Coinbase x402 / AgentKit | 402 payment flow; facilitator lists Base/Polygon/Solana | No Tempo facilitator found | n/a | — | https://www.quicknode.com/blog/x402-vs-mpp |
| Blowfish | Not checked separately (acquired by Phantom 2025, Solana/EVM wallet-side). Not found on Tempo | — | — | — | — |

**Reading [I]:** generic simulators classify by revert and by balance change. A held transfer doesn't revert and does debit the sender, so it looks normal unless the tool special-cases `0xB10C…` / `TransferBlocked`. None of the vendors I found document that special case. For any of them it's a small rule addition once a customer asks.

## 4. Payment-ops incumbents

| Vendor | Stablecoin rail | Pre-send exception detection for stablecoins | Source |
|---|---|---|---|
| Modern Treasury | "Modern Treasury Payments" PSP with stablecoin orchestration (Spring 2026); payment-order states split `completed` (network confirmed) from a new `reconciled` event; Beam acquisition; USDG/USDP/USDC | Not documented; Tempo not mentioned | https://www.moderntreasury.com/journal/spring-product-release-recap (2026-05-14) |
| Routable | Stablecoin payouts via Brale (2025-07) | Not found | https://www.routable.com/press/brale-partnership/ |
| Tipalti | No stablecoin payout launch found | — | search only |
| Dfns Payouts, Rain | Stablecoin → fiat payout APIs (2026) | Not found | search results only |

None of these is Tempo-aware as far as I could see, and none advertises a pre-send verdict for on-chain legs.

---

## 5. Verdict

**(a) Is the exact capability already shipped on Tempo?**
**Not as a packaged product, but every component is a free first-party call.** [V]
- The receive-policy pre-check is `validateReceivePolicy` / `receivePolicy.validate`.
- The fee-token check is `fee.validateToken`, plus fee-token resolution and auto-swap in the relay.
- Balance-deficit-with-fix is `requireFunds` in the relay.
- Simulation is `tempo_simulateV1`.
- Nonce and expiry handling live in the viem Tempo tx path.
- Post-send "held" detection is shown in the explorer, was written once in wallet-rs, and is documented as an integrator duty.

What I couldn't find shipped anywhere is the *combined verdict API* (Ready / Blocked / Needs review + reason + fix) plus reconciliation of "held" against intent with an audit trail. Tempo's own current CLI doesn't even call the check (§1.4). So the gap is real today, but it is an *integration* gap, not a capability gap.

**(b) Is the most likely entrant Tempo/Stripe?**
**Yes.** [I, strong]
- **Tempo/wevm first:** they wrote the primitive, the guide that recommends it, and the T6 checklist item ("Warn users before sends that are likely to be held"). They had held detection in wallet-rs, and they own `accounts` `Handler.relay`, where a `capabilities.receivePolicy` field would be roughly a one-PR change.
- **Stripe next,** when Tempo stablecoin payouts land (Q4 roadmap) and through agent-ready financial accounts (preview).
- Blockaid, Tenderly and Turnkey are plausible fast followers, adding a rule to products customers already run.

**(c) Would Sworn keep a structural advantage?**
- **As a pre-send checker: no.** The check is one `eth_call` that any sender can run against any RPC for free. Being "independent of the payment provider" doesn't help when the asker can verify it themselves at near-zero cost.
- **Bond + ZK re-execution proof:** this is a real difference, but it fits a different product. It matters only when:
  1. the party asking can't or won't run the check itself (for example, a thin agent without a trusted RPC, or a payer relying on a payee-run or third-party service); and
  2. being wrong is worth disputing.

  Both caveats apply to Sworn as well:
  - Sworn answers about state at block N. Like `validate`, it is advisory for any later block. If the policy changes after N, the transfer can still be held, and Sworn's answer was still *correct*, so no slash. The bond does not insure the outcome of the payment.
  - A held transfer is already visible on-chain after the fact (`TransferBlocked`), so a proof isn't needed for "did it get held". A proof is needed only for counterfactual claims ("what would have happened at N"), which is a narrow dispute surface.
- **Can't be quietly changed by the operator:** this is real (Sworn has no owner, admin, pause or upgrade). But the competing primitive is itself protocol code, and it changes only through public hardforks. The contrast holds against Stripe's or a vendor's *internal* checks, not against `validateReceivePolicy`.

**Net:** pitching Sworn as "the layer that stops bad payments on Tempo before they're sent" puts it in front of a first-party primitive with a first-party guide, and leaves the most likely entrants (Tempo/wevm, Stripe) one integration away. The defensible framing is the one already in the README: **an answer someone else gives you about Tempo state, which costs them money if it's wrong.** Any preflight framing should be positioned as *verifiable answers for parties who don't run the check themselves*, not as the check.

## 6. Where I looked and found nothing (absence is not proof)

- Tempo repos: grep across `docs`, `accounts`, `wallet-cli`, `plugins`, `skills`, `mpp`, `examples`, `tip.bot`, `tempo-apps`; `gh search code --owner tempoxyz receive_policy`.
- wevm: `viem/src/tempo/actions/token.ts` (no automatic validate in transfer); `mppx/src` (no receive-policy handling).
- Vendor docs and blogs: Stripe Treasury / Global Payouts / Sessions 2026, Bridge transfer states, Privy policies, Turnkey Tempo policies, Blockaid, Tenderly, BitGo, Crossmint, Modern Treasury.
- Not inspected:
  - Fireblocks' Tempo article (HTTP 403).
  - The Tempo Wallet web app (no public source found).
  - Stripe's internal payout logic.
  - Coinbase CDP / AgentKit internals.
  - Paid dashboards of Blockaid and Tenderly. Their rule sets may already special-case `TransferBlocked` without saying so publicly.
