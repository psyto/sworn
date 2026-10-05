# Dress rehearsals (2026-10-05): CLI binary on a Moderato-shaped local L1

**Setup, the same for both rehearsals**
- L1: the pinned Tempo node (`tempo 346c22eb`, release), run with `--chain` (the zones test genesis with
  `chainId 42431` and no T12/T13), `--dev --dev.block-time 500ms --dev.finality-depth 1`, and
  **`--rpc.eth-proof-window 250` (enforced)**.
- Checks on that L1:
  - `tempo_forkSchedule.active = "T11"`;
  - `eth_getProof` at head−260 fails with `distance to target block exceeds maximum proof window`, the same
    error text Moderato returns.
- Zone side: the real `tempo-zone` binary (zones `ac49071f` + `patches/zones-own-zone.patch`), driven only
  by `scripts/own-zone.sh`.
- SP1: the vendored SP1 v6.1.0 Groth16 verifier deployed locally. On Moderato the gateway `0x2c77…` routes to
  the same verifier, with the same selector `0x4388a21c`.
- Proofs: `scripts/prover-watch.sh` with the new guest.

## Dress 1 (`logs/dress1/`, debug binary, steps run one at a time): a procedure failure, used to fix the runbook

What worked [V]:
- genesis, then the verifier deploy (3,869,331 gas), the portal at the predicted address (24,968,428), `initialize`
  (3,356,614) and the encryption key (1,054,711), all via the script.
- The node was started 36 L1 blocks after the anchor. The **per-block proof collector** ran from block 1
  (`Collected and persisted block proofs`).
- Batch 1–3 was proven (29,050,159 cycles; 1,276 s, slowed by a concurrent release build) and settled at L1
  3,042 (anchor 481).
- **Batch 4–42 then validated about 21 minutes later with the 250-block window enforced.** Its witness came from
  the collector. This closes the R4 trap (FEASIBILITY.md R4) [V].

What went wrong:
- The deposit was sent *after* the node started. The zone therefore produced 39 one-per-L1-block zone blocks
  before processing it, and the deposit batch (4–42) cost **120,978,871 cycles**, about an hour of Groth16.
- Its direct anchor (L1 520) would have left the 8,190-block window at about L1 8,710, before that proof
  finished. I stopped the rehearsal; nothing was lifted or bypassed.

Fixes, all in the scripts or the patch:
1. `setup` sends the deposit **before** `start`, so the zone processes it during catch-up.
2. `withdraw` fires as soon as the mint shows up.
3. Proof files are keyed by `<nextBlockHash>-<anchor>`. A re-prepared batch (new anchor) gets a new proof
   instead of a stale one.
4. `OWN_ZONE_ANCHOR_SAFETY_MARGIN` (default 3,000 blocks): a direct anchor is used only while at least one
   proof's worth of EIP-2935 headroom remains.

## Dress 2 (`logs/dress2/`, release binary, `own-zone.sh setup --send`)

**Result: settled through Groth16 and the withdrawal was paid, but in 2 proven batches, not 3** [V].

- `setup --send` ran back to back: genesis, verifier, portal, initialize, encryption key and deposit, then the
  node start 33 L1 blocks after the anchor. A typo in the script stopped it once mid-setup; I fixed it and
  re-ran the remaining steps within 15 s.
- The deposit was processed in the zone's first blocks. The withdrawal was requested in zone block 6.

| batch | content | cycles | prover wall | anchor (direct) | submitted at L1 | anchor age |
|---|---|---:|---:|---:|---:|---:|
| 1–2 | setup replay + deposit (zone block 2) | 30,273,522 | **3,907 s*** (runner 1,047 s) | 6,392 | 8,527 | 2,135 blocks |
| 3–6 | withdrawal | 27,548,485 | 922 s (runner 903 s) | 6,396 | 10,378 | **3,982 blocks** |

- `WithdrawalProcessed` at L1 10,380 (tx `0xba34ba57…818c`). The user's L1 pathUSD rose by exactly 500000.
- \* During batch 1 another workload on the Mac (an `ffmpeg` video render in `sworn/video/`, not this spike)
  drove the load average to 295 and swap to 13 GB used. the runner's Groth16 phase took 1,047 s of that, and the L1 dev node
  slowed to about 1.9 s per block. **Live, the Mac must be idle.**
- **Collector evidence:** batch 3–6 was validated 65 minutes after its blocks with the 250-block window
  enforced, and so was a later batch 7–241 (an automatic boundary, which needs no proof). I stopped the run after
  the withdrawal was paid.
- Why 2 batches: the deposit sent before `start` is processed inside the setup batch (see dress 3), so the batches are setup+deposit and withdrawal. Fewer batches are
  *safer* live, but the stop line asks for 3, so dress 3 forces a separate withdrawal batch
  (`WITHDRAW_AFTER_BLOCKS=4`).

