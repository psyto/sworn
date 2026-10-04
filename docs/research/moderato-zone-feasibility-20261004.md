# Can we prove a real Moderato Zone batch? (feasibility, 2026-10-04)

Read-only investigation. No transactions were sent, no Zone was created, no key was used, nothing was committed.
Sources: zones `ac49071f` and tempo `346c22eb` (both under `spikes/zone-spf/`), upstream zones `fc26c2f8` and tempo `61c979a5`
(fetched read-only into a scratch dir to compare), the Moderato public RPC (`https://rpc.moderato.tempo.xyz`, head about 38,073,9xx
during the run), and tempo.xyz docs.

Labels: **[V]** = verified here (file:line, RPC result or page text). **[I]** = inferred, not tested.

## Short answer

- **Zones do exist on Moderato now**, but every one of them is operated by a single account that also controls zone creation, and
  every batch on Moderato is settled with **no proof** against a stub verifier that returns `true` for any input.
- **An outsider cannot build a `BatchWitness` for someone else's Zone.** The Zone RPC needs an operator-issued credential, and even
  with one the redacted RPC hides transactions and disables `eth_getProof`/`debug_*`.
- **We cannot create our own Zone on Moderato without Tempo.** `createZone` is owner-only, and the owner is a 1-of-1 Safe whose
  only signer is the same account that runs all three zones.
- **Recommendation: keep the dev-chain batch (option c) for 2026-10-12, and fix two things in the text.** Option (a) depends on
  Tempo granting factory access, which is not available on our timeline. Option (b) (a local fork of Moderato) costs 2–3 days
  for a small gain in credibility, and it brings its own caveat. Details and ranking are in §4.
- **New finding to act on:** upstream zones now defines `verifierConfig = 0x02` as **NoProof**. Moderato's zone 3 has been
  submitting `0x02` with an empty proof since 2026-09-30. Our `SwornZoneVerifier` uses `0x02` to mean "ZK". The digest cannot be
  confused with anything else (different struct name), but the public text clashes with Tempo's own meaning (§6).

---

## 1. Do Zones exist on Moderato?

### Addresses [V]

| what | address | source |
|---|---|---|
| ZoneFactory (native precompile, TIP-1091) | `0x5AF2000000000000000000000000000000000000` | `tempo/crates/contracts/src/precompiles/zone_factory.rs:16`; `zones/xtask/src/zone_utils.rs:47-53` (`MODERATO_ZONE_FACTORY`) |
| Protocol verifier (shared by all zones) | `0x5A56000000000000000000000000000000000000` | `zone_factory.rs:26` |
| Portal impl / Messenger | `0x5AD1…` / `0x5A4D…` | `zone_factory.rs:21,29` |
| Portal of zone *n* | `0x5AD0` prefix + `u64(n)`, e.g. `0x5ad0…0003` | `tempo/crates/precompiles/src/zone_factory/mod.rs:338-343` |

The factory is registered only from T10 (`tempo/crates/precompiles/src/lib.rs:254`). Moderato T10 was 2026-08-20 14:00 UTC
(`tempo/crates/hardfork/src/constants.rs:296`), which is block 31,703,738 (binary search on timestamps).

### Factory state [V] (`cast call` on Moderato)

- `owner()` = `0x5FEDB95CDB5C512Fe93baf4D4F8c1b77f7767401` and `nextZoneId()` = **4**. Raw slot 0 is
  `0x…5fedb95c…7401 00000004`, matching the packing in `zone_factory/mod.rs:42-47`.
- The owner is a **Safe 1.4.1 proxy** (`VERSION()`, `masterCopy` selector `a619486e` in the 172-byte runtime) with
  `getOwners()` = `[0xCaa85faad9421061efD6E4219b83ab07Bc73CabC]` and `getThreshold()` = 1.
- `OwnershipTransferred(0xaF571FD4…7A14 → 0x5FEDB95C…7401)` at block 32,430,914 (2026-08-25), tx `0x7abc806c…ef5e`.
  `0xaF571FD4…` is `INITIAL_FACTORY_OWNER` installed by T10 (`zone_factory.rs:19`).

