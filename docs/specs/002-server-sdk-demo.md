# 002 — Answering server, client SDK, challenger, demo

> **Status: spec, round 0, 2026-10-03.** Builds on 001 (§R3–R3.8 normative). Moderato only. No key is
> generated, stored or used by an agent: every key comes from an environment variable, and local
> end-to-end tests use **anvil's own dev accounts** on `anvil --network tempo`.

## 1. Components

| component | language | where | does |
|---|---|---|---|
| **answerer** | Rust (reuses `core` + `host/src/rpc.rs`) | `answerer/` | given a question at the latest block N: checks R3.3 rules, checks the live fork schedule (R3.7), computes `Answer` (fees on), returns `(Question, Answer)`; `--lie receiverAfter` flag produces the dishonest answer **for the demo only** |
| **server** | TypeScript (`mppx` server, `viem`) | `server/` | HTTP `POST /preflight`, charged with an MPP `tempo` charge; calls the answerer; sends `reserve(q, a, client, coverage)` from `SWORN_SERVER_KEY`; returns §2. Two instances in the demo: `honest` and `dishonest` (the latter runs the answerer with `--lie`, **and says so in its response and on screen**) |
| **sdk** | TypeScript | `sdk/` | `preflight(serverUrl, params)`: pays via `mppx` client; verifies the response (§3); **captures its own witness at N within the proof window** by invoking the Rust `sworn-witness` CLI; stores it; exposes `challenge(...)` |
| **challenger** | Rust CLI | `challenger/` | `sworn-witness` (capture) and `sworn-challenge` (prove locally with SP1 → send `challenge(server, q, a, publicValues, proof)` from `SWORN_CHALLENGER_KEY`) |
| **demo** | TypeScript web (Vite + React, no backend secrets in the browser) | `demo/` | §4 |

## 2. `POST /preflight`

Request (after the MPP 402 round-trip): `{ from, token, receiver, amount, memo?, feeToken, client }`.

Response `200`:
```json
{ "question": {…R3.1 Question, hex/decimal strings…},
  "answer":   {…R3.1 Answer…},
  "server": "0x…", "sworn": "0x…", "digest": "0x…",
  "reserveTx": "0x…", "coverage": "…",
  "mode": "honest" | "dishonest-demo",
  "guestVersion": "0x51e2…", "guestVkey": "0x0072…" }
```

## 3. What the SDK must check before the client relies on an answer

1. `question` fields equal what it asked (from, token, receiver/amount/memo in `data`, feeToken).
2. The R3.3 rules hold (it refuses otherwise — a server could otherwise reserve something unprovable;
   the contract also enforces the decidable ones).
3. The `Reserved` event in `reserveTx`: emitted by the expected `sworn` contract (codehash pinned), for
   `server`, `client = self`, `digest == digestOf(q, a)` (recomputed locally, EIP-712 per contract),
   `coverage` as stated.
4. `sworn.GUEST_VKEY()` equals `guestVkey`.
5. Witness captured for N (`sworn-witness`) **before** the proof window closes (~150 s); if it fails,
   the SDK reports the answer as **unprotected**.

## 4. Demo (what a judge sees — 001 §4)

- **`/` agent wallet (desktop):** "Pay 500 to R?" → buy preflight from the **honest** server → "as of
  block N: receiver +500.00, reserved 500" → pay. Then the same against **R′ whose receive policy blocks
  the sender**, bought from the **dishonest-demo** server (labelled as such) → "receiver +500 (claimed)"
  → payment lands in `ReceivePolicyGuard` (read from chain) → **Challenge** → progress (proving takes
  ~6.5 min; show elapsed real time; allow a pre-recorded fast-forward **only if labelled**) → payout tx →
  client balance up.
- **`/phone` (mobile layout):** the owner's view — notifications for "answer reserved", "payment
  diverted", "compensated 500 from the server's bond", each with an explorer link.
- **Rules:** every number on screen is read from chain or from a server response whose reservation is
  read from chain (AC-10); testnet label always visible; no private key in the browser — signing is done
  by a local demo backend reading keys from env.

## 5. Acceptance

| id | |
|---|---|
| S-1 | local e2e on `anvil --network tempo` (fork of Moderato or fresh, whichever runs TIP-20 precompiles + receive policies): deploy `Sworn` (with a test `SP1_VERIFIER` address etched via the real `SP1VerifierGroth16V6`), bond, honest preflight → reserve → SDK verification passes |
| S-2 | dishonest preflight → reserve → SDK captures witness → `sworn-challenge` proves locally → `challenge` pays the client; honest answer's challenge reverts `AnswerCorrect` |
| S-3 | SDK rejects: wrong `client`, digest mismatch, other contract, unknown vkey, missing reservation, R3.3-violating question |
| S-4 | answerer refuses when the live fork schedule differs from the guest's, or an activation is within `MAX_AGE` of N |
| S-5 | demo renders only chain-read values (a test that points it at a wrong tx hash shows an error) |

If anvil cannot run Tempo's precompiles/receive policies, say so with the exact error and fall back to
Tempo's localnet container (`tempo/docs/localnet.md`); do not mock TIP-20 for S-1/S-2.
