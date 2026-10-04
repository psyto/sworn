# Payment exceptions on Tempo: what the chain shows (2026-10-04)

All of this is read-only. No transactions were sent, no keys or keystores were touched, and nothing was committed.
Scripts are in `docs/research/scripts/` and raw outputs in `docs/research/data/`.
Every number below is **[measured]** unless it is marked **[inferred]**.

## 0. Answers to the three questions (founder's scope, 2026-10-04)

The low exception ratios are expected on testnet and early-mainnet traffic. They say nothing about demand
either way, so this report does not judge "is it a business". It answers three narrower questions.

**(1) Does the mechanism actually occur on chain? Yes, on both networks, and by people other than Sworn.**
- **Moderato, whole history** (blocks 1–38,059,506): **2,778** `TransferBlocked` events from
  non-Sworn addresses (Sworn's own 3 are excluded). Each one has a matching
  `Transfer(from, 0xB10C…, amount)`. The first was on 2026-06-18. 1,641 are diverted *transfers*
  and 1,137 are diverted *mints*. They come from 865 originators and go to 600 receivers.
  1,772 were blocked by `RECEIVE_POLICY` and 1,006 by `TOKEN_FILTER`.
  315 receipts were later claimed and 20 were burned.
- **Moderato, last 7 days**: 328 non-Sworn diversions (284 transfers, 44 mints), from 124 senders to 50 receivers.
- **Mainnet (chain 4217), whole history**: **2** diversions, both non-Sworn. Both are pathUSD and both
  were blocked by `TOKEN_FILTER`. Both receipts were later claimed (`ReceiptClaimed` ×2).
  - `0x972d90bf753f168b6228d65a792ac5f79153739838735d8123f5f91e5c717502` (block 38,988,910, 2026-09-11):
    0.25 pathUSD from originator `0xe1de…4de9` to `0x3a43…8701`. The receiver had set token filter 595
    **6 blocks earlier** (`0xea15a240…`).
  - `0x8e76ff22bf37a88eee211476e6c2fdc9221a06e0226c52f66485e7a5e6fc9665` (block 40,755,295, 2026-09-22):
    0.01 pathUSD, `0x42dc…8b15` → `0x0d1a…ba9d`. The receiver had set token filter 601
    **4 blocks earlier** (`0xd92e0d3e…`).
  - **[inferred]** The receiver sets a filter and a tiny transfer follows seconds later. That looks like
    someone deliberately testing the feature, not a payer caught by surprise.
- Moderato examples from the last 7 days (non-Sworn, kind TRANSFER, reason RECEIVE_POLICY):
  `0x10f18467142dd1c5f5f0f162720cf6a473de7f1cdc096acc775ae4f25dfef079` (20 PathUSD → `0xedac…63ed`),
  `0x104176177463e83ba0b1798aebeea74336481385a3eb04f9ca06752928ab8910` (20 PathUSD, same receiver),
  `0x7dcb235cd648e36143844422d6d8384ad79ac6d657f586ba5aa6eec271c81dd6` (1 PathUSD → `0x69c1…f692`),
  `0x2b82b772452ed07d2104c965ff22f1049f789e57340c3a8c7847667d2a6498b6` (1 PathUSD → `0x170f…e892`).
- **The diversions cluster on test keys [measured, interpretation inferred].** 59.6% of all Moderato
  diversions (1,656 of 2,778) go to one receiver, `0x7099…79c8`. That is Anvil/Hardhat default account #1,
  whose private key is public. The top originators are also public dev keys: `0x3c44…93bc` (#2),
  `0x90f7…b906` (#3) and `0xf39f…2266` (#0). One minter, `0x5bc1…1877`, accounts for 1,064 events.
  These are test suites, most likely Tempo's own or SDK tests. The tail after them is real but thin.

**(2) Is receive-policy usage growing?**
- **Moderato: yes, the number of accounts that set a policy is growing [measured].** The figure is
  distinct accounts that ever emitted `ReceivePolicyUpdated`, measured weekly:
  1 (06-22) → 481 (07-20) → 6,887 (08-03) → 13,778 (08-31) → 22,685 (09-21) → **29,280 (10-04)**.
  About 1,900–4,700 new accounts are added each week in September.
- **But the restrictive ones are flat [measured].** Most of these accounts set
  `senderPolicyId = 1, tokenFilterId = 1` (ALLOW_ALL / ALLOW_ALL), which blocks nothing. The number of
  accounts whose latest setting actually restricts something has barely moved: 480 (07-20) → 532 (08-24) →
  553 (09-14) → 574 (09-28) → **625 (10-04)**.
  - **[inferred]** Most of the growth is some SDK or wallet default that sets a permissive policy, perhaps
    to register a `recoveryAuthority`. It does not show people choosing to refuse payments.
- **Mainnet: no meaningful growth [measured].** Only 11 accounts have ever set a receive policy.
  The first was 2026-07-16. Eight of them were set on 2026-09-11. One tx sender, `0x5645…a7f5`,
  set 7 accounts' policies (6 on 09-11 and 1 on 09-12), all of them permissive. Only **3** have a restrictive setting (token filters 556, 595 and 601).
- TIP-403 policies in general, from `policyIdCounter()` read at historical blocks:
  - Mainnet went 14 (04-01) → 521 (05-01) → 554 (06-01) → 589 (09-01) → 605 (10-04). That is an April
    burst followed by about 1 per week since. **[inferred]** The April burst is issuers configuring
    token transfer policies.
  - Moderato reached 1.25M by April, mostly test spam, and is flat after that (+2.3k since 09-01).

**(3) What the current numbers cannot tell us.** See §7. In short:
- Real-user frequency on mainnet: there is too little traffic and too few receive policies.
- Pre-inclusion failures (fee token, nonce, AMM liquidity). These never reach the chain.
- Whether anyone would pay to avoid an exception.
- What happens once receive policies are common, for example when an exchange or merchant turns one on.
- Value at risk: amounts on testnet are meaningless.

## 1. Setup

| | Moderato (testnet) | Tempo Mainnet |
|---|---|---|
| chain id | 42431 | 4217 |
| RPC used | `https://rpc.moderato.tempo.xyz` (`tempo/v1.16.0-384456f`) | `https://rpc.tempo.xyz` (`tempo/v1.15.0-464e519`) |
| 7-day window | blocks **37,056,728 – 38,059,506** = 2026-09-27T00:00:00Z – 2026-10-03T23:59:59Z (1,002,779 blocks) | blocks **41,407,000 – 42,487,199** = 2026-09-27T00:00:00Z – 2026-10-03T23:59:59Z (1,080,200 blocks) |
| whole-history scans | blocks 1 – 38,059,506 (genesis 2026-01-08) | blocks 1 – 42,487,199 (genesis 2026-01-16) |

**Mainnet status.** Tempo's official docs
(`https://tempo.xyz/developers/docs/quickstart/connection-details`, which docs.tempo.xyz redirects to,
fetched 2026-10-04) say: "Tempo Mainnet has been live since March 18, 2026". The page lists chain ID
`4217`, RPC `https://rpc.tempo.xyz` and explorer `https://explore.tempo.xyz`. The vendored chainspec agrees:
`tempo/crates/chainspec/src/spec.rs` maps 4217 to `PRESTO`, with follow URL `rpc.presto.tempo.xyz`.

**RPC limits, found by testing.**
- `eth_getLogs` allows at most 100,000 blocks *and* 20,000 results per call. The node's error message
  includes the range to retry with, and the scanner uses it.
- Moderato carries about 7 Transfer logs per block, so a call covers roughly 2,500–2,800 blocks.
- When a range is very dense in events, the node returns HTTP 502, and the scanner then cuts the range to a quarter.
- JSON-RPC batches are allowed, but a batch of more than about 10 block-with-receipts requests fails with `request too large`.
- 429 and 5xx responses are retried with exponential backoff. Totals: 46 retries over 1,019 calls in the
  Moderato transfer scan, and 9 over 111 in the mainnet scan.

**Sources for addresses and events.**
- ReceivePolicyGuard is `0xB10C…0000` (`sdk/src/abi.ts:99` and `precompiles/mod.rs:61`).
- `TransferBlocked(address indexed token, address indexed receiver, uint64 indexed blockedNonce,
  uint256 amount, uint8 receiptVersion, bytes receipt)`, topic0 `0x361d86e4…`, defined in
  `tempo/crates/contracts/src/precompiles/receive_policy_guard.rs`. The receipt bytes decode to
  `ClaimReceiptV1` (originator, recipient, `blockedReason`, `kind`).
- A diverted transfer also emits TIP-20 `Transfer(originator, 0xB10C…, amount)`
  (`precompiles/src/receive_policy_guard/mod.rs:346`). A diverted mint emits `Transfer(0x0, 0xB10C…)`.
- `ReceivePolicyUpdated` and `policyIdCounter()` come from `tip403_registry.rs`.
- Fee events come from `tip_fee_manager.rs`.

**Exclusions.** Every address and 32-byte hash in `deployments/moderato.json` is dropped: roles, Sworn,
the verifier, and the demo txs. Protocol precompiles (`0x20c0…`, `0xfeec…`, `0xdec0…`, `0xb10c…`) are kept.
- That removed 62 Transfer logs in the Moderato window and 3 `TransferBlocked` events. These are exactly
  the three demo diversions in `deployments/moderato.json`.
- The same list was applied on mainnet and matched nothing.

## 2. TIP-20 transfers (7-day window, full scan, not sampled)

Every `Transfer` log from a `0x20c0…` token is put into exactly one category:
- **fee_in**: the fee collection to FeeManager `0xfeec…`. Reverted txs emit this too.
- **fee_out**, **dex**, **mint**, **burn**: the obvious meanings.
- **to_guard / from_guard**: diversions into, and claims out of, the guard.
- **payment**: every other account-to-account transfer.

| | Moderato | Mainnet |
|---|---|---|
| TIP-20 `Transfer` logs | 10,106,085 | 1,116,027 |
| of which fee_in | 6,648,359 | 561,700 |
| of which mint | 1,787,817 (faucet-style) | 5,507 |
| **payment events** | **1,397,272** | **534,893** |
| payment txs | 1,208,842 | 482,217 |
| distinct payment senders | 114,571 | 17,465 |
| distinct payment receivers | 146,093 | 17,692 |
| top-1 sender share | 4.5% | **23.8%** (`0x3851…4fab`) |
| top-10 sender share | 20.7% | 42.5% |
| top tokens by payments | PathUSD 507,972 · BetaUSD 370,653 · ThetaUSD 238,359 · AlphaUSD 125,690 | **USDC.e** (`0x20c0…b9537d11c60e8b50`) 440,864 · pathUSD 46,980 · USDT0 17,815 · DLUSD 12,410 · RD 9,128 |
| to_guard (non-Sworn) | 284 | **0** |

Files: `data/moderato-transfers-7d.json` and `data/mainnet-transfers-7d.json`.

## 3. Diversions to ReceivePolicyGuard

| | Moderato 7 d | Moderato all time | Mainnet 7 d | Mainnet all time |
|---|---|---|---|---|
| `TransferBlocked` (non-Sworn) | 328 | 2,778 | 0 | 2 |
| of which kind = TRANSFER | 284 | 1,641 | 0 | 2 |
| ratio of diverted transfers to payment transfers | **0.020%** (284 / 1,397,556) | — | **0** (0 / 534,893) | — |
| distinct senders / receivers | 124 / 50 (transfer kind) | 865 / 600 | — | 2 / 2 |
| receiver concentration | top receiver 22.6% (Anvil #1) | 59.6% (Anvil #1) | — | — |

On both chains, `Transfer(*, 0xB10C…)` and `TransferBlocked` counts match one-to-one.
The per-week series of Moderato diversions is in the JSON. It is lumpy: 840 in the week of 07-13,
6 in the week of 08-24, and 319 in the week of 09-28. That is the pattern of test runs, not a trend.

Files: `data/*-guard-policy-alltime.json` and `data/*-receive-policy-series.json`.

## 4. Reverted TIP-20 transfer / transferWithMemo txs (random-block sample)

A full receipt scan was too expensive (more than 1M blocks per chain), so this is a **sample**.
- Blocks were chosen uniformly at random from the 7-day window (seed 20261004): 3,000 on Moderato and 8,000 on mainnet.
- A tx counts if any of its calls (including type-0x76 `calls[]`) is `transfer` or `transferWithMemo` on a `0x20c0…` token.
- Revert reasons come from `debug_traceTransaction` (callTracer), decoded against every `error` declared in the precompile sources.

| | Moderato | Mainnet |
|---|---|---|
| sampled txs / transfer txs | 19,658 / 3,035 | 4,027 / 3,200 |
| reverted transfer txs | 65 | 2 |
| **revert ratio (95% Wilson CI)** | **2.14%** (1.68–2.72%) | **0.06%** (0.02–0.23%) |
| reasons | 64 × **out of gas**, 1 × `SpendingLimitExceeded()` (account keychain) | 1 × out of gas, 1 × `InsufficientBalance` |
| distinct reverting senders | 65 (none repeats) | 2 |

**The one finding with substance.** All 64 Moderato out-of-gas reverts:
- were sent to a receiver whose balance in that token was **0** just before
  (`data/moderato-oog-receivers.json`, checked with `balanceOf` at block−1);
- had gas limits between 100,005 and 109,982.

On Tempo, the first credit to an empty balance slot costs about 254k gas for the cold SSTORE, and the
whole transfer about 1.04M (spec 001 §2.2 and `sdk/src/abi.ts`). An Ethereum-sized gas limit therefore
fails exactly when someone pays a new recipient. **[inferred]** The near-identical gas limits suggest
one tool or harness behind most of them.

The mainnet out-of-gas revert went to a non-empty receiver, with a gas limit of 80,648.

Other reverts, for context only. On Moderato:
- 766 of the 1,165 sampled txs to the Stablecoin DEX reverted with `UnknownFunctionSelector`.
- 578 `approve` calls ran out of gas.

Files: `data/*-reverts-sample-7d.json` and `data/*-oog-receivers.json`.

## 5. Fee-token and nonce failures

- **These cannot be counted from chain data.**
  - A tx whose fee token is not accepted, whose fee-token balance is too low, or whose fee can't be
    converted because the FeeAMM lacks liquidity is *invalid*.
  - The same holds for a wrong or reused nonce, an expired `validBefore`, or a replayed expiring nonce.
  - The pool rejects all of these, and they never land in a block. Fee collection happens before execution
    (`revm/src/handler.rs`, cited in spec 001 §2.2), so a fee shortfall never becomes a reverted tx either.
  - This report gives **no number** for them.
  - The only data source would be RPC or mempool rejection logs, and those are not public.
- **On-chain proxies [measured, 7 d]**:

  | FeeManager `0xfeec…` events | Moderato | Mainnet |
  |---|---|---|
  | UserTokenSet (users picking a fee token) | 24,288 (23,920 users) | 47 (30 users) |
  | FeeAMM Mint (liquidity adds) | 28,866 | 2 |
  | FeeAMM RebalanceSwap | 6,067 (2 swappers) | 11 (1 swapper) |
  | FeeAMM Burn | 9 | 0 |

  None of these events records a failure. In the samples, **no** tx to FeeManager reverted (0 of 176 on Moderato).
  The only included fee-adjacent failure was the mainnet `InsufficientBalance`, where the transfer amount
  exceeded the balance left after the fee.
  **[inferred]** On mainnet, few users ever change their fee token (30 users in 7 days) and FeeAMM
  rebalancing comes from a single account. That means fee-token selection mostly runs on defaults.
  It does not tell us how often a fee-token choice fails.

## 6. Moderato is a testnet: what its numbers can and cannot support

- **They can show** that a mechanism exists and behaves as the source code says:
  - diversion happens on a successful tx;
  - the receipt can later be claimed or burned;
  - out-of-gas reverts happen on transfers to empty receivers.
  They can also show that third parties other than Sworn exercise it.
- **They cannot show** frequency in real use, value at risk, or who would pay.
  - Senders include faucets and public dev keys.
  - 1.79M faucet-style mints in 7 days dwarf the 1.40M payments.
  - The receive-policy population is dominated by a permissive default.
- Mainnet traffic is real money but early. One sender produces 24% of payments, and only 3 accounts have
  ever set a restrictive receive policy. So the low mainnet numbers measure *how little the feature is used
  today*, not how often payments would fail if it were widely used.

## 7. What the current numbers cannot tell us

1. **Frequency at scale.** How often diversions would happen once a large receiver turns a receive policy on.
   Today, 3 mainnet accounts have restrictive settings and 2 diversions have ever happened.
2. **Pre-inclusion failures** (fee token, FeeAMM liquidity, nonce, expiry). They are invisible on chain by construction.
3. **Intent.** Whether a diversion surprised the sender or was a deliberate test.
   Every mainnet case looks like a self-test.
4. **Economic weight.** Testnet amounts are faucet money, and the mainnet diversions were 0.25 and 0.01 pathUSD.
5. **Willingness to pay** to prevent any of this.
6. **Reverts outside the 7-day sample.** The revert rates are sampled, with the CIs above.
   Mainnet's 2 of 3,200 is too small to tell reasons apart.
7. **The out-of-gas class on mainnet.** Wallets on mainnet may already estimate gas correctly; the one
   mainnet out-of-gas case went to a non-empty receiver. Moderato's 2% out-of-gas rate on first-time
   receivers may not carry over.

## 8. Reproduce

```
cd docs/research
python3 scripts/find_window.py moderato 2026-09-27T00:00:00 2026-10-04T00:00:00
python3 scripts/scan_transfers.py     moderato 37056728 38059506 data/moderato-transfers-7d.json ../../deployments/moderato.json
python3 scripts/scan_guard_policy.py  moderato 1 38059506        data/moderato-guard-policy-alltime.json ../../deployments/moderato.json
python3 scripts/sample_reverts.py     moderato 37056728 38059506 3000 data/moderato-reverts-sample-7d.json ../../deployments/moderato.json
python3 scripts/check_oog_receivers.py moderato data/moderato-reverts-sample-7d.json data/moderato-oog-receivers.json
python3 scripts/scan_feemanager.py    moderato 37056728 38059506 data/moderato-feemanager-7d.json
python3 scripts/policy_growth.py      moderato data/moderato-policy-growth.json
python3 scripts/receive_policy_series.py data/moderato-guard-policy-alltime.json
# mainnet: same with `mainnet`, window 41407000-42487199, sample 8000 blocks
```

Run times on 2026-10-04, querying one at a time: the Moderato transfer scan took 20 min, the Moderato
whole-history guard/policy scan about 25 min, the Moderato revert sample 37 min, and the mainnet scans
4–20 min each. The mainnet guard/policy scan ran an earlier version of `scan_guard_policy.py`
that fetched every registry event. Its counts for the event types this report uses are the same by construction.