### Zones [V] (`zones(uint32)` plus `ZoneCreated` logs from block 31,703,738 to head)

| zone | portal | created | ZoneCreated tx | admin | sequencers / threshold | verifier | rpcUrl | access / gateway |
|---|---|---|---|---|---|---|---|---|
| 1 | `0x5ad0…0001` | blk 31,704,623 (08-20 14:09) | `0x7e50e6a4…c24a` | `0xCaa85…CabC` | `0xFdD1…f6c2`, `0x7483…CB0D`, `0xDBff…C8B8` / 2-of-3 | `0x5a56…` | `""` | closed / enforced |
| 2 | `0x5Ad0…0002` | blk 31,707,947 | `0x08d6c186…8eba` | same | same | `0x5a56…` | `""` | closed / enforced |
| 3 | `0x5Ad0…0003` | blk 31,727,938 (08-20 18:06) | `0x81dd045e…4852` | same | same | `0x5a56…` | `""` | closed / enforced |

All three were created by `0xaF571FD4…` (the then-owner). The zones admin `0xCaa85…` is the only signer of the current
owner Safe, so **one party creates and runs every native Zone on Moderato**. The docs do not say who that party is. That it is
Tempo itself is [I].

### Batches [V]

Moderato is still pre-T13, so its portals emit the legacy event
`BatchSubmitted(uint64,uint256,bytes32,bytes32,bytes32,uint64)` (topic `0x5a66941d…`). The ABI at our pin (`IZone.sol:431`)
has one more field, so its topic `0x2ad9ed3f…` matches nothing on chain.

| portal | batches | first block | last block |
|---|---:|---|---|
| zone 1 | 17 | 31,706,559 | 31,706,663 |
| zone 2 | 82 | 31,708,283 | 31,717,787 |
| zone 3 | **69,238** | 31,728,330 | 38,073,897 (live) |

Zone 3 also has about 200k `DepositMade` and about 113k `WithdrawalProcessed` events (load or demo traffic).

The batch calldata is the legacy `submitBatch(uint64,uint64,(bytes32,bytes32),(bytes32,bytes32,uint64,uint64),bytes32,bytes,bytes,uint256,bytes[])`,
selector `0x78fb159b`. The T13 version is `0x4cd6c7c7`. Decoding 8 sampled zone 3 batches (first, middle, last and 5 random)
gives:

- `proof` = `0x` (**empty**) in every sample;
- `signatures` = 2 sequencer ECDSA signatures (2-of-3);
- `verifierConfig` = `0x` until block 37,572,491 (2026-09-30 14:47 UTC, tx `0x7d73a6ae…0ad2`, found by bisection), and `0x02` after.
  `0x02` is upstream's **NoProof** (§6).
- Example: tx `0xa132b6f7…bee4` (block 37,804,499), with `verifierConfig=0x02`, `proof=0x`, `nextZoneHeight=6,076,560`. The
  receipt has one `BatchSubmitted` from `0x5ad0…0003`.

### The verifier is a stub [V]

- Runtime at `0x5A56…` equals tempo `ZONE_VERIFIER_RUNTIME` (`tempo/crates/contracts/src/zones.rs:431`, selector `0x7106a43e`).
  This is the pre-T13 `verify(uint32,uint64,uint64,bytes32,uint64,(bytes32,bytes32),(bytes32,bytes32,uint64,uint64),bytes32,bytes,bytes)`.
- Its source is `zones/crates/contracts/src/runtime/tempo/Verifier.sol:11-38`: *"Stub implementation that always returns true for
  prototyping."*
- `eth_call` with arbitrary arguments (zoneId 99, `verifierConfig=0xdead`, `proof=0xbeef`) returns **`true`**.
- A portal's verifier is set only at initialization, and the factory always passes `ZONE_VERIFIER_ADDRESS`
  (`zone_factory/mod.rs:172`, `portal.rs:150`, `ZonePortal.sol:269`). There is no setter.

So yes: **batches are submitted with the stub verifier, and only the sequencer signatures carry any weight.**

### The docs' demo zones are a separate, legacy deployment [V]

