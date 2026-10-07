# Own Zone on Moderato: founder runbook (live run, 2026-10-07)

**Done 2026-10-06: the live run succeeded** (3 batches settled, withdrawal paid). Results: `docs/specs/003-zone-verifier.md`
→ "Results (own Zone live run on Moderato)".

**Deadline:** settle before Moderato T12, **2026-10-08 14:00 UTC** (FEASIBILITY.md §5).

**How every step behaves:**
- It is **print-only** unless `--send` is given.
- It reads its inputs from `$OWN_ZONE_RUN/config.env` and `state.env`.
- After sending, it checks the result read-only.
- Keys only ever live in the process environment. Claude never runs a `--send`.

The local dress rehearsal of exactly these scripts is recorded in `DRESS.md`.

## 0. One-time preparation (10-06 / 10-07 morning)

### 0.1 Build: about 30–40 min the first time

`./spikes/own-zone/build.sh`

- Builds into `spikes/own-zone/build/` (not committed): `tempo-zone`, `own-zone-genesis` and `tempo-xtask`, from
  zones `ac49071f` plus the patches; and `sworn-zone-host`.
- The guest is **not rebuilt**. The ELF embeds absolute source paths, so a rebuild in another directory changes
  the vkey. The pinned ELF is shipped as `spikes/own-zone/guest-elf/zone-spf-guest-own`
  (sha256 `6f6fb01e…d6e4`).
- `build.sh` verifies the ELF and stops with `VKEY MISMATCH` unless it executes with vkey
  `0x00ab5a9e697e8e1f81e1db06c7e41afd5dd046438f50b972a48c417d724a5c7b`.
- `preflight` checks the ELF hash again.
- Nothing in `spikes/zone-spf` and no existing deployment is touched.

### 0.2 Three DEDICATED keys: new keystores, nonce 0, never used for anything else

```
cast wallet new ~/.foundry/keystores sworn-zone-deployer
cast wallet new ~/.foundry/keystores sworn-zone-sequencer
cast wallet new ~/.foundry/keystores sworn-zone-user
```

Use the password in `~/.config/sworn/keystore.pw`. `spikes/own-zone/scripts/with-zone-keys.sh` loads these three
keystores the same way `scripts/with-keys.sh` loads the others. If you prefer to keep one wrapper, add the three
`load` lines from it to `scripts/with-keys.sh`.

**Deployer nonce requirement:**
- The genesis pins the portal address as `CREATE(deployer, n+1)`, and the verifier lands at `CREATE(deployer, n)`.
- **The deployer key must send NOTHING between `genesis` and `deploy-portal`.**
- Use it for nothing else, ever: no faucet transactions sent *from* it, and no other scripts.
- `deploy-verifier` and `deploy-portal` refuse to run if its nonce has moved.

**The sequencer key** is three things at once:
- the zone block producer;
- the L1 `submitBatch`/`processWithdrawals` signer;
- the **deposit-decryption (ECIES) key**.

It reaches the node only through a FIFO (`--sequencer-key-file <(…)`).

### 0.3 Faucet (fees are paid in a TIP-20)

Fund each address shown by `preflight` with Moderato's faucet (`tempo_fundAddress`, or the web faucet).

| key | needs | why |
|---|---|---|
| deployer | ≥ 0.10 of a fee token | ≈ 32 M gas: verifier 3.9 M + portal 25.0 M + initialize 3.4 M; ≈ $0.02 at today's base fee |
| sequencer | ≥ 0.10 | encryption key 1.1 M + 3 × `submitBatch` ≈ 1.6 M + `processWithdrawals` ≈ 0.3 M |
| user | **≥ 1.1 pathUSD** | deposits exactly 1.0 pathUSD (`DEPOSIT_AMOUNT=1000000`); withdraws 0.5 |

### 0.4 Run directory and config

```
export OWN_ZONE_RUN=spikes/own-zone/runs/moderato-20261007
spikes/own-zone/scripts/own-zone.sh preflight     # first call only writes $OWN_ZONE_RUN/config.env, then exits
```

Review `config.env`. The defaults are:
- `L1_HTTP`: `https://rpc.moderato.tempo.xyz`
- `L1_WS`: `wss://rpc.moderato.tempo.xyz`
- `SP1_VERIFIER`: Moderato's SP1 gateway `0x2c77…9B18`
- `VKEY`: the new vkey
- `ZONE_ID`: 4242 (zone chain id 1424314242)

Below, `Z` stands for: `spikes/own-zone/scripts/with-zone-keys.sh spikes/own-zone/scripts/own-zone.sh`

## 1. Live run (about 1 hour wall time; budget 2 h)

### Steps

**1. Preflight**
- Command: `Z preflight`
- Checks:
  - chain 42431, and `tempo_forkSchedule.active` = T11;
  - the binaries and ELF are present;
  - the SP1 gateway has code;
  - three distinct keys, with their nonces and balances;
  - the user holds at least 1.1 pathUSD.
- If it fails: fix and re-run. Nothing has been sent.

**2. Review (print-only)**
- Commands: `Z genesis`, then `Z deploy-verifier`, `Z deploy-portal`, `Z initialize`, `Z encryption-key`,
  `Z deposit`, `Z start`, `Z withdraw`, all without `--send`.
- `genesis` sends nothing; it only reads the L1 and writes files. The others print the exact calls, gas
  estimates and the expected addresses.
- Then **delete `$OWN_ZONE_RUN/state.env` and `$OWN_ZONE_RUN/genesis/`**, so `setup` takes a fresh anchor.

**3. Setup: `Z setup --send` (about 1 min)**

