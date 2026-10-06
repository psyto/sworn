# 003 — A ZK verifier for Tempo Zone batches, shaped like `IVerifier`

Status: r2 (2026-10-04), after Codex r1 CHANGES (`docs/reviews/003-spec-r1.md`). Builds on the zone-spf spike (`spikes/zone-spf/`), which ran Tempo Zones'
own `prove_zone_batch` (zones `ac49071f`) inside SP1 on four real batches from the zones integration
tests, matched native output, and produced a Groth16 proof of `hardfork_t13_recovery` (22,659,079 cycles,
706.6 s locally).

## 1. What the spike does not yet do (the gap this spec closes)

1. The guest commits `keccak256(json(BatchOutput)) || json(BatchOutput)`. That binds the execution result
   but not the **public inputs** the portal passes to `IVerifier.verify` (zone id, Tempo block, anchor,
   expected withdrawal index), nor the verifier or its config. A Nitro attestation commits all of these
   (`zones/crates/prover/src/protocol.rs:122`, `nitro_batch_attestation_hash`).
2. The guest builds the Zone chain spec from a **genesis the prover supplies**. Nothing pins which spec
   was used, so a prover could replay the batch under a different spec.
3. No on-chain contract checks the proof against the `IVerifier` arguments.

## 2. Goals

- **G1 (guest):** commit one digest over everything a Nitro attestation commits, plus the chain spec.
- **G2 (contract):** `SwornZoneVerifier.sol` implements `IVerifier`
  (`zones/crates/contracts/src/runtime/interfaces/IZone.sol:306-345`). It recomputes the digest from
  calldata and checks the SP1 Groth16 proof via the SP1 verifier already on Moderato
  (`0x2c77329747b7C8B293514A6129404D4cefDd9B18`, v6.1.0, the one `Sworn.sol` uses).
- **G3 (evidence):** deploy on Moderato and send one `attest` transaction carrying the real proof of
  `hardfork_t13_recovery`, which emits an event anyone can find and re-check.

Non-goals: wiring into a ZonePortal (only Tempo's factory can choose a zone's verifier:
`tempo zone_factory/mod.rs:110,172`); withdrawals; a Moderato-native Zone batch; replacing Nitro.

## 3. The digest

EIP-712 `hashStruct` (no domain separator, matching the Nitro digest; domain separation comes from
`destinationChainId` + `verifier` + `parentChainId` + `zoneId` inside the struct) of:

```
SwornZoneBatchAttestation(
  uint256 parentChainId, address verifier, uint32 zoneId,
  uint64 tempoBlockNumber, uint64 anchorBlockNumber, bytes32 anchorBlockHash,
  uint64 expectedWithdrawalBatchIndex, uint256 nextZoneHeight,
  bytes32 prevBlockHash, bytes32 nextBlockHash,
  bytes32 prevProcessedHash, bytes32 nextProcessedHash,
  uint64 prevDepositNumber, uint64 nextDepositNumber,
  uint64 prevProcessedTokenCount, uint64 nextProcessedTokenCount,
  bytes32 withdrawalQueueHash, bytes32 verifierConfigHash,
  bytes32 genesisArtifactHash, uint256 destinationChainId)
```

- The first 18 fields have the same meaning and source as `NitroBatchAttestation`; field values come
  from `witness.public_inputs` and from the `BatchOutput` returned by `prove_zone_batch`.
- The struct has a **different name** from `NitroBatchAttestation`, so a digest can never be mistaken for a
  Nitro `user_data`.
- `verifier` is the deployed `SwornZoneVerifier` address (a guest input, so the verifier is deployed
  before proving). `verifierConfigHash = keccak256(verifierConfig)` with
  `verifierConfig = ZK_VERIFIER_CONFIG_V1 = bytes("sworn-sp1-groth16-v1")`, the 20 ASCII bytes
  `0x73776f726e2d7370312d67726f746831362d7631`, so `verifierConfigHash = 0xc405c6c7397b2e658a365c7a4e97b646114812fa0357d8f047caabd14012dd23`.
  **Why not a one-byte tag (changed 2026-10-04):** an earlier version of this spec used `0x02`. Upstream zones commit
  `344ff785` (2026-10-01, `bin/prover/enclave/README.md`, "Verifier configurations") defines `0x01` = Nitro and
  **`0x02` = NoProof**, and Moderato's zone 3 has sent `0x02` with empty proofs since block 37,572,491
  (`docs/research/moderato-zone-feasibility-20261004.md`). A self-describing tag cannot collide with Tempo's one-byte tags.
  The deployment that used `0x02` (`0x64bA9F64…42De`) is marked superseded in `deployments/moderato.json`.
- `genesisArtifactHash = keccak256(genesis_bytes)`: the exact bytes of the genesis JSON the guest parsed
  (hardfork config included). This pins one **artifact**; it does not prove that artifact is the authentic
  spec. Choosing it is a trusted deployment step (the artifact is committed to the repo and its hash recorded).
- `destinationChainId`: the chain the verifier is deployed on (42431 for Moderato), a guest input. The
  contract uses `block.chainid`, so the same proof cannot verify on another chain even at the same address.
