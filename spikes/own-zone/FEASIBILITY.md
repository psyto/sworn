# Own Tempo Zone anchored to Moderato: feasibility (2026-10-05)

Time-boxed spike. **Before the 2026-10-06 live run (see "Live run" at the end), no transaction was sent to any
public chain and no key or keystore was used.** The only
Moderato traffic was read-only RPC (`eth_call`, `eth_getStorageAt`, `eth_getBlockReceipts`, `eth_estimateGas`,
`tempo_forkSchedule`, `eth_subscribe newHeads`). Everything else ran on local chains: an anvil fork of Moderato,
and an in-process Tempo node at the pinned tempo `346c22eb`, configured like Moderato.

Labels: **[V]** verified here (command output, log or file:line). **[I]** inferred, not tested.

## Verdict: GO-WITH-CONDITIONS

The local rehearsal worked end to end:

1. A standalone Solidity `ZonePortal` was deployed outside the factory.
2. Its verifier was a `SwornZoneVerifier` with `PARENT_CHAIN_ID = 42431`, backed by the **real** SP1 v6.1.0
   Groth16 verifier.
3. Our own zone sequencer ran against it, on an L1 shaped like Moderato (chain 42431, T11 active, no T12/T13,
   250-block `eth_getProof` window).
4. The sequencer's batch was proven with Groth16 by our guest.
5. `submitBatch` made the portal call our verifier. The verifier called the SP1 Groth16 verifier, which ran the
   pairing check, and the batch settled.

See R3 and R5 below. R5 went through three Groth16-verified batches (init, deposit, withdrawal) and ended with
the withdrawal **paid on L1**. Nothing in the zone node or SPF needs Tempo's factory or a T13 L1.

R4 found one real trap. With Moderato's 250-block `eth_getProof` window, the **next** batch's witness cannot be
built after waiting 15 minutes for the previous proof. Tempo's production node avoids this with its proactive
per-block proof collector, but the test harness does not use that collector. So the live run must go through the
`tempo-zone` CLI path, which is not yet rehearsed (C4).

The conditions, each with its evidence:

- **C1. A new guest and vkey.** `0x00ab5a9e697e8e1f81e1db06c7e41afd5dd046438f50b972a48c417d724a5c7b` replaces
  `0x007ef731…5b39`.
  - The existing guest **cannot** prove an own-zone batch. Tempo's SPF always reads the portal at the factory
    address `0x5AD0…<zoneId>` (`zones/crates/spf/src/types.rs:41-43`).
  - On our batch the unpatched host stops with `Tempo witness is missing account 0x5ad0…1092`
    (`logs/r3-unpatched-guest-rejects.log`) [V].
  - The patch pins the portal address in the Zone genesis (`config.swornZonePortal`). The verifier's
    `PINNED_GENESIS_ARTIFACT_HASH` therefore pins the portal too. `SwornZoneVerifier.sol` itself does not change.
  - The new guest still accepts the old dev-chain batch, with the same public values [V].
- **C2. A short, scripted run: about 3 small batches, all settled within about 80 minutes.**
  - The batch's anchor must still be in Moderato's EIP-2935 window when `submitBatch` lands. That window is
    8,191 blocks, which is **4,944 s ≈ 82 min** on Moderato today [V].
  - A batch of 1–5 zone blocks costs 18–30 M cycles, which is 870–890 s of Groth16 on the founder's Mac [V].
  - Moderato produces one zone block per L1 block, about every 0.6 s [V].
  - Each processed deposit and each withdrawal forces a batch boundary (`payload/src/builder.rs:667-679`).
    A demo is therefore **3 batches proven one after another: about 45 minutes** (R5: init replay, deposit,
    withdrawal).
  - Each batch's anchor is fixed when its zone blocks are produced. **The last batch's anchor ages for the
    whole run.** In R5 it was 5,157 of 8,190 blocks old at submission, after 43 minutes. That leaves room for
    about 4–5 sequential proofs, not more.
  - **Batch sizes must stay small.** Once the demo transactions are done, the operator stops the zone. Any
    later blocks never need proving.
  - Running a zone continuously is not possible on this prover: it falls behind about 100× real time.
- **C3. The founder runs the node, sequencer and prover.** The sequencer key is also the zone's
  deposit-decryption (ECIES) key and the L1 batch signer. It is passed as `--sequencer-key-file` (a FIFO is
  accepted, `crates/node/src/cli.rs:395-405`), fed from `scripts/with-keys.sh`. Claude cannot do this step.
