# Payment exception rates: evidence base (2026-10-04)

**Claim under test:** "As a payment system moves from experimental to real use, payment exceptions grow in absolute volume, and their handling cost is a known, paid-for problem."

**Use:** pitch support for a layer that stops bad payments on Tempo before they are sent.

**Method:** read-only web research. Each figure below is marked:

- **[V]** Verified. The figure was read on the publisher's own page or PDF on 2026-10-04 and is quoted from it.
- **[S]** Secondary. The figure is attributed to a primary publisher, but this research only saw it in a third-party article because the primary page was blocked (HTTP 403) or paywalled.
- **[A]** Analyst-firm or vendor estimate. Treat it as marketing-grade.
- **[U]** Unverified. The figure circulates widely but no traceable primary source was found. **Do not use it in a pitch.**
- **[I]** My inference, not a quote.

---

## Bottom line first

1. **Handling cost is a known, paid-for problem: strongly supported.**
   - Nacha sets a per-return fee that one bank pays another (ACH).
   - Swift prices the industry cost of investigations (wires).
   - LexisNexis/Accuity prices the cost of failed payments globally.
   - Network rules impose return-rate thresholds with enforcement.
   - UK regulators mandated a pre-send check, Confirmation of Payee, that now runs at about 70M checks a month.
2. **Exceptions grow in absolute volume as a system scales: supported only by inference.**
   - I found no source that tracks exception counts over a system's adoption curve.
   - What exists is (a) roughly stable exception *rates* in mature systems and (b) steep *volume* growth in young systems such as FedNow.
   - Absolute exceptions = rate × volume, so the growth claim is arithmetic **[I]**, not a measured series.
   - Pix is the one launch-day data point. Its rejection rate was 9% on day 1, falling to about 6.5% on day 2, so the *rate* fell as the system bedded in.
   - Pitch wording should be "exceptions scale with volume", not "exception rates rise".
3. **For on-chain/stablecoin payments, the published figures are about losses and freezes, not "exception rates" in the bank sense.**
   - Wrong-receiver losses (address poisoning, address misuse, tokens sent to contracts) and issuer freezes are well documented.
   - No source publishes a misdirected-payment *rate* for stablecoin transfers.

---

## 1. ACH (Nacha)

| # | Figure | Source | Tag |
|---|---|---|---|
| 1.1 | Return-rate thresholds: unauthorized **0.5%** (lowered from 1.0%), administrative **3.0%**, overall **15.0%**. The 3.0% and 15.0% levels trigger an inquiry. Rates are measured over a rolling 60 days. | Nacha, "Improving ACH Network Quality" Risk & Quality Rules fact sheet (2015 rule; PDF dated 2019-05): https://www.nacha.org/system/files/2019-05/Risk-and-Quality-Rules-Fact-Sheet.pdf. Quote: "Lowers the existing unauthorized return rate threshold from 1.0% to 0.5% … when an Originator or Third-Party Sender exceeds: An administrative return rate of 3.0% / An overall return rate of 15.0%" | V |
| 1.2 | Codes in each threshold: unauthorized = R05, R07, R10, R29, R51; administrative = R02 (account closed), R03 (no account / unable to locate), R04 (invalid account number); overall = all debit returns excluding RCK. | Nacha, "ACH Network Risk and Enforcement Topics": https://www.nacha.org/rules/ach-network-risk-and-enforcement-topics | V |
| 1.3 | **Published actual network averages (calendar year 2013):** unauthorized **0.03%**, administrative **0.33%**, overall debit return rate **1.42%**. | Same Nacha page as 1.2 (rule effective 2015-09-18) | V |
| 1.4 | More recent unauthorized average: "**The average unauthorized debit return rate for the ACH Network is 0.05%.**" (Jordan Bennett, Sr. Director Network Risk Management) | Nacha, "Should RDFIs have a role identifying first-party fraud?", 2026-01-20: https://www.nacha.org/news/should-rdfis-have-role-identifying-first-party-fraud | V |
| 1.5 | **Cost per return (a priced fee):** the Unauthorized Entry Fee is **$4.50 per return**. The originating bank (ODFI) pays it to the receiving bank (RDFI) for R05/R07/R10/R29/R51 returns. It has been in effect since 2016-10-03. Nacha states the fee is set "at a level that is less than the weighted average cost" RDFIs incur, so it is partial cost recovery. | Nacha, "Improving ACH Network Quality – Unauthorized Entry Fee": https://www.nacha.org/rules/improving-ach-network-quality-unauthorized-entry-fee | V |
| 1.6 | The fee is based on an independent RDFI cost study. The fact sheet says "Best available current data supports fee in range of $3.50 – $5.50 per unauthorized entry". The rule's stated aim is "reducing the incidence of exceptions and returns, and the associated financial and reputational costs." | Nacha fact sheet (1.1) | V |
| 1.7 | Scale: ACH Network volume was **35.2 billion payments** in 2025 (up nearly 5%), worth **$93 trillion** (up almost 8%). | Nacha press release, 2026-01-29: https://www.nacha.org/news/same-day-ach-and-business-business-payments-propel-ach-network-volume-growth-2025 | V |
| 1.8 | "R01 (insufficient funds) is the most common return code" | Repeated by Stripe, PDCflow, Forte and others. **No Nacha-published share of returns by code was found.** | U for any percentage. Directionally widely stated. |