## Dress 3 (`logs/dress3/`, release binary, `setup --send` with `WITHDRAW_AFTER_BLOCKS=4`)

**Result: settled through Groth16 and the withdrawal was paid, again in 2 batches** [V].

- `setup --send` took 7 s. The node started 15 L1 blocks after the anchor.
- **Correction to dress 2's explanation:** the deposit is sent before the node starts, so the zone processes it
  inside the setup batch. The withdrawal then gets its own batch.

| batch | content | cycles | Groth16 (runner) | watcher wall | anchor | submitted at L1 | anchor age |
|---|---|---:|---:|---:|---:|---:|---:|
| 1–2 | setup + deposit | 25,890,319 | 831 s | 966 s | 10,516 | 12,215 | 1,699 |
| 3–9 | withdrawal | 32,592,036 | 796 s | **2,828 s*** | 10,523 | 13,849 | 3,326 |

- `WithdrawalProcessed` at L1 13,851 (tx `0xbb389ad0…4056`).
- \* The extra watcher time is SP1 client start-up and execution under memory pressure from the other
  workload: load average about 60, swap 9–13 GB.

**The 400,859,356-cycle batch, explained** [V]:
- It is `blocks10-104`, an *automatic* boundary 95 zone blocks after the withdrawal. The prover watcher
  started on it before I stopped the run. It is not part of the demo and never needed a proof.
- The cost is **per-block**: about 4.2 M cycles × 95 blocks. It is **not** genesis loading. With the light
  chain-spec patch applied, as here, a 1–2-block batch is 21–30 M; without it, it was 276 M (FEASIBILITY.md §3).
- Dress 2's `blocks7-241` is the same thing: 1,968,102,768 cycles for 235 blocks.
- Lesson: after the withdrawal is paid, **stop immediately**. Every later boundary is a growing batch nobody
  needs. `Z status` prints the paid state, and the watcher should not be left running.

## Dress 4 (`logs/dress4/`, release binary, `DEPOSIT_AFTER_START=1 setup --send`): three separate batches

**Result: the STOP LINE IS MET** [V].
- The real `tempo-zone` CLI binary (release), with the 250-block `eth_getProof` window enforced.
- **Three separate batches** (setup, deposit, withdrawal), each proven with Groth16 by the new guest (the
  shipped ELF), settled through `submitBatch` → `SwornZoneVerifier` → SP1 Groth16, every one inside its
  anchor window.
- Then `processWithdrawals` paid.

How the run went:
- Fresh deployer and sequencer keys, funded with only 10 pathUSD each.
- `DEPOSIT_AFTER_START=1 setup --send` took 5 s:
  - anchor L1 13,939;
  - verifier, portal, `initialize` (3,086,000 gas) and encryption key at L1 13,941–13,944;
  - the node started;
  - deposit at L1 13,948, processed in zone block 5;
  - withdrawal requested in zone block 7.

| batch | content | cycles | Groth16 phase (runner) | watcher wall (validate → proof file) | anchor (direct) | submitted at L1 | anchor age / 8,190 |
|---|---|---:|---:|---:|---:|---:|---:|
| 1–2 | setup replay | 21,121,475 | 730 s | 2,369 s | 13,945 | 15,447 | 1,502 |
| 3–5 | deposit (zone block 5) | 26,353,969 | 687 s | 2,348 s | 13,948 | 16,860 | 2,912 |
| 6–7 | withdrawal | 24,655,694 | 1,302 s | 5,581 s | 13,950 | 19,502 | **5,552** |

- `WithdrawalProcessed(to=user, token=pathUSD, amount=500000, success=true)` at L1 19,504 (tx `0xee959726…ce08`).
- The user's L1 pathUSD rose by exactly 500,000.
- Wall clock from setup to payout: 10:51:17 → 13:43:10 UTC, **2 h 52 min**.

**The wall times are dominated by memory pressure from other workloads on the same Mac, not by proving.**
- During the run: load average 60–245, swap 16–50 GB used. The runner sat at an 8.5 GB RSS while thrashing, and
  the L1 dev node slowed to 2–4 s per block.
- On an idle machine (R3/R5, dress 1) each proof was 812–890 s end to end, so this run would have been about
  45 min.
- The slow L1 *helped* the anchor age measured in blocks; on Moderato (0.6 s per block) the clock is time.
  **The live run needs the Mac idle (≥ 20 GB free RAM).**
- With that, 3 proofs × about 15 min ≈ 2,250 Moderato blocks. That is well inside the 8,190-block window.

After the run:
- I stopped everything right after the payout, including the watcher's start on the automatic
  `blocks8-105` boundary. Live, `MAX_PROOFS` now stops the watcher on its own.