- The docs (`tempo.xyz/developers/docs/guide/private-zones/connect-to-a-zone`) list Zone A (id 6, chain `4217000006`, portal
  `0x7069DeC4…9B23`, `https://rpc-zone-a.testnet.tempo.xyz`) and Zone B (id 7, portal `0x3F529630…D6Ac`).
- The docs say: *"These demos use an earlier testnet deployment… Its interfaces and chain IDs differ from the current Zone
  protocol."*
- On Moderato these are ordinary Solidity contracts (about 10 KB of code), with `verifier()` = `0xe42b7fC1…92b1`.
  `withdrawalBatchIndex` is 209,514 and 212,471, so they are live.
- Their batches (selector `0x11473119`, legacy 7-argument `submitBatch`) carry an empty `verifierConfig` and an empty `proof`
  (tx `0x3d07d4f7…8419`).
- Their chain ID (`4217000006`) is not `zone_chain_id(42431, 6)` = `1424310006` (`zones/crates/primitives/src/constants.rs:122`),
  so `zone_spf` at `ac49071f` cannot accept them anyway.

---

## 2. Can a third party build a `BatchWitness` for a real Moderato Zone batch?

`BatchWitness` = `public_inputs` + `parent_header` + `zone_blocks` + `zone_state_witness` + `tempo_state_witness`
(`zones/crates/sequencer/src/prover.rs:526-538`). The guest also needs the Zone genesis JSON.

| component | where it comes from | outsider? |
|---|---|---|
| `public_inputs` (zone id, tempo block, anchor, withdrawal index) | the `submitBatch` calldata, `BatchSubmitted` and Moderato headers | **yes** [V] |
| `zone_blocks` (full transactions, system inputs, decrypted deposits, finalize data) | the Zone node | **no** [V]: see below |
| `parent_header` (Zone) | Zone RPC headers | operator credential needed [V] |
| `zone_state_witness` (trie nodes for every read) | the node's in-process debug API (`prover.rs:72`, `zone_witnesses` at `prover.rs:958`) | **no**: not exposed on the redacted RPC [V] |
| `tempo_state_witness` (initial header plus trie nodes) | the Zone node calls **`eth_getMultiProof`** on its L1 (`zones/crates/node/src/rpc.rs:398-402`) | public Moderato RPC rejects it [V]: see below |
| Zone genesis | `generated/<name>/genesis.json` on the operator's machine. Not on chain; `rpcUrl` is `""` for all 3 zones | **no** [V] (not published) |

Zone RPC evidence [V]:

- `https://rpc-zone-a.testnet.tempo.xyz` and `…zone-b…` both return **HTTP 401** to `eth_chainId` with no credentials.
- The docs require two headers: an operator-issued `Authorization` (`ZONE_RPC_AUTHORIZATION`) and a user-signed
  `X-Authorization-Token`, *"required even for chain metadata reads"*.
- The RPC reference (`tempo.xyz/developers/docs/protocol/zones/rpc`) says:
  - `eth_getBlockByNumber` with `full=true` returns `-32005`;
  - block `transactions` is *"always an empty array"* and `transactionsRoot` is zeroed;
  - `eth_getProof`, raw storage/code reads, `debug_*`, `admin_*` and `txpool_*` return `-32601` *"for all users including
    sequencers"*;
  - operators use a separate admin endpoint.
- Deposits are encrypted to the sequencer key (zones README, "Encrypted deposits"), so `TempoImport::Full.deposits` cannot be
  rebuilt from L1 logs either.
- The detached "shadow prover" that needs no sequencer key is an **`rpc-follower` in the zone's P2P set**
  (`zones/crates/node/src/cli.rs:263-305`, `node.rs:242`). That set is static and operator-configured.

Tempo-side evidence [V]:

- `eth_getProof` on the public RPC works at head−240 and fails at head−256: *"distance to target block exceeds maximum proof
  window"*. So the window is about 250 blocks, about 2 minutes.
- `eth_getMultiProof` (the method the zone node actually uses) returns **HTTP 413 `request too large`** even for a single
  slot, over both HTTPS and WSS.
- `debug_executionWitness` returns 403 *"method not allowed"*.

