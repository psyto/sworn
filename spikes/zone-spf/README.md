# zone-spf in SP1

Tempo Zones' own batch verifier, `zone_spf::prove_zone_batch` (tempoxyz/zones `ac49071f`), runs here inside an
SP1 zkVM guest. The guest commits the digest from [spec 003](../../docs/specs/003-zone-verifier.md), and
`contracts/src/SwornZoneVerifier.sol` checks it on Tempo.

The batches come from Tempo's zones integration tests, on a dev chain (1337), not from Moderato. The
`zones-witness-dump.patch` makes those tests write their witness to disk.

| path | |
|---|---|
| `patches/` | five patches: zones (zkVM build, witness dump), tempo `346c22eb` (zkVM build), c-kzg 2.1.8, reth-primitives-traits 0.6.0 |
| `fetch.sh` | clones zones/tempo at the pinned commits, downloads the two crates, applies the patches (none of these trees is committed) |
| `build-guest.sh` | builds the guest; needs a RISC-V C compiler for the C deps (`./riscv`, not fetched) |
| `attest/` | shared digest code (`sol!` struct, type string, input framing), used by both the guest and the host |
| `guest/`, `host/` | SP1 guest; native host (`input`, `mutations`) |
| `genesis/`, `witness/` | genesis artifacts (the pinned one is `hardfork_t13_recovery.genesis.json`) and batch witnesses with their native outputs |
| `z-logs/` | spec 003 run logs; the `*.log` at top level are from the first spike (before the digest) |
| `out-groth16-hardfork.json` | the first spike's proof (JSON output, no digest), kept for the record |

The real proof for the deployed verifier is produced by `scripts/zone-prove.sh <address>` (about 15 min, about 22 GB RAM).
