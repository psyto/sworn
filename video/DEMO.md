# Demo video — Sworn (≤ 3 min, founder's voice)

**Form field:** *Demo video · ≤ 3 min · required* — *"how the product works"*. Target **≈ 165 s**. **The
first 60 seconds must stand alone** (a judge may stop there): by 0:60 they have seen the wrong answer,
the diverted payment and the agent being paid.

Everything on screen is the real thing on **Moderato**: the demo app reading the chain, the explorer,
and the terminal. The proof takes ~7 minutes; it is shown **time-lapsed, labelled as such, with the real
elapsed time on screen.** Record before Moderato's T12 hardfork (**2026-10-08 14:00 UTC = 23:00 JST**, `1791468000`): after it the
answerer refuses until the guest is re-checked. **Recording on Moderato needs `DEMO_ALLOW_REMOTE_TX=1`**
(the demo backend refuses remote signing otherwise) — set it deliberately for the take, never by default.

---

## Scene 1 — the wrong answer, end to end · 0:00–0:60 (≈ 115 words; the rest is silent proof on screen)

**[Demo app, agent wallet. Step 2 card, red banner "demo: this server is configured to lie". Click
"Buy preflight" → "As of block N: receiver +500.00 · reserved 500 ↗". Click "Send 500 to R′". The card shows the
payment: ReceivePolicyGuard +500, R′ +0, read from chain. Click "Challenge" → progress "Re-running
Tempo's own EVM inside a zero-knowledge proof, against block N's hash" → "Slashed · paid 500 to you ↗".
**The challenge is recorded live in full; the edit speeds up THIS challenge's footage, labelled
"time-lapse · ~7 min → 10 s", with the app's real elapsed clock visible.** Do not splice in the app's
built-in "recorded run" fast-forward — it is a different run.]**

> This is an agent about to pay 500 test dollars on Tempo's testnet. First it buys an answer: will the
> receiver actually get it? This server — I configured it to lie, and it says so — answers "yes, plus
> 500", and reserves 500 of its own bond behind that answer, on-chain. The agent pays. But the receiver's
> policy blocks this sender, so Tempo holds the money in its receive-policy guard instead. The answer was
> wrong. The agent challenges: Tempo's own execution engine re-runs that transfer inside a zero-knowledge
> proof — about seven minutes, locally; sped up here. The contract verifies the proof, sees a different
> answer, and the server's bond pays the agent 500.

## Scene 2 — the honest server cannot be slashed · 0:60–1:20 (≈ 45 words)

**[Step 1 card (honest server): "+500.00 · reserved 500". Terminal: the challenge against it, dry run →
`AnswerCorrect`. Highlight `Sworn.sol` lines 323–324: verifyProof, then AnswerCorrect.]**

> The same machinery protects an honest server. Here the answer was right. A challenge with a real
> proof — simulated, so nothing is sent — is rejected: the contract verifies the proof, then sees the
> answer matches. A correct answer is never slashed.

## Scene 3 — what the agent checks before trusting an answer · 1:20–1:50 (≈ 65 words)

**[SDK output, the five checks ticking: question as asked · reserved by this server for me · digest
recomputed = on-chain · contract and vkey pinned · witness captured in 8.7 s. Then the "how it works"
panel's technical detail, reading MAX_AGE = 32 and the vkey from the contract.]**

> Before relying on an answer, the agent's SDK checks five things: the question is the one it asked; the
> reservation is on-chain, for it; the digest it computes itself matches; the contract and the proof key
> are the ones it expects; and it saved the chain's own state proofs — in about nine seconds here — so the
> server can't make an answer unchallengeable by withholding evidence. If that fails, it says so.

## Scene 4 — why you can trust the proof · 1:50–2:25 (≈ 75 words)

**[Terminal: `out/ac2_run.log` scrolling to "AC-2: matched 40 / 40". Then `patches/tempo.patch` —
three hunks. Then the explorer: the Sworn contract, the SP1 verifier v6.1.0.]**

> Why trust the proof? It runs Tempo's own code — tempo-revm, the engine in Tempo's node, built for a
> zero-knowledge VM with three small patches. I replayed forty real Moderato transfers through it, on
> state proven against the block before each: forty of forty match their receipts — status, gas, fees,
> logs and balances. Tempo's own Zones verifier says it isn't a proving guest yet. The contract has no
> owner, no admin and no upgrade path.

## Scene 5 — what it costs, and what's next · 2:25–2:50 (≈ 55 words)

**[The reserve transaction's receipt: gasUsed 551,714, fee ≈ 0.0003 PathUSD. Then the repo README.]**

> A reservation costs about three hundredths of a cent in fees on Tempo; the real cost is the server's
> bond, locked for a day per answer. It insures the answer about one block — not a later payment. Next:
> MPP sellers who want to stand behind their answers. Open source, on Moderato today. Sworn — paid answers
> that can be proven false.

---

## Claims and sources

| claim | source |
|---|---|
| configured to lie, and it says so | `server/` `mode: "dishonest-demo"`; the UI's persistent banner |
| reserves 500 of its bond behind the answer | Moderato reserve `0x08f6…0350` (`deployments/moderato.json`) |
| Tempo holds the money in its receive-policy guard | Moderato payment `0x65bc…312a`: guard +500, receiver +0 |
| about seven minutes, locally | Moderato run: proving 414 s (`out/e2e/moderato-20261003T064745Z.log`) |
| the bond pays the agent 500 | Moderato challenge `0xa7b9…ab9b`; client +500 read at block−1 / block |
| honest answer's challenge rejected after verifying the proof | `out/e2e/moderato-20261003T064745Z-honestReverts-recheck.log`; `Sworn.sol:323–324` |
| SDK's five checks; witness in seconds | `sdk/src/index.ts`; Moderato run `S-1.sdkVerify`, `S-1.witness` (8.7 s) |
| tempo-revm built for a ZK VM with three patches | `patches/tempo.patch` (SPIKE-PATCH-1..3) |
| forty of forty | `out/ac2_run.log` |
| Tempo's Zones verifier says it isn't a proving guest yet | `tempoxyz/zones` `crates/spf/src/lib.rs`, read via the GitHub API 2026-10-03: *"presently a normal Rust verifier rather than a `no_std` proving guest"* |
| no owner, no admin, no upgrade | `contracts/scripts/no-owner.sh`, seen to fail on three planted variants |
| reservation fee ≈ 0.0003 PathUSD | Moderato reserve `0xb2bf…7529`: gasUsed 551,714 × effectiveGasPrice 600,000,001 / 1e12 = 331 units (6 decimals) |

**Not said, on purpose:** any user or customer; mainnet; production; audited.