**Judgement:**

- **An outsider on someone else's Zone: not possible.** Zone transactions, the state witness and the genesis are all private by
  design.
- **The operator (the one account in §1): possible.** The node already builds the exact `BatchWitness`. Our
  `zones-witness-dump.patch` hooks precisely there (`prover.rs:564-579`, `ZONE_SPF_DUMP_DIR`), and the in-process prover runs
  when `--sequencer.enable-prover` is set (`cli.rs:280-305`).
- **One extra blocker even for an operator who uses only the public Moderato RPC:** `eth_getMultiProof` is rejected (413), so
  they would need their own Moderato node, or a patch that falls back to per-account `eth_getProof` inside the 250-block window
  [I].

---

## 3. What would deploying our own Zone on Moderato take?

**Who may create a Zone [V]:**

- `create_zone` starts with `if msg_sender != self.owner()? { return Err(not_owner) }` (`tempo/crates/precompiles/src/zone_factory/mod.rs:110-112`).
- Ownership moves only through `transferOwnership`, by the current owner (`mod.rs:86-99`).
- On Moderato the owner is the 1-of-1 Safe above. **So our keys cannot create a Zone.**
- `zones/xtask/src/create_zone.rs:87-91` signs with `ZONE_FACTORY_OWNER_KEY`. `just deploy-zone` passes the freshly generated
  sequencer key as that owner key (`Justfile:894`), so on Moderato it would revert with `NotOwner`. The README's "deploy a Zone
  on Moderato" quick start predates the owner gate.
- The local `dev` command says the same: *"The configured dev key must own the native ZoneFactory"* (`docs/ZONES.md`;
  `crates/node/src/dev.rs:99-106`).

**Request process:**

- The docs pages we read give no self-serve path or form for creating a Zone. For using someone else's Zone they say:
  *"get the endpoint, access credentials, and supported SDK version from its operator."*
- The only contact point is `https://tempo.xyz/contact`. Whether Tempo creates Zones for third parties on request is unknown [I].

**If Tempo did create a Zone for us** (our sequencer and admin keys as parameters, factory owner signs), the work would be [I]:

1. Build `tempo-zone` at `ac49071f` with our patches: about 30–60 min.
2. Run a Tempo Moderato follower node (its own sync time is unknown, maybe days without a snapshot), or patch the multiproof call
   to use per-account `eth_getProof` (about half a day).
3. Fund keys with `tempo_fundAddress` (founder keys), start the node with `--sequencer.enable-prover` and `ZONE_SPF_DUMP_DIR`,
   and make one deposit so the batch is not trivial. The node writes `zone<id>-chain<1424310000+id>-blocks…case.json`.
4. Native host check, then Groth16 (about 15 min, about 20 GB). Deploy a new `SwornZoneVerifier`, then `attest` (founder key).

That is **2–3 days after Tempo grants access**, plus the T12 problem below.

**The hardfork problem (affects a and b) [V]:**

- At our tempo pin `346c22eb`, Moderato's T12 and T13 are `None` (`tempo/crates/hardfork/src/lib.rs:449-450`;
  `constants.rs:295-300` stops at T11). Upstream schedules `MODERATO_T12_TIMESTAMP = 1_791_468_000` (2026-10-08 14:00 UTC,
  tempo commit `20b8decdd`, 2026-09-30). T13 is still unscheduled on Moderato upstream.
- A Zone's fork schedule is inherited from its parent's built-in spec unless the Zone genesis overrides it
  (`zones/crates/chainspec/src/lib.rs:57-77,122-145`, `tempo_chain_spec_for_l1` at `:295`).
- So our pinned node and guest treat a Moderato Zone as never reaching T12, while Tempo's current nodes activate T12 on 10-08.
  T12 changes execution: expiring nonces, trailing ABI bytes, TIP-1006 `burnAt`, DEX quoting (`git log 346c22eb..9de35499`). A batch
  produced **before 10-08 14:00 UTC** avoids this. After that, the pin would need bumping to zones `fc26c2f8` / tempo
  `9de35499`: 102 and 203 commits, with the guest, patches and SP1 build redone (1–2 days, risky).