- **C4. About 1.5–2 days of build work remains before the live run** (step plan below).
  - The CLI path of `tempo-zone` refuses in-process settlement proving (`cli.rs:271-274`: *"settlement proving
    requires --sequencer.prover-address"*).
  - The rehearsal used the integration-test harness, so the binary needs one more patch and a dress rehearsal.
  - The dress rehearsal must use the L1 proof window of **250** and include **at least three sequential
    proven batches**: init, deposit, withdrawal. That is what proves the per-block collector closes the R4 gap.
- **C5. Disclose the deviations.**
  - It is our own Zone with our own portal (one deliberate change: the deployer, not the factory, may call
    `initialize` once).
  - A sequencer quorum of 1, run by us.
  - Callback withdrawals bounce, because `ZoneMessenger` checks the factory.
  - A zone-side fork schedule pinned at T13 while Moderato's L1 is still T11.

What this removes, if the live run succeeds:

| caveat | after |
|---|---|
| "test batch, not a Moderato Zone" | removed: a Zone whose parent is Moderato (zone chain id `1424314242`), batch anchored to real Moderato blocks |
| "no ZonePortal calls this contract" | removed: `OwnZonePortal.submitBatch` calls `SwornZoneVerifier.verify` (R3 trace) |
| "settlement integration not built" | removed in the simple form: a ZK-only synchronous verifier; withdrawals are queued only after the proof verifies (R1, R4) |
| new: "not Tempo's factory or portal; one operator" | must be disclosed |

---

## 1. Standalone portal

### 1.1 Can `ZonePortal.sol` be deployed and initialised outside the factory? Yes, with a one-line change [V]

- The only factory dependency on the settlement path is `initialize`:
  `if (msg.sender != ZONE_FACTORY_ADDRESS) revert NotFactory();` (zones `crates/contracts/src/runtime/tempo/ZonePortal.sol:269`).
- `onlyDelegateCall` only rejects `address(this) == 0x5AD1…` and is harmless outside the factory
  (`ZonePortal.sol:318-321`).
- `contracts/src/upstream/tempo/OwnZonePortal.sol` makes two changes:
  - `initialize` is callable once by an immutable `INITIALIZER`, which is the deployer;
  - the contract name.
  Everything else is the upstream file (zones `ac49071f`).
- **The storage layout is identical** to upstream's committed `storage-layouts/ZonePortal.json` (checked
  field by field). The Zone EVM's Rust `ZonePortalStorage` therefore reads it exactly as it reads a factory portal.
- Runtime size is 24,056 bytes (limit 24,576). Deploying it costs **24,968,428 gas** on the anvil fork.
  `eth_estimateGas` on real Moderato gives **25,167,757**, under Moderato's 30 M general gas limit [V].
- No other library is needed: `DepositQueueLib`, `WithdrawalQueueLib` and the others are internal, and the
  zone-side Outbox/Inbox are predeploys in the Zone genesis.
- `ZoneMessenger.relayMessage` checks `zoneFactory.zones(zoneId).portal == msg.sender`
  (`ZoneMessenger.sol`). With Moderato's messenger `0x5A4D…`, callback withdrawals (`gasLimit > 0`) fail and
  are bounced. Plain withdrawals (`gasLimit == 0`) never touch it (`ZonePortal.sol:1137-1144`) [V by reading].
  An own messenger is about 10 lines if callbacks are ever needed.

### 1.2 What it assumes about the L1, checked on Moderato (read-only) [V]

| dependency | where | on Moderato today |
|---|---|---|
| EIP-2935 history `0x0000F908…2935` | `BlockHashHistory.sol`, `submitBatch` anchor | present; returns `hash(N)` for N ≥ head−8,190 (4,944 s) |
| TIP-1020 `SIGNATURE_VERIFIER` `0x5165…` `recover` | `_verifySettlement` | works (recovers the right signer) |
| TIP-403 `tokenTransferPolicyId`, `isAuthorizedRecipient`, `validateReceivePolicy` | `_enableTokenInternal`, `_deposit`, `_tryTransfer` | all answer for pathUSD (`true,1` / `true` / `true,0`) |
| `ADDRESS_REGISTRY.resolveRecipient` `0xfDC0…` | `_tryTransfer` | works |
| `TIP20_FACTORY.isTIP20` | `enableToken` | `true` for pathUSD |
| pathUSD metadata ≤ 31 bytes | `_enableTokenInternal` | `PathUSD`/`PathUSD`/`USD` |
| factory, zone ids, sequencer set, encryption keys | factory only, portal storage | **not needed**: zone id, sequencers and verifier are `initialize` arguments; the encryption key is `setSequencerEncryptionKey` (proof of possession) |

The end-to-end check is in **R1** below: deploy, initialise, encryption key, deposit, `submitBatch`, verifier
call and `processWithdrawals`, all on a fork of Moderato's real state.

### 1.3 Precedent: the docs' demo zones 6/7

They are plain Solidity contracts outside the native factory (about 10 KB, `verifier()` =
`0xe42b7fC1…92b1`, legacy 7-argument `submitBatch`). See `docs/research/moderato-zone-feasibility-20261004.md` §1.

Nothing on chain says who deployed them. They predate the native factory (T10, 2026-08-20), so their existence
shows only that Tempo itself ran non-factory Solidity portals on Moderato [V for the code, I for the history].
Our portal follows the same pattern with the current (T13) source.

## 2. Our own sequencer against Moderato