- The canonical type string is exactly (one line, no spaces after commas):
  `SwornZoneBatchAttestation(uint256 parentChainId,address verifier,uint32 zoneId,uint64 tempoBlockNumber,uint64 anchorBlockNumber,bytes32 anchorBlockHash,uint64 expectedWithdrawalBatchIndex,uint256 nextZoneHeight,bytes32 prevBlockHash,bytes32 nextBlockHash,bytes32 prevProcessedHash,bytes32 nextProcessedHash,uint64 prevDepositNumber,uint64 nextDepositNumber,uint64 prevProcessedTokenCount,uint64 nextProcessedTokenCount,bytes32 withdrawalQueueHash,bytes32 verifierConfigHash,bytes32 genesisArtifactHash,uint256 destinationChainId)`

**Public values** = `abi.encode(bytes32 ZONE_GUEST_VERSION, bytes32 digest)`, with
`ZONE_GUEST_VERSION = keccak256("sworn-zone-guest-v1")`.

## 4. Guest changes (`spikes/zone-spf/guest`)

The input becomes `{ genesis_bytes: bytes, witness: BatchWitness, verifier: address, verifier_config: bytes, destination_chain_id: u64 }`.

The guest:
1. hashes `genesis_bytes`, then parses them;
2. runs `prove_zone_batch` exactly as today;
3. computes the digest;
4. commits the public values.

It aborts if `verifier_config != bytes("sworn-sp1-groth16-v1")`.

A native host computes the same public values with the same Rust code (shared module, not copied).

## 5. Contract (`contracts/src/SwornZoneVerifier.sol`)

- **Immutables** (constructor): `SP1_VERIFIER`, `ZONE_VKEY`, `PARENT_CHAIN_ID`, `PINNED_ZONE_ID`,
  `PINNED_GENESIS_ARTIFACT_HASH`. No owner, no setters, no upgrade path; `scripts/no-owner.sh` must pass on it.