- `TempoHeader` itself did not change between the pins (`git diff 346c22eb 9de35499 -- crates/primitives/src/header.rs` is empty).

**A second untested risk [I]:**

- A Moderato Zone today runs **pre-T13** rules (legacy settlement ABI, `SettlementAbi::Legacy`, `zones/crates/sequencer/src/settlement.rs:1205-1220`).
- All 4 batches we have proven are T13-active. In every case the block timestamps are at or after `t13Time`, and the three
  `spf_*` cases have `t13Time = 0`.
- `zone_spf`'s doc comment says *"The prover launches with TIP-1096"* (`zones/crates/spf/src/lib.rs:33-36`, TIP-1096 = T13).
- Whether `prove_zone_batch` at `ac49071f` accepts a pre-T13 Moderato batch is therefore **untested**. Forcing `t13Time` in our
  own Zone genesis would put the Zone ahead of its pre-T13 L1 portal, and that interaction is untested too.

---

## 4. Options, ranked

| | option | credibility gain | effort (of ~4–5 days) | needs founder keys? | needs Tempo? | what it removes |
|---|---|---|---|---|---|---|
| **c** | **Keep the dev-chain batch** (current) | — | 0.5 day (text fixes in §6) | no | no | nothing; the caveat stays exactly as in spec 003 §7 |
| b | Local Zone on a **local Tempo-mode Anvil fork of Moderato** (impersonate the owner Safe locally with `anvil_impersonateAccount`, `createZone`, `tempo-zone dev`) | low–medium: `parentChainId = 42431`, the real Moderato chainspec/genesis and fork-point state | 2–3 days, high uncertainty | only for the final deploy and `attest` | no | removes "parent chain is a dev chain (1337)"; does **not** remove "not a real Moderato batch". The anchors are locally mined blocks under Moderato's chain id, a new caveat that must be disclosed |
| a | **A real Zone on Moderato, as operator** | high: a batch that actually settled on Moderato (stub verifier, NoProof), re-proved by our guest and attested next to it | 2–3 days **after** Tempo creates the Zone, plus a follower node or multiproof patch, plus the T12 deadline (10-08 14:00 UTC) or a pin bump | yes (fund, sequencer, deploy, attest) | **yes: the factory owner must call `createZone`** | removes "came from integration tests / dev chain" and D1 (`PARENT_CHAIN_ID` becomes 42431 = `block.chainid`) |
| a′ | Ask the zone 3 operator for one `VerifyRequest` (witness) plus genesis | high | unknown; their node runs upstream (newer than our pin), so our guest would likely need rebasing (1–2 days) | deploy and attest only | yes | same as (a) |

Notes on (b) [I unless marked]:

- Local Anvil is 1.7.1 [V]. The zones README requires Foundry ≥ 1.8 for canonical Tempo header hashes, so an upgrade comes first.
- Whether `anvil --network tempo --fork-url <Moderato>` supports the native ZoneFactory precompile state, and keeps hashing
  locally mined blocks canonically, is untested.
- (b) "without factory permission" works only because impersonation is local; it is not possible on the real Moderato [V: owner gate].
- A Zone anchored to the real Moderato with an un-created portal (an unused zone id) is not viable. The tooling locates the
  deployment from `ZoneCreated` (`xtask/src/zone_utils.rs:59-70`), and the portal would be empty [I].

**Recommendation:** (c) for 10-12. Contact Tempo about (a)/(a′) only as post-deadline follow-up; do not plan days of work around
it. Skip (b): it costs most of the remaining time to move one caveat (1337 → 42431) while adding another (locally mined
"Moderato" anchors), and judges would still read it as "not a real Moderato batch".

---

## 5. What changes in the verifier for a Moderato Zone (if a or b ever happens)

- **New deployment.** The constructor immutables are `PARENT_CHAIN_ID = 42431` (D1 then disappears, because it equals
  `block.chainid`), `PINNED_ZONE_ID = <our id>` and `PINNED_GENESIS_ARTIFACT_HASH = keccak256(<that Zone's genesis.json bytes>)`.
  The Zone chain id becomes `1424310000 + id`.