### 2.1 Arbitrary L1 RPC and portal: yes [V]

- The node takes `--l1.rpc-url` and `--l1.portal-address` (`crates/node/src/cli.rs:379-383`).
- The zone EVM reads whatever portal it is given (`crates/evm/src/lib.rs:111,163`).
- The test harness derives the zone id from `portal.zoneId()` and the chain id from the L1 chain id
  (`tests/it/utils.rs:1352-1362`).
- Only three places hard-code the factory address:
  - `SpfConfig::portal()`: the SPF, used by both the sequencer's validator and our guest. **Patched.**
  - `cli_evm_config`: CLI subcommands. **Patched.**
  - the checker ExEx: off by default.
- Genesis:
  - `xtask generate-zone-genesis --tempo-genesis-header-rlp` already accepts an explicit anchor header with no
    factory lookup (`xtask/src/generate_zone_genesis.rs:91-135`).
  - The rehearsal used the node's own `l1_anchored_genesis` (`crates/node/src/genesis.rs:34`), anchored at an
    L1 block **before the portal exists**, like the factory's pre-creation anchor. The zone replayed the
    deploy and `initialize` blocks and minted the deposit (R3, R4) [V].

### 2.2 `eth_getMultiProof`: patched to per-account `eth_getProof`. No Moderato node is needed [V locally, I on Moderato]

- The node calls `eth_getMultiProof` only when building the Tempo state witness (`crates/node/src/rpc.rs:398-424`).
  Moderato's public RPC answers it with HTTP 413.
- The patch adds `OWN_ZONE_SINGLE_PROOFS=1`, which issues one `eth_getProof(account, slots, block)` per account
  instead. The proofs are the same EIP-1186 nodes.
- **All rehearsals ran with this patch on an L1 whose proof window is set to 250 blocks**
  (`rpc_eth_proof_window = 250`, the same as Moderato). The SPF accepted every witness.
- The witness is built seconds after the batch boundary, far inside the window: it is collected at validation,
  not at proving.
- Other L1 methods the node uses, all checked on Moderato:
  - WSS `eth_subscribe newHeads` (works; `finalized == head`);
  - `eth_getBlockReceipts` by hash (works);
  - historical `eth_getStorageAt` (works 3 M blocks back);
  - `eth_sendRawTransactionSync` (exists);
  - `tempo_forkSchedule` (exists; `active: T11`).

### 2.3 T13-only L1 features? None needed [V]

The rehearsal L1 was the pinned Tempo node with `chainId 42431` and **no T12/T13 in its genesis**
(`tempo_forkSchedule.active = "T11"`, logged).

- **Sequencer ABI.** The sequencer picks the settlement ABI from the live L1 fork. On T11 it would send the
  legacy selector (`crates/sequencer/src/settlement.rs:1212-1220`), which our T13-shaped portal does not have.
  Patch: `OWN_ZONE_FORCE_T13_SETTLEMENT=1`. anvil also lacks `tempo_forkSchedule`.
- **Zone rules.** The zone itself runs T13 rules because its genesis pins `t0Time…t13Time = 0`.
  - The zone's fork schedule is inherited from the parent only for fields the genesis leaves out
    (`crates/chainspec/src/lib.rs:122-145`).
  - So Moderato's T12/T13 dates, which the pin does not know, do not affect zone execution.
- **Headers.** The SPF checked Moderato-style T11 headers by hash, and the zone EVM read T11 L1 state, with no issue.

## 3. Proof path

- **Guest.** The existing guest code plus two patches (C1), rebuilt in 55 s.
  - ELF sha256 `6f6fb01e…d6e4`; vkey **`0x00ab5a9e697e8e1f81e1db06c7e41afd5dd046438f50b972a48c417d724a5c7b`** [V].
  - **Second patch, needed for cost** (`patches/attest-own-zone.patch`). With parent 42431 the guest built
    Tempo's built-in `MODERATO` spec, which parses a 2.6 MB genesis: **276,320,014 cycles** for a 2-block batch.
    The patch builds an own-zone genesis against the small DEV spec. It first checks that the artifact already
    pins every `*Block`/`*Time` field, so the result is exactly what the artifact says. That gives
    **24,326,446 cycles** and identical public values [V] (`logs/r3-zkvm-exec-{before,after}-lightspec.log`).
- **Statement.** The digest (spec 003) is unchanged:
  `parentChainId = 42431`, `zoneId = 4242`, `destinationChainId = 42431`, `verifierConfig = "sworn-sp1-groth16-v1"`.
  The zone chain id is `1424314242`.
- **Deploy order.**
  - The verifier pins the genesis, and the genesis pins the portal address. So the order is:
    1. choose the anchor block G (current head);
    2. build the genesis for G and the **predicted** portal address;
    3. deploy the verifier (pinned);
    4. deploy the portal (at the predicted address);
    5. `initialize(verifier)`.
  - The rehearsal predicted both addresses from the deployer nonce and checked them [V].
  - On Moderato, use a fresh key with no other traffic, or drop the prediction (§6, step 3) [I].
