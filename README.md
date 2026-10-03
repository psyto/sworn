# Sworn

**Paid answers about Tempo state that can be proven false — and paid for when they are.**

An agent about to send a stablecoin payment on [Tempo](https://tempo.xyz) can buy a preflight answer
over [MPP](https://mpp.dev): *"if this TIP-20 transfer ran on the state after block N, what would the
receiver actually be credited?"* The server commits to the answer on-chain and reserves part of its
bond against it. If the answer is wrong, anyone can prove it — by re-running **Tempo's own EVM
(`tempo-revm`) inside an SP1 zero-knowledge proof** against Tempo's own block hash — and the reserved
amount goes to the client. No judge, no owner.

Why it matters on Tempo: MPP defines no refund or dispute protocol — *"Refund decisions are up to your
service"* ([mpp.dev](https://mpp.dev/advanced/refunds)). Sworn makes being wrong cost the server, not
the client.

> **Status: work in progress, built for Colosseum's Crypto World's Fair (Tempo track), 2026-10-03 →
> 2026-10-12.** Moderato testnet only. Unaudited. Nothing here is deployed yet.

## What is already measured

The kill gate (2026-10-03, this repository) — `tempo-revm` running inside an SP1 guest over Moderato
state that is MPT-verified against the block header:

| | |
|---|---|
| host vs. RPC `eth_call` | success + return bytes identical for `balanceOf`, two `transfer`s, one reverting `transfer` (fee-free simulation; gas not yet compared in code) |
| builds for SP1 | yes, with 3 patches to Tempo (`patches/tempo.patch`) |
| cycles (`transfer`) | 3,500,181 |
| local Groth16 proof | 352 s, verified (`out/prove_groth16_transfer_run2.log`) |

Tempo's own `tempoxyz/zones` `zone-spf` re-executes over a witness but is *"presently a normal Rust
verifier rather than a `no_std` proving guest"*; [`succinctlabs/rsp`](https://github.com/succinctlabs/rsp)
proves reth blocks in SP1 but not Tempo. Sworn is not claiming either of those as new — the new part is
**a reserved, slashable answer sold over MPP**.

## Layout

| path | |
|---|---|
| `docs/specs/001-bonded-answers.md` | the spec (r3; §R3 is normative) |
| `docs/reviews/` | independent adversarial reviews of each spec round, and the exact prompts sent (`payloads/`) |
| `core/` | header binding, MPT verification, `tempo-revm` execution (shared by host and guest) |
| `host/`, `runner/`, `program/` | native check, SP1 execute/prove, SP1 guest |
| `witness/` | witness fetcher and cached Moderato witnesses |
| `patches/tempo.patch`, `scripts/fetch-tempo.sh` | Tempo at `61c979a` + the patches that make it build for the zkVM |

```bash
scripts/fetch-tempo.sh      # clones tempoxyz/tempo at the pinned commit and applies the patches
```

## Lineage

Design discipline (no owner/admin/pause/upgrade, permissionless settlement, a build check that fails if
an owner appears) comes from the author's earlier [`psyto/reckn`](https://github.com/psyto/reckn). No
Reckn code is used.

## License

Apache-2.0. Vendored Tempo is Apache-2.0 (`tempoxyz/tempo`).