- **The guest itself needs no change** [V by reading]:
  - `ZoneChainSpec::from_genesis` resolves 42431 to the built-in `MODERATO` spec compiled into the guest
    (`attest/src/lib.rs:162`, `zones/crates/chainspec/src/lib.rs:57-63,295`), and Tempo headers are checked by hash.
  - The same ELF means the same vkey `0x006c1531…293d`, so `ZONE_VKEY` is reused.
  - The caveat is the fork schedule: the guest's `MODERATO` has no T12/T13 (§3). It is right only for Zone blocks before
    2026-10-08 14:00 UTC, or for a Zone genesis that pins its own `t12Time`/`t13Time` the same way the node did.
- **Interface mismatch to disclose.** Moderato's portals and verifier use the **pre-T13** `IVerifier` (10 arguments, no
  `nextZoneHeight` and no `TokenEnablementTransition`; selector `0x7106a43e`). `SwornZoneVerifier` implements the T13 interface
  from our pin (`IZone.sol:329-345`). That is fine for the stand-alone `attest`, but it means our contract could not sit behind a
  current Moderato portal even if the factory allowed choosing a verifier, which it does not (`zone_factory/mod.rs:172`).

## 6. Text fixes we should make regardless (cheap, for option c)

1. **`verifierConfig = 0x02` clashes with Tempo's meaning.**
   - Upstream commit `344ff785` (2026-10-01, `bin/prover/enclave/README.md`, "Verifier configurations") defines `0x01` = Nitro
     and **`0x02` = NoProof** (*"a temporary fallback that keeps settlement moving when no Nitro proof is available"*).
   - Moderato zone 3 has sent `0x02` with an empty proof since block 37,572,491 [V].
   - Our pin predates this: it has only `NITRO_VERIFIER_CONFIG_V1 = [1]` (`zones/crates/prover/src/protocol.rs:11`) and a test
     that rejects `0x02` (`prover.rs:1430`).
   - Security is unaffected: the digest's struct name differs, and `keccak256(0x02)` only enters our own digest. But "our ZK
     config is 0x02" now reads as "NoProof" to anyone at Tempo.
   - Options:
     - disclose the clash next to D1–D4;
     - or, on any redeploy, pick a tag Tempo does not use (e.g. a multi-byte tag such as `0x5a4b01`). That requires changing
       the guest's check (`spec 003 §4`), the contract and a new proof.
2. **Strengthen the comparison honestly.** "Every Zone batch on Moderato today settles with no proof against a stub verifier
   that returns true for any input (`0x5A56…`, `Verifier.sol:11-38`, `eth_call` evidence above); ours checks a ZK proof of the
   same batch function." This is verified, and it puts the dev-chain caveat in context without overclaiming.
3. Spec 003 §2 non-goals already say *"only Tempo's factory can choose a zone's verifier"*. Add that **zone creation** is also
   owner-gated on Moderato (1-of-1 Safe `0x5FEDB95C…7401`), which is why the batch is not from Moderato.

## Appendix: commands used (all read-only)

- `cast call 0x5aF2…0000 "owner()(address)" / "nextZoneId()(uint32)" / "zones(uint32)(…)"`
- `cast storage 0x5aF2…0000 0`
- Safe `getOwners()` / `getThreshold()` / `VERSION()`
- `eth_getLogs` in chunks of 100k blocks (the RPC limit) from block 31,703,738 to head, for the factory and the three portals.
  `ZoneCreated` topic `0x4f2c5b8e…`, legacy `BatchSubmitted` topic `0x5a66941d…`.
- `cast decode-calldata` on sampled `submitBatch` calls.
- `eth_call` of `0x5A56…` `verify(…)` with garbage inputs → `true`.
- `eth_getProof` at head−{0, 100, 200, 240, 250, 256, 300, 1000, …}.
- `eth_getMultiProof` over HTTPS and WSS → 413.
- `curl` to `rpc-zone-{a,b}.testnet.tempo.xyz` → 401.
- `git clone --filter=blob:none` of tempoxyz/zones and tempoxyz/tempo into a scratch dir, for log/diff only.