**Not found:** a current (post-2013) Nacha-published *overall* or *administrative* network return rate, and an all-in cost per ACH return beyond the $4.50 fee.

**[I]** Do not multiply 1.42% by 35.2B. The 1.42% is a 2013 *debit* rate, and 35.2B includes credits. Any "N million returns per year" figure would be my construction, not a published number.

## 2. Wires / Swift / ISO 20022

| # | Figure | Source | Tag |
|---|---|---|---|
| 2.1 | Industry cost of cross-border exceptions & investigations (E&I): **about USD 1.6 billion per year**. Early adoption of Swift Case Management could save **over USD 600 million per year**. Investigation time could fall by **up to 80%**. Some banks' costs, including fees and penalties from delayed settlement, exceed **USD 20 million per year**. | Swift, "It's time to transform exceptions and investigations" (April 2025): https://www.swift.com/news-events/news/its-time-transform-exceptions-and-investigations. The primary page returned 403 to this research. Figures were read in Payments Industry Intelligence, 2025-04-25: https://paymentsindustryintelligence.com/swift-targets-1-6bn-cost-cross-border-payment-investigations/ | S |
| 2.2 | "Around 1–3% of all cross-border payments trigger an enquiry process." The source gives no attribution. | PPI Group (consultancy), "Rethinking E&I – the new Swift Case Management": https://www.ppi-group.eu/en/insights/trends-topics/detail/rethinking-ei-the-new-swift-case-management.html | A (unattributed) |
| 2.3 | Swift Payment Pre-validation rationale: one of the leading causes of cross-border payments that fail or lose time is "incorrect beneficiary information – from misspelled names to transposed account numbers". These errors are "detected late in the process" and are among "the most time-consuming and costly to resolve". Pre-validation checks account details via API before sending (about 11,000 institutions, 4 billion accounts). | Swift press release (2021): https://www.swift.com/news-events/press-releases/swift-eliminate-frictions-international-payments-upfront-verification-account-details-real-time (seen via search excerpts and reprints; the swift.com page is 403 to fetch) | S |
| 2.4 | Swift's own STP figures (e.g. the share of gpi payments that are fully straight-through) | Not retrievable: swift.com blocks automated fetch. | Not found / verifiable |
| 2.5 | Per-exception costs that circulate widely: "EUR 15.5–20 per exception manual, ~EUR 10.70 semi-automated", "~EUR 40 per repair / 50× the transaction cost", "EUR 21bn/yr cost to European industry", "2–5% / 2–10% of cross-border payments generate exceptions", "exceptions cost 20–35× processing" | Search excerpts only (FinanceAsia 2004, paywalled; vendor brochures from SmartStream/Pega; a Finextra blog). No primary study could be opened. | **U — do not use** |
| 2.6 | G20 cross-border target: **75% of payments delivered within 1 hour**. The FSB (2025-10-09) says KPIs show only slight improvement since 2023 and the 2027 targets are unlikely to be met. | FSB consolidated progress report, 2025-10-09 (seen via summaries, e.g. https://www.regulationtomorrow.com/2025/10/g20-roadmap-for-cross-border-payments-consolidated-progress-report-for-2025/) | S |

## 3. Cross-border payouts / payroll

| # | Figure | Source | Tag |
|---|---|---|---|
| 3.1 | **Failed payments cost the global economy USD 118.5 billion in 2020** in fees, labor and lost business (EMEA $41.1B, Americas $33.7B, APAC $43.7B). Banks averaged **about $360,000** and corporates just over $200,000 on failed payments in 2020. A failure rate of **5% or above** was "the tipping point that compelled 80% of organizations to act". Account-number issues caused **one third** of failed payments and inaccurate beneficiary details **another third**. "Over one third of payment data elements are still validated manually." **60%** of organizations lost customers due to failed payments. | LexisNexis Risk Solutions / Accuity, "True Cost of Failed Payments", press release 2021-07-14: https://risk.lexisnexis.com/about-us/press-room/press-release/20210714-true-cost-of-failed-payments | V (survey-based estimate by a vendor of payment-validation data. Label it as such.) |
| 3.2 | "**40% of B2B payments fail**, which cost time and money to correct." In the same survey, **27%** name a "high rate of payment failures" as a problem, **32%** say reconciliation takes too long, teams lose **9 hours a week**, and **39%** say half their operations are still manual. Harris Poll, 500 US companies with 500–4,999 employees. | Modern Treasury, "State of Payment Operations 2023", press release 2023-09-21: https://www.moderntreasury.com/newsroom/press-releases/nine-of-10-companies-face-problems-with-payment-operations | V (vendor-commissioned survey. The 40% is presented without methodology, so treat it with caution.) |
| 3.3 | "Approximately 1 in 25 business payments fails on the first attempt." Rejected payments cost "five to ten times more" than clean STP. | Corpay blog (updated 2026-07-27): https://www.corpay.com/resources/blog/hidden-impact-of-payment-rejections. No external source is cited. | A / U |
| 3.4 | "14% of cross-border payments not completed", "up to 11% fail due to incorrect info", "$12 average fee per rejected/repaired payment" | Papaya Global blog (403 to fetch). Appears to recycle the Accuity survey. | U — do not use |

**Not found:** any payout provider (Wise, Tipalti, Payoneer, Hyperwallet, Stripe Connect) publishing its own payout failure or rejection rate. Their docs list causes (invalid or closed account, currency mismatch) but no rates.

## 4. Real-time payments and Confirmation of Payee

| # | Figure | Source | Tag |
|---|---|---|---|
| 4.1 | **Pix launch.** Rejection rate was **9%** on the first full day (2020-11-16) and **6.5–6.7%** on day 2. Central Bank president Roberto Campos Neto attributed it to incorrect data entry (e.g. CPF numbers) and security lockouts after repeated failed key lookups. He compared it to DOC transfers at about 5%. | Mercado & Consumo, 2020-11-18: https://mercadoeconsumo.com.br/18/11/2020/economia/taxa-de-rejeicao-do-pix-esta-em-65-afirma-presidente-do-banco-central/ | V (press report of on-record central bank statement) |
| 4.2 | **FedNow growth (the "experimental to real" curve):** 2024 had **1,505,250** settled payments; 2025 had **8,413,402** (+458.9%), worth **$853.4B**. Q2 2026 had **4,997,811** settled payments, +83.2% quarter on quarter. | Federal Reserve Financial Services, FedNow Volume and Value Statistics (updated 2026-07-06): https://www.frbservices.org/resources/financial-services/fednow/volume-value-stats | V |
| 4.3 | FedNow / RTP rejection rates | Not published. Only reason codes appear in bank API docs (e.g. AC03 account does not exist, AC04 account closed). FedNow statistics count *settled* credit transfers only. | Not found |
| 4.4 | **UK Confirmation of Payee scale:** checks grew "from 14,000 per month in June 2020 to over **70 million per month** by July 2025". Nearly 400 PSPs offer it, covering over 99% of transactions. CoP produced a **59% reduction** in incorrect-account-category claims on Faster Payments since launch. | Pay.UK, 2025-08 (interview with Tell Money): https://www.wearepay.uk/pay-uk-discusses-the-evolution-of-confirmation-of-payee-with-tell-money/ | V |
| 4.5 | CoP reached 2 billion checks with **over 1.9M checks a day** (2024-03-18). | Pay.UK press release: https://newseventsinsights.wearepay.uk/media-centre/press-releases/confirmation-of-payee-reaches-two-billion-checks-helping-protect-uk-consumers-against-fraud/ | V |
| 4.6 | **CoP mismatch rate (single public-sector user):** in 2025, "roughly **10%** of CoP checks have flagged a mismatch ('No Match' result)", consistent since introduction. **12%** of no-matches were because the account did not exist. About **5%** of all checks should trigger a fraud investigation. Sample: 15,578 checks. | Scottish Government Digital blog, "ScotPayments: Confirmation of Payee", 2025-12-08: https://blogs.gov.scot/digital/2025/12/08/scotpayments-confirmation-of-payee-driving-efficiency-and-fraud-prevention/ | V (small sample, one organisation) |
| 4.7 | Vendor CoP result split: 77% match / 18% close match / 5% no match | SurePay (CoP vendor), via IBS Intelligence | A |
| 4.8 | Pay.UK / UK Finance **system-wide** match / close-match / no-match split | Not published (not found) | Not found |
| 4.9 | UK APP fraud (payments to the wrong, fraudster-controlled payee) in 2024: **£450.7M** lost (down 2%), under **186,000 cases**. Total fraud was £1.17B. Under the PSR's October 2024 mandatory reimbursement rules, 86% of in-scope APP losses were returned in the first quarter. | UK Finance Annual Fraud Report 2025, press release 2025-05-28: https://www.ukfinance.org.uk/news-and-insight/press-release/fraud-report-2025-press-release | V |

## 5. Stablecoin / on-chain

| # | Figure | Source | Tag |
|---|---|---|---|
| 5.1 | **Address poisoning** (lookalike address planted in the victim's history so they send funds to the wrong receiver): **270M** on-chain attack attempts, **17M** victims, **6,633** incidents with **at least USD 83.8M** in losses, measured over two years on Ethereum and BSC. | Tsuchiya, Dong, Soska, Christin (CMU), "Blockchain Address Poisoning", USENIX Security 2025: https://www.usenix.org/conference/usenixsecurity25/presentation/tsuchiya | V (peer-reviewed) |
| 5.2 | **Address misuse:** **65,340** high-risk address instances with losses of about 127k ETH + 17.7k BNB, "**over $574.8M**", on Ethereum and BNB Chain. This includes funds sent to an address mistakenly treated as a contract, and funds sent to addresses whose keys were exposed. 99.11% precision. | Shao et al., "Lost in Blockchain Address Misuse", USENIX Security 2026: https://www.usenix.org/conference/usenixsecurity26/presentation/shao | V (peer-reviewed) |
| 5.3 | **ERC-20 tokens sent to contracts that cannot receive them:** "at least $130M" lost (2023). The author is the ERC-223 proponent and the post gives no methodology. | Dexaran, ethresear.ch, 2023-08-15: https://ethresear.ch/t/security-concerns-regarding-token-standards-and-130m-worth-of-erc20-tokens-loss-on-ethereum-mainnet/16387 | A (interested author) |
| 5.4 | **Issuer freezes, 2023–2025:** Tether blacklisted **7,268** addresses holding **$3.29B** USDT (TRON $1.75B, Ethereum about $1.54B). Circle blacklisted **372** addresses holding **$109M** USDC. Dune snapshot 2025-10-07. | AMLBot (AML vendor), 2025-12-05 (updated 2026-01-30): https://blog.amlbot.com/stablecoin-freezes-2023-2025-a-data-backed-analysis-of-usdt-usdc-by-amlbot/ | A (vendor on-chain analysis, reproducible from chain) |
| 5.5 | **Failed-transaction rate, Solana** (2023-08-01 to 2024-07-31, 72.1M blocks): about **52%** of 2.9B non-vote transactions failed. Bots had a **58.43%** failure rate and humans **6.22%**. Top causes: price/profit not met **47.99%**, invalid status **19.19%**, **validity expiration 17.72%**. | Zheng, Wan, Lo, Xie, Yang, "Why Does My Transaction Fail?", arXiv 2504.18055 (ISSTA 2025): https://arxiv.org/html/2504.18055v1 | V (peer-reviewed) |
| 5.6 | Ethereum L2 failure rates after Dencun (Base up to 21%, Arbitrum 15.4%, OP 10.4%). Mainnet briefly above 35%. | Crypto press (CryptoPotato, ForkLog), 2024, citing Dune | S / U (bot-driven DEX traffic, not payments) |
| 5.7 | A stablecoin *transfer* failure or misdirection **rate** (share of stablecoin payments that revert or go to the wrong receiver) | Not found | Not found |

**[I]** The on-chain failed-transaction rates in 5.5–5.6 are dominated by bot and DEX traffic, not payments. Do not present them as "payment failure rates". The human-account figure (6.22%) and the "validity expiration" share are the only parts that carry over to payments, and even those are not payment-specific.

## 6. Market size (spend on payment ops / reconciliation)

| # | Figure | Source | Tag |
|---|---|---|---|
| 6.1 | Account reconciliation software market: **USD 3.9B (2025)**, expected to reach USD 9.4B by 2034 (9.99% CAGR) | IMARC Group (updated 2026-06-12): https://www.imarcgroup.com/account-reconciliation-software-market | A |
| 6.2 | Other estimates for the same market in 2025: USD 4.66B, 4.83B (Reports and Data), 5.09B (Market Research Future) | Analyst-firm reports seen via search | A (they disagree by about 30%, so cite a range or a single firm) |
| 6.3 | Swift E&I industry cost of about USD 1.6B/yr (2.1) and the Accuity failed-payments cost of USD 118.5B (3.1) | see above | S / V-vendor |
| 6.4 | 93% of financial decision makers plan to invest in payment operations within 12–18 months | Modern Treasury 2023 (3.2), seen via the CrowdfundInsider summary | S |

**Not found:** a credible market size specifically for "payment exception handling / investigations software".

---

## What this does and doesn't support for Tempo

Tempo transaction features referenced below come from the vendored source in this repo:

- `tempo/crates/primitives/src/transaction/tempo_transaction.rs`: `fee_token`, `nonce_key`, `valid_before`, `valid_after`
- `tempo/crates/contracts/src/precompiles/receive_policy_guard.rs`: `TransferBlocked` produces a claim receipt with a `recoveryAuthority`, later `ReceiptClaimed` / `ReceiptBurned`

All mappings below are **[I]**.

| Tempo exception | Closest legacy analogue | Evidence it costs money in legacy | How well the analogy holds |
|---|---|---|---|
| **Receive policy blocks the transfer** (TIP-403 / ReceivePolicyGuard: the receiver's whitelist/blacklist or token filter) | (a) **Compliance hold**: funds parked pending review. (b) **CoP "no match"**: the payee side says this isn't right. (c) ACH credit refused by receiver (R23) or account frozen (R16). | CoP: 70M checks a month, a UK regulatory mandate (4.4). About 10% no-match in one public-sector sample (4.6). | **Good for (a).** Tempo does not revert: it parks funds under a claim receipt with a recovery authority, which is operationally the same as a compliance hold. That means a later manual claim or burn step, the same "exception queue" cost structure. **Weak for (b).** CoP checks a *name* against an account, and Tempo has no name layer. The receive policy is the receiver's rule, not identity matching. |
| **Insufficient balance** | **ACH R01** (NSF) | R01 is "the most common return code" (U on share). Overall debit returns were 1.42% in 2013 (1.3). | **Partial.** On ACH, R01 is discovered days later, after the payment was "sent", and generates a return entry plus handling. On Tempo it is an atomic revert at execution, so the remaining cost is a failed tx, a retry, and a payment that didn't happen, not a return workflow. The pre-send value is mostly UX and agent reliability, **not** avoided return-handling cost. Do not borrow ACH return costs for this row. |
| **Wrong fee token** (fee token not accepted, not enough of it, or no liquidity for the fee AMM) | No clean legacy analogue. Loosely currency mismatch on payouts (§3, causes list) or a charges/format reject. | No sourced figure. | **None.** This is Tempo-specific. Pitch it as a new failure class that legacy evidence does not cover. |
| **Nonce / expiry** (`valid_before` passed, nonce conflict) | Missed cut-off / stale instruction. The closest on-chain evidence is Solana "validity expiration" at **17.72% of failed txs** (5.5). | Solana paper (V), but not payment-specific. | **Moderate.** This is a real and measured on-chain failure mode, but the published share is from a bot-heavy dataset. It supports "expiry failures are a top-3 cause on-chain", not a payments rate. |
| **Wrong receiver** (typo, poisoned address, a contract that can't handle the token) | ACH **R03/R04** (no account / invalid number), wire "incorrect beneficiary information", APP fraud | **Strongest legacy evidence.** Accuity: about two-thirds of failed payments come from account-number or beneficiary errors (3.1). Swift built Pre-validation for this (2.3). UK mandated CoP (4.4). APP losses were £450.7M in 2024 (4.9). On-chain: address poisoning ≥$83.8M (5.1), address misuse >$574.8M (5.2). | **Strong, with a twist that favours us.** On EVM-style chains every 20-byte address is "valid", so the R03 "no account" safety net does not exist. A wrong receiver is not returned; it is a silent, final loss or an issuer-freeze case. Legacy rails reject or return this class. A chain *settles* it. This is the clearest argument for a pre-send check. **Caveat:** we have no *rate* for on-chain misdirection, only absolute losses. |

### What the evidence does **not** support

- That exception *rates* rise as a system matures. Pix fell from 9% to about 6.5% within a day, and Nacha's averages are low and stable. Use "exceptions scale with volume" instead.
- Any Tempo-specific exception rate. Our own Moderato scan (`docs/research/data/moderato-guard-policy-alltime.log`) is incomplete: the log stops at about 19% of the range. **No Tempo number exists yet.**
- Per-exception euro and dollar costs for wires (2.5): unverified.
- A payout-provider failure rate (§3): none published.

---

## Pitch-ready sentences (each with citation)

1. "Mature payment networks treat bad payments as a priced cost. Nacha makes the sender's bank pay the receiver's bank $4.50 for every unauthorized ACH return, and says that is still below the receiving bank's average handling cost." (Nacha, Unauthorized Entry Fee rule, https://www.nacha.org/rules/improving-ach-network-quality-unauthorized-entry-fee)
2. "Accuity (LexisNexis Risk Solutions) estimated that failed payments cost the global economy $118.5 billion in 2020. About two-thirds of failures came from wrong account numbers or beneficiary details, the class of error a pre-send check catches." (LexisNexis Risk Solutions press release, 2021-07-14, https://risk.lexisnexis.com/about-us/press-room/press-release/20210714-true-cost-of-failed-payments; vendor survey)
3. "When the UK made payee checks mandatory before sending, usage grew from 14,000 checks a month in 2020 to over 70 million a month by 2025. Checking before money moves becomes infrastructure once a rail is in real use." (Pay.UK, https://www.wearepay.uk/pay-uk-discusses-the-evolution-of-confirmation-of-payee-with-tell-money/)
4. "Swift puts the industry cost of investigating cross-border payment exceptions at about $1.6 billion a year, and is rebuilding its case management on ISO 20022 to cut it." (Swift, April 2025, as reported by Payments Industry Intelligence, https://paymentsindustryintelligence.com/swift-targets-1-6bn-cost-cross-border-payment-investigations/)
5. "On-chain there is no 'account not found' return: a peer-reviewed study counted 270 million address-poisoning attempts against 17 million victims on Ethereum and BSC, with at least $83.8 million sent to lookalike addresses." (Tsuchiya et al., USENIX Security 2025, https://www.usenix.org/conference/usenixsecurity25/presentation/tsuchiya)

Optional sixth (growth curve): "FedNow went from 1.5 million settled payments in 2024 to 8.4 million in 2025 and about 5 million in Q2 2026 alone. A young rail's exception load scales with that curve, even at constant rates." The volume figures are verified (https://www.frbservices.org/resources/financial-services/fednow/volume-value-stats). The "exception load scales" clause is inference: FedNow publishes no rejection rate.