- **`verify(...)`**: the exact `IVerifier` signature, `view`. It reverts with a custom error when:
  - `verifierConfig != bytes("sworn-sp1-groth16-v1")` (so Tempo's `0x01` Nitro, `0x02` NoProof and the empty config all revert);
  - `zoneId != PINNED_ZONE_ID`;
  - the SP1 proof fails.

  Otherwise it returns `true`. The digest uses `PARENT_CHAIN_ID`, `address(this)`,
  `keccak256(verifierConfig)`, `PINNED_GENESIS_ARTIFACT_HASH` and `block.chainid`, with every other field taken
  from the arguments.
- **`attest(...)`**: same arguments, non-view. Runs the same check, then emits
  `ZoneBatchVerified(uint32 zoneId, uint256 nextZoneHeight, bytes32 prevBlockHash, bytes32 nextBlockHash, bytes32 digest)`.
  It writes nothing to storage.
- **Deliberate deviations from a production verifier**, each stated in NatSpec and in every public text:
  - **D1 `PARENT_CHAIN_ID`:** a constructor argument (1337, the dev chain the batch came from). In
    production it would be `block.chainid`.
  - **D2 no caller check:** Nitro's verifier requires the caller to be the zone's canonical portal. There
    is no portal for this zone on Moderato.
  - **D3 one pinned zone and genesis artifact:** a production verifier would need a registry chosen by
    Tempo. Which artifact is pinned is a trusted deployment choice.
  - **D4 write-nothing demonstration:** the missing caller check (D2) is safe only because `attest` moves
    nothing and stores nothing. It must not be generalized to settlement.

## 6. Acceptance criteria

- **AC-Z1 (execute):**
  - All four real batches PASS, with guest public values equal to the native host's.
  - `tamper_deposit_amount` aborts.
  - **Public-input binding (native, every member):** for `hardfork_t13_recovery`, mutate each of the six
    `PublicInputs` members individually (parent_chain_id, zone_id, tempo_block_number, anchor_block_number,
    anchor_block_hash, expected_withdrawal_batch_index) with the witness otherwise unchanged; each must make
    `prove_zone_batch` return an error. Run natively (same code path the guest runs); one of them (e.g.
    expected_withdrawal_batch_index) is also run in the zkVM executor and must abort.
  - Changing one byte of `genesis_bytes` (e.g. in the alloc of an untouched account) changes
    `genesisArtifactHash`, and therefore the digest.
- **AC-Z2 (golden vector):** a fixed non-trivial vector gives the same digest in Rust and Solidity, and both
  sides assert that their typehash equals `keccak256` of the literal type string in §3, and equals the same
  hard-coded 32-byte constant `0x92642ea5ff5c47ad5a0c977fa87d5a0634b45661ad091c055f6905e7a51d8221`.
- **AC-Z3 (prove):** a Groth16 proof of `hardfork_t13_recovery` whose public values equal the native host's;
  the fixture is written to `contracts/test/vectors/zone-hardfork-sworn-sp1-groth16-v1.json` (the `0x02`-era fixture
  `zone-hardfork.json` stays as the record of the superseded deployment).
- **AC-Z4 (Foundry):**
  - The real fixture passes `verify` and `attest` against the real SP1 Groth16 verifier bytecode.
  - **Calldata fields:** each of the 15 digest fields that come from `verify` arguments, mutated
    individually, makes it revert. So do a wrong `verifierConfig` and a wrong `zoneId`.
  - **Immutable/derived fields, via clone deployments with the same vkey:** a clone with a different
    `PARENT_CHAIN_ID`, one with a different `PINNED_GENESIS_ARTIFACT_HASH`, one at a different address,
    and the original under `vm.chainId(1)` (different `block.chainid`) each reject the real proof.
  - A flipped proof byte and a wrong vkey also reject.
- **AC-Z5 (Moderato):**
  - Deploy; record the address, codehash and constructor args in `deployments/moderato.json` under
    `zoneVerifier`.
  - Send `attest` with the real proof, and record the tx hash and block.
  - `eth_call verify` returns true; one mutated field reverts.
  - `scripts/no-owner.sh` passes on the deployed bytecode.
- **AC-Z6:** `scripts/gate.sh` still passes, and Sworn's existing 59 tests are unchanged.

## 7. What may be claimed afterwards (and what may not)

- **May:** "Tempo's own Zone batch verifier runs inside a zero-knowledge VM, and a contract on Tempo's
  Moderato testnet verified that proof against the `IVerifier` inputs (tx …)."
- **May not:**
  - that a Tempo Zone settles with it;
  - that it secures withdrawals;
  - that the batch came from Moderato (it came from Tempo's zones integration tests on a dev chain);
  - that it is production-ready or audited;
  - that the pinned genesis is Tempo's authentic Zone spec (it is the artifact from Tempo's integration test);
  - anything about cross-chain or settlement security (D2/D4).

  D1–D4 are disclosed wherever the claim appears.

## Results (phase A)

> Measured with `verifierConfig = 0x02`. Superseded by the tag change; see **Results (sworn-sp1-groth16-v1)** below.
> The genesis, typehash, AC-Z1 rejections and contract logic are unchanged. The vkey, digests, golden vector and proofs below are the `0x02` ones.

Measured 2026-10-04 on the founder's Mac (12 cores, 32 GB), SP1 6.3.1. Nothing was sent to any chain.
Logs are in `spikes/zone-spf/z-logs/`.

**Build / code**
- Shared module `spikes/zone-spf/attest` (`sworn-zone-attest`): `sol!` struct, `TYPE_STRING`, `TYPEHASH`,
  input framing and `execute()`. The guest (`guest/src/main.rs`) and the native host (`host/`) both call `execute()`.
  The guest is built with `spikes/zone-spf/build-guest.sh` (`cargo prove build --ignore-rust-version`, plus the RISC-V C compiler for c-kzg/blst/secp256k1/zstd).
  Log: `guest-build.log`. The ELF sha256 is `62b72e9c…d8e2` (`guest-elf.sha256`).
- vkey: `0x006c15314d326e27d72c1c1f83fd2bc0eaf5fb2053e2fe5b3e9415a2d037293d`. It does not depend on the verifier address.
- Pinned genesis artifact: `spikes/zone-spf/genesis/hardfork_t13_recovery.genesis.json`. It is 54,615 bytes, the exact `genesis` substring of the case dump, and its
  `keccak256` is `0xd39aa765427c64ea95821bd5f93d44c89854b0f00fec0e21137421d04fb7c11e`.
- Placeholder verifier for local proofs: `0x000000000000000000000000000000005a0e5a0e`, with destination chain 42431.

**AC-Z1**
- zkVM execute: guest public values equal the native host's for all four batches. The previous spike's guest (which committed JSON, not this digest) is shown for comparison:

  | batch | cycles | spike guest cycles | log |
  |---|---:|---:|---|
  | hardfork_t13_recovery | 25,531,739 | 22,659,079 | `zkvm-exec-hardfork_t13_recovery.log` |
  | spf_batch_execute | 23,463,438 | | `zkvm-exec-spf_batch_execute.log` |
  | spf_builder_equivalence | 21,477,274 | | `zkvm-exec-spf_builder_equivalence.log` |
  | spf_replays_migrated_policy | 19,081,481 | | `zkvm-exec-spf_replays_migrated_policy.log` |

  The batch outputs also equal the `native-output.json` the zones integration tests wrote (`native-*.log`).
- `tamper_deposit_amount`: rejected natively (`prove_zone_batch: failed to execute advanceTempo in zone block 1`). The guest panics in the zkVM and commits no public values.
  Logs: `native-tamper_deposit_amount.log`, `zkvm-exec-tamper_deposit_amount.log`.
- PublicInputs binding (native, `native-mutations.log`): all six single-member mutations are rejected by `prove_zone_batch`:
  - parent_chain_id and zone_id: chain-id mismatch;
  - tempo_block_number: final Tempo block mismatch;
  - anchor_block_number: ancestry length mismatch;
  - anchor_block_hash: anchor hash mismatch;
  - expected_withdrawal_batch_index: index mismatch.

  The expected_withdrawal_batch_index mutation also panics in the zkVM (`zkvm-exec-mut_expected_withdrawal_batch_index.log`).
- One genesis byte (byte 83: the nonce of alloc account `0x0…0` changed from `0x1` to `0x2`): the batch still verifies with an identical `BatchOutput`, but
  `genesisArtifactHash` changes `0xd39a…c11e` → `0x4c5d…e9ba` and the digest changes `0x506f…df6a` → `0xc51b…ac39`.
- `verifier_config = 0x01` is rejected.

**AC-Z2**
- Golden vector `contracts/test/vectors/zone-digest-golden.json`: every field is distinct, and the digest is
  `0xf9bd6871ee9a3957c94697f3b85cd939f7c6000ee56700f4e8cc34d3c46aec7d`.
- Rust (`attest-unit-tests.log`, 2/2) and Solidity (`test_ACZ2_*`) both assert the same value. Both also assert the typehash `0x92642ea5…8221`, which equals `keccak256` of the literal.

**AC-Z3 (placeholder address only)**
- A Groth16 proof of `hardfork_t13_recovery` for `0x…5a0e5a0e` on chain 42431:
  - proving wall time 877.0 s (14 min 57 s end to end incl. build), peak RSS 21.7 GB;
  - public values equal the native host's;
  - SDK verify passed.
- Log: `prove-hardfork_t13_recovery-0x000000000000000000000000000000005a0e5a0e-42431.log`. Fixture: `contracts/test/vectors/zone-hardfork-placeholder.json`.
- The real `zone-hardfork.json` needs the Moderato address. Produce it with `scripts/zone-prove.sh <address>`.

**AC-Z4**
- `contracts/test/SwornZoneVerifier.t.sol` (`forge-zone-tests.log`), 5/5 pass. Both the mock-verifier run and the real run (`deployCodeTo` at the placeholder address, the real v6.1.0 Groth16 bytecode etched at the Moderato SP1 address, `vm.chainId(42431)`) check the same cases:
  - pass verify and attest, with the event emitted and zero storage writes;
  - each of the 15 calldata fields mutated → revert. zoneId fails with WrongZone, plus a clone pinned to the mutated zone fails with InvalidProof;
  - three wrong `verifierConfig` values;
  - clones with a different PARENT_CHAIN_ID, a different PINNED_GENESIS_ARTIFACT_HASH, or a different address, and `vm.chainId(1)`;
  - a flipped proof byte and a wrong vkey.
- Breaking the contract (hashing a constant instead of `withdrawalQueueHash`, `block.chainid`, `PARENT_CHAIN_ID` or `address(this)`) makes the tests fail.

**AC-Z5 prep (nothing sent)**
- `scripts/deploy-zone-verifier.sh` prints only. Its dry run, which only reads Moderato, gives:
  - init code: 3,386 bytes;
  - eth_estimateGas: 3,741,423;
  - log: `deploy-zone-verifier-dryrun.log`.
- `scripts/zone-attest.sh` was rehearsed on a local anvil (chain 42431) using `anvil_setCode` only, with no transactions:
  - the immutables match;
  - `attestationDigest` matches;
  - `verify` returns true;
  - with nextZoneHeight+1 it reverts with `InvalidProof()`;
  - `attest` eth_estimateGas: 267,753;
  - log: `zone-attest-anvil-rehearsal.log`.
- `scripts/no-owner.sh --zone-verifier --code <runtime>` passes on the constructed runtime. That is 2,837 bytes with one STATICCALL and no SSTORE/SLOAD/CALL/DELEGATECALL/CREATE/SELFDESTRUCT (`no-owner-placeholder-runtime.log`).

**AC-Z6**
- `contracts/scripts/gate.sh` passes: 49/49 required, 64 tests run (59 existing + 5 new). Log: `gate.log`.
- Sworn's compiled runtime keccak is still `0x9082880d…5563`, the deployed codehash.

## Results (AC-Z5)

> **Superseded:** this deployment accepts `verifierConfig = 0x02`, which upstream now defines as NoProof (zones `344ff785`).
> It stays on chain and in `deployments/moderato.json` (marked `superseded`). The replacement is not yet deployed.

- **Deployed on Moderato, 2026-10-04.**
  - `SwornZoneVerifier` at `0x64bA9F6481aA06cCF505DA3Bd6d0dce6180A42De`, tx `0x1a0c3bda046cffabcd888588f832f84f9eccbbe2ac73d6e1a070adfe502b189b`.
  - Block 38070241, status 1, gasUsed 3,460,805.
  - The runtime codehash is `0xefc8799a…14ab`.
  - `no-owner.sh --zone-verifier` passes on the deployed code (2,837 bytes, one STATICCALL, no forbidden opcodes).
  - Recorded in `deployments/moderato.json` under `SwornZoneVerifier`.
- **Real proof for this address:** 25,531,739 cycles, Groth16 816.0 s, peak RSS 19.9 GB; public values equal the
  native host's (`spikes/zone-spf/z-logs/prove-moderato.log`, fixture `contracts/test/vectors/zone-hardfork.json`).
- **Read-only checks on Moderato** (`scripts/zone-attest.sh`):
  - the immutables match the fixture;
  - `attestationDigest` = `0x1337e71b…51bd` matches;
  - `eth_call verify` with the real proof returns true;
  - with `nextZoneHeight+1` it reverts `InvalidProof()`.
- **`attest` sent, 2026-10-04:** tx `0x9aa938e8c311c0a9b62c50a312129dde4cc1223c45f3b72ff41ff89503d5dfbd`, block 38071845,
  status 1, gasUsed 260,152. One `ZoneBatchVerified(1, 10, 0x578542fc…b569, 0xc517a760…8065, 0x1337e71b…51bd)` from the
  verifier, matching the batch's native output.

## Results (sworn-sp1-groth16-v1), 2026-10-04

`ZK_VERIFIER_CONFIG_V1` changed from `0x02` to `bytes("sworn-sp1-groth16-v1")`. Nothing was sent to any chain. Logs are in `spikes/zone-spf/z-logs/` and were re-run.

- **Guest:** ELF sha256 `fd7a6a105e915fef3f75402fb65fabca0eca8cbe8c69df4cc73aa07c9a620c51` (`guest-elf.sha256`).
  The **vkey** is `0x007ef7314d2624af811844d494aac02736de7a36ce6f5ef52345fcd0bdac5b39`, from `spikes/zone-spf/elf-vkey.sh` (zkVM execute plus setup, no proof).
- **AC-Z1, zkVM execute:** guest public values equal the native host's for all four batches:
  - hardfork_t13_recovery: 25,536,122 cycles;
  - spf_batch_execute: 23,464,458;
  - spf_builder_equivalence: 21,477,357;
  - spf_replays_migrated_policy: 19,081,958.
- **AC-Z1, rejections:**
  - `tamper_deposit_amount` and the expected_withdrawal_batch_index mutation panic in the zkVM;
  - all six PublicInputs mutations are rejected natively;
  - the genesis byte change moves the digest `0xf4977d85…1cfa` → `0x0924dbeb…3811`;
  - `verifier_config` values `0x01`, `0x02`, empty, and the tag followed by `0x00` are rejected (`native-mutations.log`).
- **AC-Z2:** the golden vector was regenerated, because `verifierConfigHash` is a field. Its digest is now
  `0x18e909651eee33b89350fbd7df0a19381842a1535a6e19e2c147e3445b0919b8`. Rust passes 2/2, and Solidity matches. The typehash is unchanged.
- **AC-Z3:** not yet re-proved. The placeholder `0x02` proof moved to `contracts/test/vectors/superseded/`. The real fixture will be
  produced for the redeployed address by `scripts/zone-prove.sh <address>` and written to
  `contracts/test/vectors/zone-hardfork-sworn-sp1-groth16-v1.json`.
- **AC-Z4:**
  - The mock-verifier test covers every case. Its wrong-config cases are now `0x01`, `0x02`, empty, and the tag followed by `0x00`.
  - `test_ACZ4_REAL_groth16_moderato_all_cases` uses `deployCodeTo` at the fixture's (deployed) address. It is **PENDING**: it skips while the fixture is absent, and fails on a fixture with another config (checked with the old one).
  - `contracts/scripts/check-tests.sh` lists it as PENDING, not required.
- **AC-Z5 prep:**
  - `scripts/deploy-zone-verifier.sh` (print only) now builds the guest and takes the vkey from the ELF, or from an explicit `ZONE_VKEY`, which must match unless `ZONE_VKEY_FORCE=1`. It prints the ELF sha256. Moderato dry run: init code 3,542 bytes, eth_estimateGas 3,901,195.
  - `scripts/zone-attest.sh` also checks `ZK_VERIFIER_CONFIG_V1`. It was rehearsed on anvil (chain 42431, `anvil_setCode` / `anvil_setStorageAt` only) with a **mock** SP1 verifier, because no real proof for the new tag exists yet (`zone-attest-anvil-rehearsal-mock.log`).
  - Before proving, `scripts/zone-prove.sh` refuses an address whose on-chain `ZONE_VKEY` or tag differs from the ELF's. Checked read-only against the superseded `0x64bA9F64…`, which it refused.
  - `no-owner.sh --zone-verifier` passes: 2,993 bytes, one STATICCALL, no forbidden opcodes.
- **AC-Z6:** `contracts/scripts/gate.sh` passes with 49/49 required. 64 tests run: 63 pass, and the zone real-proof test is skipped as PENDING.

## Results (AC-Z5, sworn-sp1-groth16-v1 deployment)

- **Deployed 2026-10-04:** `SwornZoneVerifier` at `0x00F6ed344B9C7F5eBA8788A115f8d6B4c00564e5`.
  - Tx `0x4bb81674725455cccd5857c7683ee4d6e15760223b073f2bf1a34c091d081271`, block 38078600, status 1, gasUsed 3,619,319.
  - Codehash `0x115088cb…72c1`.
  - `no-owner.sh --zone-verifier` passes on the deployed code.
  - On-chain `ZK_VERIFIER_CONFIG_V1` = `"sworn-sp1-groth16-v1"`.
- **Real proof:**
  - 25,536,122 cycles, Groth16 701.1 s, peak RSS 18.5 GB; public values equal the native host's.
  - Log: `spikes/zone-spf/z-logs/prove-moderato-sworn-sp1-groth16-v1.log`.
  - Fixture: `contracts/test/vectors/zone-hardfork-sworn-sp1-groth16-v1.json`.
  - `test_ACZ4_REAL_groth16_moderato_all_cases` passes against it, so the gate no longer has a pending test.
- **Read-only checks on Moderato:**
  - the immutables and the tag match;
  - `attestationDigest` = `0xf73f48c7…71ba`;
  - `verify` returns true;
  - `nextZoneHeight+1` reverts with `InvalidProof()`.
- **`attest` sent:** tx `0xb14b7127895ed8431e63154a4d665d0c19492fbb7c09152c13844e35c5023b80`, block 38080441, status 1, gasUsed 260,419.
  It emitted `ZoneBatchVerified(1, 10, 0x578542fc…b569, 0xc517a760…8065, 0xf73f48c7…71ba)`.
- **The first deployment** (`0x64bA9F64…42De`, config `0x02`) is kept in `deployments/moderato.json` as `SwornZoneVerifierSuperseded`.

## Withdrawal batch (feasibility), 2026-10-04

**Verdict: feasible, with no guest change.** A zone batch that contains a withdrawal, produced by the zones sequencer's own
settlement prover path (`validate_candidate`), runs in the unchanged guest. Its public values equal the native host's, and its
`BatchOutput` equals the sequencer's own SPF output. Nothing was sent to any chain, and no Groth16 proof was made: a proof is bound
to a verifier address, and that verifier is not deployed yet.

The batch is still **from Tempo's zones integration tests on a local dev chain** (parent chain 1337), not from Moderato.
What changes is that it carries a real withdrawal. §7 still applies: this does not show that a Zone's withdrawals are secured
(there is no portal wiring, D2/D4).

**Where the batch comes from**
- The withdrawal tests in `crates/node/tests/it/e2e.rs` (`test_withdrawal_batch_finalization`, …) run against a dummy L1 with no
  sequencer, so no batch is ever validated there. The test used instead is `l1_e2e::test_deposit_and_withdrawal`. It runs a real
  local Tempo L1 dev node, deploys a portal, deposits 1 pathUSD, spawns the sequencer, withdraws 0.5 pathUSD, and waits until the
  withdrawal is paid on L1.
- New zones patch `spikes/zone-spf/patches/zones-withdrawal-dump.patch` (listed in `fetch.sh`; applies after the other two zones
  patches). It is test-only and gated on `ZONE_SPF_OBSERVE_PROVER`:
  - the l1_e2e harness passes an in-process `SettlementProverConfig` (`prover_address: None`) to `spawn_zone_sequencer`. Its debug
    API calls `debug_zoneExecutionWitness` over the zone node's own RPC, because the in-process `NodeZoneDebugApi` is private to
    `zone-node`;
  - the sequencer's settlement prover then runs `validate_candidate` → `prove_zone_batch` → `compare_output` on every settlement
    batch. It skips only the durable-persistence requirement and the Nitro attestation, and the batch is then submitted without a
    proof, as in every other test. A real validation failure still fails the submission.
- Command (from `spikes/zone-spf/zones`):
  `ZONE_SPF_DUMP_DIR=<dir> ZONE_SPF_OBSERVE_PROVER=1 RUST_LOG=info cargo test -p zone-node --test it -- --exact l1_e2e::test_deposit_and_withdrawal --nocapture`.
  The test passes (1/1, 6.9 s). The sequencer validated two batches (`z-logs/withdrawal-zones-test-prover-lines.log`, full log
  `z-logs/withdrawal-zones-test-deposit_and_withdrawal_blocks5-6.log`):

  | batch | blocks | deposits | withdrawals | user txs | withdrawalQueueHash |
  |---|---|---:|---:|---:|---|
  | zone blocks 1–4 | 4 | 1 | 0 | 0 | zero |
  | **zone blocks 5–6** | 2 | 0 | **1** | **2** | **`0xcf747192…02e7`** |

  Block 5 holds the recipient's `approve(ZoneOutbox, max)` on pathUSD. Block 6 holds its `ZoneOutbox.requestWithdrawal` and
  `finalizeWithdrawalBatch` with a count of 1.
- Each rerun produces a different batch and a **different genesis artifact**. The L1 dev node's genesis hash, written into
  TempoState slot 0 of the zone genesis, and the block timestamps change per run (checked: a second run gave genesis
  `0x067aff7b…ee4a`). The committed artifact is therefore the record, and rerunning the test does not regenerate it.

**The case** `deposit_and_withdrawal_blocks5-6`
- `spikes/zone-spf/witness/deposit_and_withdrawal_blocks5-6.case.json` (the sequencer's dump, byte-identical) and `.native-output.json`.
  Also `.bin` / `.bin.expected`, the guest input for the placeholder verifier `0x…5a0e5a0e` on 42431.
- Genesis artifact `spikes/zone-spf/genesis/deposit_and_withdrawal_blocks5-6.genesis.json`: 54,606 bytes, the exact `genesis`
  substring of the case dump (byte offset 11), cut with `sworn-zone-host extract-genesis` like the four existing ones.
  **`keccak256 = 0x2736e5fba4db8533f8611e21035914ebd9bab157b2d1a751d939136b52133236`** (the new `PINNED_GENESIS_ARTIFACT_HASH`,
  also checked with `cast keccak`).
- Public inputs: **zone id 1, parent chain id 1337**, the same as the deployed verifier. Tempo block 9, anchor block 9
  (`0x32b7d416…f7be`), expected withdrawal batch index 2. Zone chain id 5742371274753. `nextZoneHeight` 6.

**Execution** (logs in `spikes/zone-spf/z-logs/`)
- Native host (`native-deposit_and_withdrawal_blocks5-6.log`):
  - accepted;
  - all 11 `BatchOutput` fields equal the sequencer's `native-output.json`: PASS;
  - digest for the placeholder `0xbb031a6d…11aa`.
- zkVM execute (`zkvm-exec-deposit_and_withdrawal_blocks5-6.log`):
  - **24,443,996 cycles**, compared with 19.1–25.5 M for the four earlier batches;
  - `publicValues match native host: PASS`;
  - vkey `0x007ef731…5b39`.
- Rejections:
  - all six PublicInputs mutations are rejected natively;
  - the genesis byte change moves the digest `0xbb031a6d…11aa` → `0x4e5da439…6ca3`;
  - the four wrong `verifier_config` values are rejected (`native-mutations-deposit_and_withdrawal_blocks5-6.log`);
  - the `expected_withdrawal_batch_index` mutation panics in the zkVM (`expected 3, got 2`; `zkvm-exec-mut_expected_withdrawal_batch_index-deposit_and_withdrawal_blocks5-6.log`).
- Withdrawal-specific tamper: setting block 6's `finalizeWithdrawalBatchCount` to 0 is rejected natively
  (`finalization sender count mismatch: expected 0, got 1`) and panics in the zkVM. Setting it to null is rejected natively
  (`native-tamper-withdrawal-count-…`, `zkvm-exec-tamper-withdrawal-count-…`).
- Guest unchanged: `elf-vkey.sh` gives ELF sha256 `fd7a6a10…0c51` and vkey `0x007ef7314d2624af811844d494aac02736de7a36ce6f5ef52345fcd0bdac5b39`
  (`elf-vkey-withdrawal-check.log`). A `build-guest.sh` rebuild gives the same ELF; the guest does not depend on `zone-sequencer`
  or `zone-node`, which are the only crates the new patch touches.

**Deployment prep (nothing sent)**
- `scripts/deploy-zone-verifier.sh` takes `ZONE_CASE=<name>` (or `ZONE_GENESIS_FILE`), `ZONE_ID` and `ZONE_PARENT_CHAIN_ID`.
  The defaults are today's values (hardfork genesis, zone 1, parent 1337). The genesis hash must equal the one recorded here
  for that artifact, or `ZONE_GENESIS_EXPECT` for any other file. Without `--send` it prints only. The Moderato dry run
  (`deploy-zone-verifier-dryrun-deposit_and_withdrawal_blocks5-6.log`, reads only) gives the constructor
  `(0x2c7732…9B18, 0x007ef731…5b39, 1337, 1, 0x2736e5fb…3236)`, 3,542 bytes of init code and eth_estimateGas 3,901,195.
- `scripts/zone-prove.sh` takes `ZONE_CASE=<name>` (default `hardfork_t13_recovery`). It writes
  `contracts/test/vectors/zone-<name>-sworn-sp1-groth16-v1.json`. Its read-only pre-check now also requires the on-chain
  `PINNED_GENESIS_ARTIFACT_HASH` to equal the case's genesis.
- `scripts/zone-attest.sh` already reads everything from the fixture and needs no change. **Its anvil rehearsal is pending**,
  because no proof exists yet.
- Founder commands, in order:
  1. `ZONE_CASE=deposit_and_withdrawal_blocks5-6 scripts/deploy-zone-verifier.sh` (print only; check that the constructor shows `0x2736e5fb…3236`)
  2. `ZONE_CASE=deposit_and_withdrawal_blocks5-6 scripts/with-keys.sh scripts/deploy-zone-verifier.sh --send` → address `A`.
     Then run `scripts/no-owner.sh --zone-verifier --code $(cast code A --rpc-url https://rpc.moderato.tempo.xyz)` and record `A` in `deployments/moderato.json`.
  3. `ZONE_CASE=deposit_and_withdrawal_blocks5-6 scripts/zone-prove.sh A` (about 12–15 min, about 20 GB; the pre-check refuses `A` if its genesis/vkey/tag differ)
  4. `scripts/zone-attest.sh A contracts/test/vectors/zone-deposit_and_withdrawal_blocks5-6-sworn-sp1-groth16-v1.json` (read-only checks + calldata), then the same command under `scripts/with-keys.sh … --send`.
     The expected event is `ZoneBatchVerified(1, 6, 0x486a3805…03c3, 0x381b0c6d…5095, <digest for A>)`.

## Results (withdrawal batch on Moderato)

- **Second instance:** `SwornZoneVerifier` at `0xF2e1E74c14B10bE4dda591dbE50F91b88bDcBA11`.
  - Deploy tx `0xf7300650a0f75f2135ef0af6889ffeba26af4d01bf2a8d02b4cb2e612b52a653`, block 38095887.
  - Same code and vkey as the first. Pinned genesis `0x2736e5fb…3236` (`deposit_and_withdrawal_blocks5-6.genesis.json`).
  - `no-owner` passes on the deployed code.
- **Real proof:** 24,443,996 cycles, Groth16 891.1 s, peak RSS 19.8 GB; public values equal the native host's.
- **Read-only checks:**
  - every immutable matches;
  - `attestationDigest` = `0x8d338158…eabd`;
  - `verify` returns true;
  - `nextZoneHeight+1` reverts with `InvalidProof()`.
- **`attest`:** tx `0xa63009fd13648ed246885b7b476e8284e55bab4d5a9325127155fe292b3df770`, block 38097996, status 1, gasUsed 260,863.
  It emitted `ZoneBatchVerified(1, 6, 0x486a3805…03c3, 0x381b0c6d…5095, 0x8d338158…eabd)`.
- **What this shows:** a batch with a withdrawal (`withdrawalQueueHash` `0xcf747192…02e7`) and user transactions is
  proven and verified on chain. It is still a dev-chain batch from Tempo's integration tests, and it says nothing
  about withdrawals being secured (no portal, D1–D4).

## Results (own Zone live run on Moderato, 2026-10-06)

Plan, conditions and runbook: `spikes/own-zone/FEASIBILITY.md`, `RUNBOOK.md`. Record: `deployments/moderato.json` → `OwnZone`.

- **What ran:** our own Zone (zone 4242, zone chain id 1424314242), anchored to Moderato block 38,406,286.
  - `OwnZonePortal` `0xE4818EC6ca046693DafCE608C7F2226604F3daE3`, deployed outside Tempo's factory. It is upstream `ZonePortal` plus one change: the deployer, not the factory, may call `initialize` once.
  - Its verifier is a third `SwornZoneVerifier`, `0x15D192a08F41150cae9178D14D55c04F27FF2733`:
    - `PARENT_CHAIN_ID 42431`, so D1 no longer applies;
    - zone 4242, with the genesis artifact `0xb31abb66…4bbf` pinning our genesis and portal;
    - vkey `0x00ab5a9e…5c7b` (new guest, ELF sha256 `6f6fb01e…d6e4`).
  - One sequencer, run by us.
- **Three batches**, each Groth16-proven by our guest and settled with a direct EIP-2935 anchor:

  | zone blocks | content | cycles | Groth16 | anchor age at `submitBatch` / 8,190 | `submitBatch` tx |
  |---|---|---:|---:|---:|---|
  | 1–51 | setup replay + encrypted deposit (1.0 pathUSD) | 123,831,587 | 1,881 s | 2,895 | `0x8f08d982…472b` |
  | 52–55 | zone-side `approve(ZoneOutbox)` | 26,251,576 | 664 s | 3,928 | `0x334ab624…84ce` |
  | 56–61 | `requestWithdrawal(0.5 pathUSD)` | 31,925,548 | 813 s | 5,133 | `0x4062f79c…83b4` |

  - A call trace (`debug_traceTransaction`, callTracer) of each `submitBatch` shows `OwnZonePortal` → STATICCALL `SwornZoneVerifier.verify` → STATICCALL the SP1 gateway `0x2c77…9B18`, with no errors.
- **Payout:** `processWithdrawals` tx `0xfc3118412ed0c4d6a5b0a55e61a567b280861461551f927fc5fc650c541be1f1` (block 38,411,550) emitted `WithdrawalProcessed(to user, token pathUSD, amount 500000, callbackSuccess true)`.
  - The user's L1 pathUSD went from 999,998,999,480 to 999,999,499,480, exactly +500,000.
  - The withdrawal could be paid only after the batch containing it was proven and settled.
- **Time:** 58.5 minutes from the anchor block (09:53:57 UTC) to the payout block (10:52:29 UTC).
- **Read-only checks after the run:**
  - the verifier's immutables match;
  - `no-owner --zone-verifier` passes on the deployed code (2,993 bytes, STATICCALL ×1, forbidden opcodes 0);
  - the portal reads `zoneId` 4242, `verifier` = the address above, `withdrawalBatchIndex` 3, `zoneHeight` 61.
- **Different from the dress rehearsals:**
  - The zone-side `approve` and the `requestWithdrawal` fell into separate batches, so the demo needed 3 proofs, not 2. The cause of the boundary after block 55 was not investigated.
  - The watcher's default `MAX_PROOFS=2` would have stopped before the withdrawal batch. During the run, a second watcher with `MAX_PROOFS=3` was started as soon as the first one exited. Nothing else was touched. The default is now 3.
  - From 10:43 UTC the node logged `block timestamp … is in the future` / `Invalid payload` for blocks far past the demo (zone block ≥ 4,577, under 1 s of skew). Block production continued, and the batches it had already prepared were not affected.
- **What this shows, and its limits (FEASIBILITY.md C5, risk 6):**
  - On our own Zone, the portal settles a batch, and so lets a withdrawal be paid, only after Sworn's proof passes.
  - It is our Zone and our portal, with one operator. It is not a Tempo-created Zone, and Tempo's own Zones are unchanged.
  - The single sequencer key also decrypts deposits.
  - Withdrawals are ZK-gated, not censorship-resistant: the operator must prove and process them.
  - Callback withdrawals bounce, because the messenger checks the factory.
  - The zone-side fork schedule is pinned at T13 while Moderato is still at T11.
  - Testnet, unaudited.
