# CWF check-in 3 — Sworn (pivot report)

**Window:** opens 2026-10-02 08:00 PDT, **closes 2026-10-05 08:00 PDT (2026-10-06 00:00 JST)**. One
minute. Prompt: *"Show what you built, share what you learned, and explain what you'll work on next."*
**"Submitted links cannot be changed or deleted."** (Source: the Colosseum page, pasted by the founder;
recorded in the previous entry's STATUS.md.) Check-in 2 was missed; check-in 1 was the previous entry.

**This check-in replaces the previous entry's check-in 3, which was recorded silent on 10-02 and must
not be posted.** Narration: the founder's own voice. Target ≈ 55 s ≈ 115–125 words.

Two variants. **Use A only if the Moderato slash transaction exists when recording** (link it on screen);
otherwise B. Never say A's sentence without the transaction.

---

## Variant A — after the Moderato slash

**[Screen 1 — 0:00–0:15: the repo README hero, then the Moderato explorer: Sworn contract]**

> This week I changed what I'm entering. Confide stays where it was submitted first; for this fair I
> moved to the Tempo track, where my Reth and Revm work fits. The product is Sworn.

**[Screen 2 — 0:15–0:38: the demo wallet — dishonest answer "+500", the payment landing in
ReceivePolicyGuard, the challenge progress, the payout tx on the explorer]**

> On MPP, if a paid answer is wrong, a refund is the server's choice. Sworn makes the server reserve its
> own bond behind each answer. Here a server says the payment lands; Tempo's receive policy diverts it.
> A zero-knowledge proof of Tempo's own EVM catches it, and the bond pays the agent — this transaction,
> on Moderato.

**[Screen 3 — 0:38–0:55: `out/ac2_run.log` "40 / 40", then the gas line from the localnet log]**

> What I learned: our first full run said "blocked" but the transfer had simply run out of gas — Tempo
> prices storage about eleven times Ethereum. The test caught it. Next: the demo and the submission.

---

## Variant B — before the Moderato slash

**[Screen 1 — 0:00–0:15: README hero, then the Moderato explorer: Sworn contract deployment]**

> This week I changed what I'm entering. Confide stays where it was submitted first; for this fair I
> moved to the Tempo track, where my Reth and Revm work fits. The product is Sworn.

**[Screen 2 — 0:15–0:38: `contracts/test/RealGroth16.t.sol` passing; the localnet log's slash line;
the deployed contract on the explorer]**

> On MPP, if a paid answer is wrong, a refund is the server's choice. Sworn makes the server reserve its
> own bond behind each answer, and a zero-knowledge proof of Tempo's own EVM can slash it. It runs
> end to end on Tempo's own node, and it's deployed on Moderato.

**[Screen 3 — 0:38–0:55: `out/ac2_run.log` "40 / 40", then the gas line]**

> What I learned: our first full run said "blocked" but the transfer had simply run out of gas — Tempo
> prices storage about eleven times Ethereum. The test caught it. Next: the first slash on Moderato.

---

## Every claim, and where it is checked

| claim | source |
|---|---|
| Confide "submitted first" elsewhere | Confide was submitted to Stocklana on 2026-09-15 (Confide STATUS.md) |
| MPP refunds are the server's choice | mpp.dev/advanced/refunds: *"Refund decisions are up to your service"* |
| payment lands in ReceivePolicyGuard instead | Tempo `tip20/mod.rs:1349`; **variant A only if the Moderato run's `S-2.trueAnswerIsDiversion` passed** |
| runs end to end on Tempo's own node | `out/e2e/localnet-full-gate.log`, 32/32 |
| deployed on Moderato | `deployments/moderato.json` |
| 40 / 40 | `out/ac2_run.log` last line |
| ran out of gas at the limit; ~11× | `out/e2e/localnet-oog-300k-20261003.log` `gasUsed 300000`; cold SSTORE 254,347 vs 22,147 (founder's reckn spec 011 §2.2c) |

---

**Submitted 2026-10-04** (founder): https://youtu.be/vI-Zx7ue0dA. This is version A, as recorded on 10-03, with no Zone-proof update, keeping the focus on the pivot. Subtitles: `Sworn_CWF_CheckIn3_20261003.en.srt`.