- **Batch cadence.**
  - The sequencer cuts a batch at every finalized withdrawal boundary: at least every
    `--zone.batch-interval-blocks` blocks (default 120), and right after a withdrawal.
  - The patched submitter **waits** for `OWN_ZONE_PROOF_DIR/<nextBlockHash>.proof` before `submitBatch`
    (`OWN_ZONE_PROOF_DIR`). R3 waited 15 minutes, then submitted, and the portal accepted it [V].
  - Waiting is fine. What limits the run is the EIP-2935 anchor age (C2), not the sequencer.

Cycle data, all [V], all on our guest:

| batch | zone blocks | content | cycles | Groth16 wall |
|---|---:|---|---:|---:|
| R5 run, blocks 1–3 | 3 | genesis replay | 21,928,270 | 812.5 s |
| R5 run, blocks 4–6 | 3 | deposit | 26,126,115 | 836.2 s |
| R5 run, blocks 7–8 | 2 | withdrawal | 24,319,048 | 866.6 s |
| R4 run, blocks 1–2 | 2 | genesis replay incl. portal deploy/init | 21,173,501 | 860.3 s |
| R3 run, blocks 1–2 | 2 | same | 21,176,559 | 870.7 s (890 s incl. host) |
| R2 run, blocks 8–8 | 1 | empty | 18,306,198 | — |
| R2 run, blocks 6–7 | 2 | withdrawal | 24,326,446 | — |
| R2 run, blocks 1–5 | 5 | deposit | 29,573,879 | — |

That is about 15 M cycles fixed plus about 2–3 M per zone block. Groth16 runs at about 35 µs per cycle on this
Mac. Keep each batch to a few zone blocks: a 40-block batch would be about 120 M cycles, roughly 1 hour on its
own [I, extrapolated]. The whole sequence of proofs must also fit the anchor age (C2).

## 4. Local rehearsal: what ran

**What did not happen locally:** the `tempo-zone` CLI binary, a real Moderato L1, and the 250-block window
combined with three or more sequential proofs (R4 shows that this combination needs the per-block collector).