It runs these back to back:
1. **genesis**: anchor = current head.
2. **deploy-verifier**: deployer nonce n; `SwornZoneVerifier(0x2c77…, VKEY, 42431, 4242, keccak)`.
3. **deploy-portal**: nonce n+1; refuses to run unless the nonce is right.
4. **initialize**.
5. **encryption-key**.
6. **deposit**: approve, then an encrypted deposit of 1.0 pathUSD, sent *before* the node starts, so it lands in a tiny batch.
7. **start**: the node, the sequencer with in-process SPF and the per-block proof collector, and the prover watcher.
8. **withdraw**: waits for the zone mint, then `requestWithdrawal(0.5 pathUSD)` on the zone.

Each step prints its own read-only checks:
- the verifier's immutables;
- `INITIALIZER`;
- `zoneId`, `verifier`, `isSequencer` and `enabledTokenCount`;
- `encryptionKeyCount`;
- the zone balance (1000000).

The last line shows how many L1 blocks have passed since the anchor. **It must be well under 250.**

If any step fails **before `start`**:
- run `Z stop`, then start over with a **new `OWN_ZONE_RUN`**, which gives a new anchor;
- nothing deployed can be reused: the verifier pins this genesis, and the portal pins this verifier;
- a retry costs about 32 M gas.

**4. Watch: `Z status`, repeated about every 5 min (about 45–60 min in total)**
- It shows: `withdrawalBatchIndex`, the queue, anchor ages, prover progress, the user's L1 balance, and the
  `WithdrawalProcessed` count.
- Expected: about 3 small batches, each proven in about 14 min and then settled. After that,
  `WithdrawalProcessed` = 1, and the user's L1 balance rises by 500000.
- If something goes wrong, see §2.

**5. Stop: `Z stop`**
- Stops the node and the prover.
- The zone keeps no obligations: every block after the withdrawal batch is never settled.

### Variants

- **The default gave 2 proven batches in the dress rehearsals** (setup + deposit, then the withdrawal), but **3 in
  the live run (2026-10-06):** setup + deposit (1–51), the zone-side `approve` (52–55), then the withdrawal
  (56–61). The boundary after the `approve` was not investigated.
- `DEPOSIT_AFTER_START=1 Z setup --send` gives **separate setup and deposit batches**, as in dress 4.
  It costs one extra proof (about 15 min) of anchor headroom.
- The prover watcher stops after `MAX_PROOFS` proofs: 3 by default, 4 with `DEPOSIT_AFTER_START`. In the live
  run the old default of 2 would have stopped before the withdrawal batch. A watcher with `MAX_PROOFS=3` was
  started when the first one exited. Later automatic boundaries grow by about 4 M cycles per zone block and are
  never needed. Run `Z stop` as soon as the withdrawal is paid.

### Timing rules

- **Do not send anything else** to the portal or the zone during the run. Every deposit and every withdrawal
  forces another batch.
- Each batch's anchor must still be inside Moderato's EIP-2935 window (8,190 blocks, about 82 min) when its
  `submitBatch` lands.
- `ANCHOR_SAFETY_MARGIN=3000` keeps a direct anchor only while at least 3,000 blocks remain (about 30 min).
  Older anchors fall back to ancestry mode, which was not tested.
- **Keep the Mac otherwise idle: no other agents, builds, video renders or heavy Chrome use.** Groth16 needs about 20 GB of RAM. In dress 4, memory pressure from other workloads stretched one proof's wall time to 93 min (5,581 s); the anchor still had 2,600 blocks of headroom, but on Moderato's 0.6 s blocks that would have been too slow. `preflight` warns when swap is in use.

## 2. What can go wrong live, and what to do

| symptom (`zone.log` / `prover.log`) | meaning | action |
|---|---|---|
| `distance to target block exceeds maximum proof window` from the **proof collector** in the first minutes | the node started more than 250 L1 blocks after the anchor | `Z stop`; new run (`setup` keeps this to about 1 min) |
| `submitBatch` reverts `InvalidTempoBlockNumber` | that batch's anchor is out of the 82-min window | unrecoverable for this portal. Record it; the evidence up to the last settled batch stands |
| `prover-watch: genesis … != pinned …` | the node's genesis artifact differs from the pinned keccak | **stop**. Do not send anything; report it |
| `prove failed` | out of memory or guest rejection | `Z stop`; check `proofs/work/*/prove.log` |
| WSS disconnect messages | the node reconnects by itself (`--l1.retry-connection-interval`) | watch `Z status`; restarting the node (same datadir) resumes |
| HTTP 429 / rate-limit errors on `eth_getProof` | the public RPC throttles | retry happens per block; if persistent, `Z stop` and report |

## 3. After the run (Claude, read-only)

- Record the addresses, transaction hashes, gas, anchor ages and timings in `deployments/moderato.json` and the spec.
- Re-verify the deployed verifier's code and immutables read-only.
- Claims must follow FEASIBILITY.md C5 and risk 6. It is our Zone: our portal, one sequencer, one operator.

## 4. After the run: reproducibility and the rejection side (done 2026-10-07)

- `node spikes/own-zone/scripts/export-vectors.mjs` (read-only): each batch's verify call from its `submitBatch`
  trace, checked equal to the prover's record, plus the deployed verifier's bytecode, into
  `contracts/test/vectors/own-zone/`. Then `cd contracts && forge test --match-test OWNZONE`.
- `Z forged-batch` (print-only), then `Z forged-batch --send` (founder): the sequencer submits a forged, signed batch
  that replays the real proof of batch 56–61. Print-only signs locally and must see the verifier revert
  `InvalidProof()` in an `eth_call` trace; `--send` sends it with a fixed gas limit and `check-tx` proves status 0,
  the verifier's revert in the trace, and an unchanged portal state. Done: tx `0x3a154e4e…167d`, block 38,514,007.
  The signature binds an anchor inside the EIP-2935 window, so a built batch is only valid for about 90 minutes.
