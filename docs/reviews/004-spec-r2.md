## Verified

- §1 is right: a sequencer submits `verifierConfig`; the quorum signs its hash, so selection is per-batch by the quorum, not one sequencer alone. [ZonePortal.sol:1313-1327, 1482-1522](spikes/zone-spf/zones/crates/contracts/src/runtime/tempo/ZonePortal.sol:1313)

- Settlement and payout are separate, but B is not a small change. Settlement updates state and enqueues a withdrawal slot; only sequencers later dequeue/payout FIFO. [ZonePortal.sol:1412-1455](spikes/zone-spf/zones/crates/contracts/src/runtime/tempo/ZonePortal.sol:1412) [ZonePortal.sol:1090-1125](spikes/zone-spf/zones/crates/contracts/src/runtime/tempo/ZonePortal.sol:1090) It requires persistent batch/slot state, a new verifier path, changes to every transfer path, freeze/recovery semantics, and migration.

- R1’s digest/binding blocker is addressed at proposal level: r2 specifies immutable per-batch commitments, optional slot mapping, and exact ordered-range commitment checks. [004-tee-plus-zk.md:47-82](docs/specs/004-tee-plus-zk.md:47) It correctly says this is a new statement, not spec 003’s verifier-address/config-bound digest. [004-tee-plus-zk.md:64-71](docs/specs/004-tee-plus-zk.md:64) [003-zone-verifier.md:53-83](docs/specs/003-zone-verifier.md:53)

- The framing is honest: all B-specific pieces are explicitly “not built,” production rates are unmeasured, and migration is undesigned. [004-tee-plus-zk.md:134-145](docs/specs/004-tee-plus-zk.md:134) “Not deployable by Sworn alone” is supported by the owner-gated factory. [004-tee-plus-zk.md:5-8](docs/specs/004-tee-plus-zk.md:5) [moderato-zone-feasibility-20261004.md:167-176](docs/research/moderato-zone-feasibility-20261004.md:167)

## Inferred findings

- **BLOCKER — G1 still depends on an unspecified, unenforced TEE-policy invariant.** B says store a commitment after Nitro/`0x01`, but deliberately omits verifier/config from that commitment and leaves accepted-config policy as an open, unbuilt Tempo decision. [004-tee-plus-zk.md:49-61](docs/specs/004-tee-plus-zk.md:49) [004-tee-plus-zk.md:142-154](docs/specs/004-tee-plus-zk.md:142) Today the portal accepts whatever its verifier returns, while Moderato’s verifier returns true for arbitrary config/proof. [ZonePortal.sol:1412-1428](spikes/zone-spf/zones/crates/contracts/src/runtime/tempo/ZonePortal.sol:1412) [moderato-zone-feasibility-20261004.md:87-97](docs/research/moderato-zone-feasibility-20261004.md:87) Require an immutable `teeFinal`/approved-config fact at settlement, enforced before commitment creation—not merely “verify passed.”

- **BLOCKER — G4 is a desired future property, not a credible mechanism yet.** A normal proof cannot simply prove that execution “fails”: the invalidity guest must be a total, deterministic statement that binds the exact predecessor, batch inputs, and divergent result, and still produces an accepting proof on mismatch. r2 admits this hardest third statement is unbuilt. [004-tee-plus-zk.md:92-103](docs/specs/004-tee-plus-zk.md:92) Until specified, tested, and paired with unfreeze/recovery rules, G4 is not achieved.

- **MAJOR — G2 is honestly weakened, but withdrawals remain censorable indefinitely.** A sequencer can settle batches and never provide witnesses/proofs; an outsider cannot reconstruct the required blocks, state witness, or genesis. [004-tee-plus-zk.md:35-39](docs/specs/004-tee-plus-zk.md:35) [moderato-zone-feasibility-20261004.md:121-160](docs/research/moderato-zone-feasibility-20261004.md:121) FIFO makes one withheld head proof block later payout. This meets r2’s narrowly stated “settlement does not wait” goal, not practical withdrawal liveness.

- **MAJOR — rollout against actual Moderato is under-described.** Current Moderato is pre-T13, whereas the proposed/spec-003 interface is T13; the existing verifier cannot sit behind its portal even with factory permission. [moderato-zone-feasibility-20261004.md:243-257](docs/research/moderato-zone-feasibility-20261004.md:243) This reinforces that B is a protocol migration, not a portal patch.

- **MINOR — measurements are correctly updated but are only a proxy.** The cited 25,536,122 cycles and 701.1 seconds are real for spec 003’s new-tag guest. [003-zone-verifier.md:297-308](docs/specs/003-zone-verifier.md:297) They do not measure the unbuilt B commitment, range, or invalidity guests; r2 mostly discloses this.

The single most important missing piece is a Tempo-owned, end-to-end portal state machine specifying the immutable TEE-policy marker, exact finality/invalidity public statements, all payout/refund mappings, migration, and recovery authority.

VERDICT: CHANGES