Patches: `patches/zones-own-zone.patch` (applies to `spikes/zone-spf/zones` with `git apply --check`) and
`patches/attest-own-zone.patch`. Test: `crates/node/tests/it/own_zone.rs` (inside the zones patch).
Contracts: `contracts/` (Foundry ≥ 1.8.4; 1.7.1's Tempo precompiles lack `tokenTransferPolicyId`).

### R1: L1 wiring on an anvil fork of Moderato (chain 42431, fork block 38,235,749) [V]

`contracts/script/R1L1Wiring.s.sol`, `R1Settle.s.sol`; receipts in `logs/r1-anvil-fork-receipts.log`.

- Deployed `SwornZoneVerifier` (real SP1 at `0x2c77…9B18`, and an accept-all mock) and two `OwnZonePortal`s.
  `initialize`, `setSequencerEncryptionKey`, `approve` and `deposit` (1 pathUSD) all succeeded against
  Moderato's real precompiles and pathUSD.
- **Mock-SP1 portal:**
  - `submitBatch` (anchor = real Moderato block 38,235,749) → `SwornZoneVerifier.verify` → `BatchSubmitted`;
  - then `processWithdrawals` paid 0.25 pathUSD;
  - gas 1,594,929 / 329,468.
- **Real-SP1 portal, garbage proof:** the call reverts inside Moderato's SP1 gateway with
  `WrongVerifierSelector(0xdeadbeef, 0x4388a21c)` → `InvalidProof()` (`logs/r1-real-sp1-reject.log`).
- **Limit found.** An anvil fork **cannot host the zone side**. Anvil-mined blocks have `stateRoot = 0x0…0`, and
  their EIP-2935 entries differ from their RPC hashes (block 38,235,804: 2935 `0x83fc…` vs RPC `0x8db1…`). The
  zone's L1 witness, which is built from MPT proofs against header state roots, cannot work there.
  R2–R4 therefore use a real Tempo node as L1.

### R2: zone + sequencer against the own portal, mock SP1 (local Tempo L1 configured like Moderato) [V]

`own_zone::test_own_portal_deposit_and_withdrawal`, about 9 s, passes (`logs/r2-mock-sp1-zone-rehearsal.log`).

- L1: chain 42431, `tempo_forkSchedule.active = T11`, proof window 250.
- Portal `0x9fE4…a6e0`, zone 4242, zone chain `1424314242`.
- Steps that worked: encrypted deposit minted on the zone; withdrawal of 0.5 pathUSD; the sequencer's in-process
  SPF (patched) validated batches 1–5, 6–7 and 8–8.
- `submitBatch` ×2 went out with `verifierConfig = "sworn-sp1-groth16-v1"` (`rehearsal/r2-submitbatch.json`, gas
  1,339,619 / 608,274), and the withdrawal was paid on L1.
- The dumped `blocks6-7` case runs in the new guest: zkVM `publicValues match native host: PASS`. Its digest
  fields equal the captured `submitBatch` calldata (tempo block 13, `nextZoneHeight` 7,
  `withdrawalQueueHash 0x48d3…e970`).

### R3: real Groth16, portal → SwornZoneVerifier → SP1 Groth16 [V]

`own_zone::test_own_portal_real_groth16` plus `scripts/prover-watch.sh`.

- **Production order.** The L1 anchor was block 1, before any deployment. The genesis pinned the predicted
  portal. Then: the SP1 Groth16 verifier v6.1.0, a `SwornZoneVerifier` pinned to that genesis
  (`0xbf72…52f0`), the portal, and `initialize`.
- The zone replayed the deploy/init blocks and minted the deposit.
- The sequencer validated batch 1–2 and waited. The watcher:
  1. checked that the genesis artifact hash matched the pin;
  2. built the guest input for the deployed verifier on chain 42431;
  3. proved Groth16: 21,176,559 cycles, **870.7 s**.
- The sequencer then sent `submitBatch` with the proof **at L1 block 1,797, anchor block 8** (1,789 blocks old),
  and it succeeded. Status 1, gas 1,561,412.
- Call trace (`logs/r3-real-groth16-submitbatch-trace.log`):
  portal → EIP-2935 → TIP-1020 recover → `SwornZoneVerifier.verify` (225,764 gas) → SP1 gateway →
  Groth16 verifier → precompiles 0x06/0x07/**0x08 (pairing)**.
- Portal state afterwards: `withdrawalBatchIndex = 1`, `blockHash = 0x0103…ba0a` (= the proven
  `nextBlockHash`).
- The run was stopped there, because the harness cuts a boundary every 8 blocks (about 4 s), which a 15-minute
  prover cannot keep up with. That is C2.

### R4: the 250-block proof window breaks *sequential* witness building [V], a real finding

- Same setup as R3, with a 40-block interval. Batch 1–2 was proven in 879 s and settled.
- The sequencer then started validating batch 3–5, and building its witness failed:
  `eth_getProof(0x9fE4…a6e0) at Tempo block 10: … distance to target block exceeds maximum proof window`.
  The node retried indefinitely (`logs/r4-proof-window-trap.log`).
- Cause:
  - Batch boundaries are forced by **every processed deposit and every withdrawal**, not only by the interval
    (`crates/payload/src/builder.rs:667-679`). A deposit-then-withdraw run is therefore at least 2–3 batches.
  - In the harness, batch N+1's witness is requested only after batch N is submitted. That is 15 minutes later,
    which is about 1,800 L1 blocks, more than 250.
- What production does about it:
  - The production node runs a **proactive per-block proof collector**: *"Collect one executed block before it
    becomes canonical"* (`crates/sequencer/src/proofs.rs:1,67-90`). It is created whenever `enable_prover` is
    set (`crates/node/src/node.rs:853-878`) and passed to the CLI's own sequencer (`node.rs:1688-1696`).
  - Each zone block's Tempo proofs are then fetched within seconds of the block, inside any window.
  - The test harness spawns its sequencer without the collector (`tests/it/utils.rs:621-640`, `None`). That is
    why R4 failed here.
  - **So the live run must use the CLI path with the collector.** This is step 1 and step 4 of the plan, and it
    is not yet rehearsed [I].

### R5: real Groth16 through to a paid withdrawal (L1 proof window lifted)

Same as R3, but the L1 `eth_getProof` window was raised (`OWN_ZONE_L1_PROOF_WINDOW=100000`) to step around the R4
trap, and `OWN_ZONE_BATCH_INTERVAL=100000`, so that only the deposit and the withdrawal cut boundaries.
`own_zone::test_own_portal_real_groth16` **passed** (`logs/r5-real-groth16-withdrawal.log`).

| batch | content | cycles | Groth16 | submitted at L1 block | anchor (direct) | anchor age |
|---|---|---:|---:|---:|---:|---:|
| 1–3 | portal deploy/init replay | 21,928,270 | 812 s | 1,677 | 8 | 1,669 blocks |
| 4–6 | deposit | 26,126,115 | 836 s | 3,391 | 11 | 3,380 blocks |
| 7–8 | withdrawal (`withdrawalQueueHash 0x48d3…`) | 24,319,048 | 867 s | 5,170 | 13 | **5,157 blocks** |

- Every `submitBatch` carried a real Groth16 proof, and the portal called our verifier, which called the SP1
  Groth16 verifier.
- After the third batch the sequencer's `processWithdrawals` paid the 0.5 pathUSD on L1:
  `OWN-ZONE real: withdrawal paid on L1 after Groth16-verified settlement`, `test result: ok`.
- **Anchor correction to the plan.** A batch's anchor is the **Tempo block its own last zone block imported**
  (`anchor_mode="direct"`). It is fixed when the zone block is produced, not when the batch is prepared.
  - The third batch's anchor was therefore 5,157 blocks old (43 minutes of wall time) at submission, against a
    window of 8,190.
  - On Moderato (about 0.6 s per block) the same 43 minutes would be about 4,300 blocks, which fits.
  - **Every batch of the demo must settle within about 80 minutes of its zone blocks.** In practice that means
    no more than about four or five sequential 15-minute proofs.
  - The sequencer also has an ancestry anchor mode (`recent_tempo_block_number`). The guest supports it, but the
    sequencer used direct mode, and the ancestry mode was not tested here [I].

## 5. T12 (Moderato, 2026-10-08 14:00 UTC)

- **Zone execution is not affected [V by construction].** Our Zone genesis pins every Tempo fork at 0. The
  pinned chainspec's missing Moderato T12/T13 dates therefore never enter the Zone's schedule (§2.3). This
  differs from a factory zone, which inherits Moderato's schedule. The guest and node agree because both read
  the same artifact.
- **L1 side after T12 [I].** In upstream tempo `61c979a`, T12 gates:
  - nonce semantics (`crates/revm/src/handler.rs:1088-1093`);
  - an SSTORE stipend sentry (`precompiles/src/storage/evm.rs:209-210`);
  - new TIP-20 functions (`tip20/dispatch.rs:54,80`);
  - DEX and channel-reserve logic.

  No header or receipt format change was found, and `TempoHeader` is unchanged between pins. So:
  - our pinned node should still decode post-T12 Moderato blocks;
  - our portal should keep working (its calls carry no stipend-only SSTOREs);
  - `tempo_forkSchedule` would report `T12`, which the pin can parse, and the ABI is forced to T13 anyway.

  This is **untested**. A post-T12 run might also meet a new transaction shape in Moderato blocks, or a
  TIP-20/TIP-403 layout change that zone L1 reads hit.
- **Recommendation.** Do the live batch before 10-08 14:00 UTC. A batch settled before T12 stays valid: the
  portal stores only its hashes, and nothing re-verifies it later.
- **Re-pin cost if needed.** Moving to zones `fc26c2f8` / tempo `9de35499` (102 + 203 commits) means redoing
  the zkVM patches, the guest build and a new vkey: 1–2 days, as in the 10-04 research. It is not required
  for the plan below.

## 6. Plan to the live run (fits before T12)

| # | when | who | step | est. |
|---|---|---|---|---|
| 1 | 10-06 AM | Claude | CLI patch: let `tempo-zone --sequencer.enable-prover` run the in-process SPF when `OWN_ZONE_PROOF_DIR` is set (lift the `cli.rs:271-274` gate); build `tempo-zone` with the own-zone patches | 1–2 h |
| 2 | 10-06 | Claude | `sworn-zone-host own-genesis <anchorRLP> <portal>`: genesis, plus the exact artifact bytes and hash the node will dump (the R3 test's `own_genesis_at` logic) | 1 h |
| 3 | 10-06 | Claude | Founder runbook script `scripts/own-zone-live.sh` (print-only unless `--send`): anchor → genesis → verifier → portal → init → enc key → node+sequencer+watcher → deposit → zone withdraw → wait. Optionally drop address prediction: deploy portal first, anchor after its deploy block but before `initialize` [I; one rehearsal run] | 2–3 h |
| 4 | 10-06 PM | Claude | Dress rehearsal of step 3 with the **binary** against a local `tempo node` (chain 42431, T11, **window 250**), at least 3 sequential proven batches (the R4 trap); a large `--zone.batch-interval-blocks` so only deposit/withdraw cut boundaries | 2–3 h, plus about 45 min of proofs |
| 5 | 10-07 | founder | Faucet: fund the deployer and sequencer with pathUSD (`tempo_fundAddress`) | 10 min |
| 6 | 10-07 | founder | Live run under `scripts/with-keys.sh` (txs below); watch the proof (≤ 60 min) and the settlement | 1.5–2 h |
| 7 | 10-07/08 | Claude | Record `deployments/moderato.json`, verify read-only, update spec 003 §7 claims | 1 h |
| — | 10-08 14:00 | | **T12**. Slack: about 1 day for one retry |

### Founder transactions on Moderato (gas from the anvil fork / estimate; fees are paid in a TIP-20, about $0.001 per 1 M gas at today's base fee)

| # | from | tx | gas |
|---|---|---|---:|
| 1 | deployer | deploy `SwornZoneVerifier(0x2c77…9B18, 0x00ab5a9e…5c7b, 42431, 4242, genesisHash)` | 3.62 M |
| 2 | deployer | deploy `OwnZonePortal` (address must equal the one pinned in the genesis) | 25.0 M (estimate 25.17 M) |
| 3 | deployer | `initialize(4242, pathUSD, false, false, [], [], 0x5A4D…, admin, [sequencer], 1, verifier, "")` | 3.09 M |
| 4 | sequencer or admin | `setSequencerEncryptionKey(x, yParity, popV, popR, popS)` | 0.80 M |
| 5 | depositor | pathUSD `approve(portal)` + `deposit(…encrypted…)` (encryption to the sequencer key: xtask `deposit` / harness `ZoneAccount`) | 0.03 M + 0.59 M |
| 6 | zone account | on the zone: `approve(ZoneOutbox)` + `requestWithdrawal` (zone gas, paid in zone pathUSD) | zone |
| 7 | sequencer (automatic) | `submitBatch(… "sworn-sp1-groth16-v1", groth16Proof …)`, once per batch | ≈ 1.3–1.6 M |
| 8 | sequencer (automatic) | `processWithdrawals([w], 0)` | ≈ 0.33 M |

**Sequencer key.** `tempo-zone --sequencer-key-file <(printf %s "$SWORN_ZONE_SEQUENCER_KEY")`, run inside
`scripts/with-keys.sh`. It needs a new `sworn-zone-sequencer` keystore line there, or the deployer key could be
reused. The key exists only in the process environment and the FIFO. The same key decrypts deposits and signs
`submitBatch`/`processWithdrawals`, so it must hold pathUSD for fees.

## 7. Risks

1. **Proof time vs the 82-minute anchor window (C2).**
   - The run is about 3 sequential 15-minute proofs. The last batch's anchor ages for the whole run (R5: 5,157 of
     8,190 blocks after 43 minutes).
   - If a proof misses the window, `submitBatch` reverts with `InvalidTempoBlockNumber`. That batch, and so every
     later one, can never settle in this portal, because its anchor is baked into the proof. The retry is a fresh
     deployment (steps 1–4 again, about 30 M gas).
   - Mitigations:
     - script the demo transactions so batches stay at a few blocks;
     - set a large `--zone.batch-interval-blocks`;
     - stop the zone after the withdrawal;
     - keep the Mac idle;
     - ancestry anchors [I];
     - or the Succinct prover network (founder key and cost; not evaluated).
2. **Untested on the real Moderato.** The rehearsed L1 was the pinned Tempo node. Real Moderato runs newer code
   at the same fork, T11. Possible differences, all [I]:
   - WSS reconnect behaviour;
   - rate limits on per-account `eth_getProof` (a few accounts per batch);
   - `eth_sendRawTransactionSync` latency;
   - Tempo transaction pool rules for the sequencer's 2D-nonce `submitBatch`.
3. **Address prediction.** If the deployer sends any other transaction between computing the genesis and
   deploying, the portal lands elsewhere and the verifier pins the wrong genesis, so a full redeploy is needed.
   Use a dedicated key, or the deploy-portal-first order in step 3.
4. **The CLI path is not yet rehearsed. This is the biggest open item.**
   - R2–R5 used the zones integration-test harness, the same node code launched in-process.
   - The `tempo-zone` binary has its own gates (`cli.rs:262-274`); see step 1 and step 4.
   - With Moderato's 250-block proof window, only the CLI path, with its per-block proof collector, can build
     the second and later batches' witnesses after waiting for an earlier proof (R4).
   - If the collector does not cover the observe-mode prover, the fallback is to patch the prover to build every
     boundary's witness as soon as the boundary is finalized. That is about half a day.
5. **T12 mid-run.** Avoid it (§5). Behaviour after T12 is [I].
6. **Honesty of claims.** This is our Zone, with our portal and one sequencer. It is not a Tempo-created Zone,
   and the factory is not involved.
   - The `PINNED_GENESIS_ARTIFACT_HASH` now commits to our genesis and portal. D3 changes from "Tempo's test
     artifact" to "our artifact".
   - D1 disappears (`PARENT_CHAIN_ID = block.chainid`).
   - D2 (no caller check in the verifier) still holds, but the portal is now the caller. Settlement security
     rests on: our portal code (upstream plus one change), our verifier, and a single sequencer key that also
     holds deposit decryption.
   - Withdrawals are **ZK-gated**: no `processWithdrawals` without a settled, proven batch. They are not
     censorship-resistant: the operator must prove and process. This is the same as spec 004 §3.7.
7. **Messenger.** Callback withdrawals bounce (§1.1). Plain withdrawals only.
8. **Foundry version.** 1.7.1's anvil/forge Tempo precompiles reject `tokenTransferPolicyId`
   (`UnknownFunctionSelector(0x23143aff)`). Use ≥ 1.8.4. The rehearsal used a 1.8.4 binary in the scratch dir;
   the global install was not changed.
9. **Resource use.** Groth16 needs about 20 GB of RAM. Run the prover alone on the Mac during the live run.

## Files

- `contracts/src/upstream/tempo/OwnZonePortal.sol` (+ upstream `interfaces/`, `libraries/`), `contracts/src/SwornZoneVerifier.sol`
  (copy), `contracts/src/rehearsal/AcceptAllSP1.sol` (local only), `contracts/script/R1*.s.sol`; `fetch-libs.sh`.
- `patches/zones-own-zone.patch`: SPF/chainspec portal override, multiproof→getProof, forced T13 ABI, Sworn
  config/proof-file wait, test harness and `own_zone.rs`. `patches/attest-own-zone.patch`: light L1 spec.
- `scripts/prover-watch.sh`: the Sworn prover loop (dump → host → Groth16 → proof file).
- `logs/`, `rehearsal/`: evidence cited above.

## Update after the GO (10-05/06 work): CLI path, genesis tool, dress rehearsals, runbook

- **CLI binary.**
  - `patches/zones-own-zone.patch` now also:
    - lifts the `cli.rs` gate when `OWN_ZONE_PROOF_DIR` is set;
    - runs the in-process SPF **with the durable per-block proof collector** (`prover.rs`, `own_zone_mode`);
    - keys proof files by `<nextBlockHash>-<anchor>`;
    - adds `OWN_ZONE_ANCHOR_SAFETY_MARGIN`;
    - adds the `own-zone-genesis` binary.
  - The patch applies to a fresh `ac49071f` clone after the three zone-spf patches, and the result is
    byte-identical to the tree that was tested.
- **Genesis tool.** `own-zone-genesis --anchor N --deployer D --portal-nonce n+1` is deterministic: two runs on
  Moderato gave the same keccak. It refuses an anchor at which the portal already has code. It also checked
  that Moderato T11 headers hash canonically.
- **CREATE address rule on Moderato** [V]: the founder's past deploys (type `0x76`, `nonceKey 0`) landed exactly
  at `cast compute-address <deployer> --nonce n`.
- **Guest ELF.** The ELF embeds absolute source paths, so it is shipped as `guest-elf/zone-spf-guest-own`
  (sha256 `6f6fb01e…d6e4`, vkey `0x00ab5a9e…5c7b`) and not rebuilt.
- **Dress rehearsals.** See `DRESS.md`.
  - Real CLI binary, a local Tempo L1 shaped like Moderato, **250-block proof window enforced**.
  - Groth16-proven batches settled through `OwnZonePortal` → `SwornZoneVerifier` → SP1, and the withdrawal was
    paid. That happened in dress 2 and dress 3 (2 batches each) and in dress 4 (3 separate batches; see `DRESS.md`).
- **Runbook.** `RUNBOOK.md`, using `scripts/own-zone.sh` (print-only unless `--send`), `scripts/with-zone-keys.sh`
  and `build.sh`.

### Reproduce (local only)

```
# zones tree = spikes/zone-spf/zones (+ its 3 patches) + patches/zones-own-zone.patch; host/attest/guest + patches/attest-own-zone.patch
./fetch-libs.sh && (cd contracts && forge build)            # Foundry >= 1.8.4
export OWN_ZONE_ARTIFACTS=$PWD/contracts/out ZONE_SPF_OBSERVE_PROVER=1 OWN_ZONE_VERIFIER_CONFIG=sworn-sp1-groth16-v1 \
       OWN_ZONE_FORCE_T13_SETTLEMENT=1 OWN_ZONE_SINGLE_PROOFS=1 ZONE_SPF_DUMP_DIR=<dump>
# R2 (mock SP1, ~10 s):
cargo test -p zone-node --test it -- --exact own_zone::test_own_portal_deposit_and_withdrawal --nocapture
# R5 (real Groth16, ~45 min): start scripts/prover-watch.sh on <dump>/<proofs> first, then
OWN_ZONE_PROOF_DIR=<proofs> OWN_ZONE_VKEY=0x00ab5a9e…5c7b OWN_ZONE_L1_PROOF_WINDOW=100000 OWN_ZONE_BATCH_INTERVAL=100000 \
  cargo test -p zone-node --test it -- --exact own_zone::test_own_portal_real_groth16 --include-ignored --nocapture
# R4 = R5 with OWN_ZONE_L1_PROOF_WINDOW unset (250): the second batch's witness fails (the R4 trap).
```

## Live run (2026-10-06): the stop line is met on Moderato

Three Groth16-proven batches of our own Zone settled through `OwnZonePortal` → `SwornZoneVerifier` → SP1 on
Moderato, and the withdrawal was paid (`WithdrawalProcessed` tx `0xfc311841…e1f1`, user +500,000), 58.5 minutes
after the anchor and before T12. Details: `docs/specs/003-zone-verifier.md` ("Results (own Zone live run on
Moderato)") and `deployments/moderato.json` → `OwnZone`. C5 and risk 6 govern every claim made from it.

**The rejection side (2026-10-07).** Our sequencer submitted a forged batch 62 with a valid signed certificate, a
made-up withdrawal queue and the real proof of batch 56–61 replayed. It reverted on the proof (tx `0x3a154e4e…167d`,
status 0; the trace shows the SP1 pairing check failing and `SwornZoneVerifier` reverting `InvalidProof()`), and the
portal's state did not change. The three live proofs are also test vectors (`contracts/test/vectors/own-zone/`),
re-checked by `forge test --match-test OWNZONE` against the real SP1 verifier and the deployed bytecode.
