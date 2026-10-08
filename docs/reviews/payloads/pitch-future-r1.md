# Review before implementing — future uses in Pitch D (2026-10-08)

Read-only. Do not edit, push or send anything. Working directory: /Users/hiroyusai/src/sworn. Answer in ≤ 900 words.

## Context

- Colosseum Crypto World's Fair, Tempo track; submissions close 2026-10-13 06:59 UTC. Pitch D (`video/PITCH-D.md`,
  `video/pitch-d.html`) was just re-framed per your `docs/reviews/pitch-privacy-r1.md` (scenes 1–2: "Private
  execution. Checkable validity.", Zcash used narrowly). The founder re-voices scenes 1–2 only.
- The founder asks whether the pitch should mention these **future uses** of Sworn (Claude's earlier list):
  1. Proof-gated settlement for private channels — already demonstrated on our own Zone (scene 4).
  2. Cheaper per-transaction verification as batches grow — one proof per batch (fixture attest ≈ 260k gas).
  3. Selective disclosure to auditors / regulators — prove properties without revealing the ledger, e.g. solvency
     (portal escrow ≥ Zone-side supply) or that all transfers obeyed TIP-403 policy. Not built: today's proof
     covers whole-batch execution validity.
  4. AI-agent payments — agents pay privately inside a Zone; the counterparty gets settlement proofs (Solana pitches
     payment channels for agents; Tempo has MPP, which Sworn's earlier bonded-answers experiment used). Not built.
  5. Zone-to-Zone transfers where the receiving side need not trust the sending operator. Not verified.
- You earlier said 2 is conditionally true (verification gas per transaction falls; proving time, memory and
  settlement latency can rise), 3 is a future extension, 4 should stay out of the interview's main line, 5 should
  not be raised.

## Claude's proposal

Do not list future uses in the narration. Add **one on-screen line** to scene 5 (the business), under the existing
"Later: beside Tempo's TEE, as an independent check." line, with no change to the voice:

> Later: prove properties of the private ledger without revealing it — e.g. solvency, TIP-403 compliance.
> (roadmap, not built)

Rationale: it extends the privacy framing ("verify without revealing"), adds a market/vision signal for the Market
Size criterion, and fits the founder's banking/regulation background. Items 2, 4 and 5 go only into interview prep
(Q17 "next 90 days", Q20–21) as "being explored"; 5 not at all.

## Read

`video/PITCH-D.md`, `video/pitch-d.html` (scene d5), `_submission/INTERVIEW.md` (Q17, Q20–22),
`_submission/CRITERIA-MAP.md`, `docs/reviews/pitch-privacy-r1.md`, `docs/reviews/submission-r2.md`, and the Zone
spec `spikes/zone-spf/zones/specs/spec.md` (Zone Token Model; TIP-403 mirroring) to judge whether item 3 is
technically plausible as stated.

## What I want

1. **Verdict:** mention future uses in the pitch or not? If yes, which, where (narration vs on-screen), and how many.
2. **Accuracy of item 3 as worded:** is "solvency (escrow ≥ Zone-side supply)" and "TIP-403 compliance" a plausible
   extension of what Sworn proves, given the spec (supply = net deposits − net withdrawals; policies mirrored from
   Tempo)? What would a skeptical Tempo engineer object to? Give a safer wording if needed.
3. **Risk check:** does a roadmap line on screen dilute the one-line story, or read as over-promising next to
   "testnet · unaudited · no customers yet"? Is "(roadmap, not built)" the right qualifier?
4. **Interview:** the exact bullets you would add (Q17 and/or a new Q) for items 2–4, including the trade-offs.
5. Any wording you would change in scene 5 as a whole if this line is added (it is ~20 s, 37 words of narration).
