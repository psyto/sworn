#!/usr/bin/env bash
# Spec 003 AC-Z3: Groth16-prove one zone batch for a given SwornZoneVerifier address and write
# the Foundry fixture. Local only: sends nothing, needs no keys. ~12 min, ~18 GB RAM — never run two.
#
#   [ZONE_CASE=<name>] scripts/zone-prove.sh <verifier-address> [fixture-out] [destination-chain-id]
#     ZONE_CASE             default hardfork_t13_recovery; proves spikes/zone-spf/witness/<name>.case.json with
#                           spikes/zone-spf/genesis/<name>.genesis.json (e.g. deposit_and_withdrawal_blocks5-6,
#                           the withdrawal batch, spec 003 "Withdrawal batch (feasibility)")
#     fixture-out           default contracts/test/vectors/zone-hardfork-sworn-sp1-groth16-v1.json for the
#                           default case, else contracts/test/vectors/zone-<name>-sworn-sp1-groth16-v1.json
#     destination-chain-id  default 42431 (Moderato)
#
# The verifier address is a guest input (spec §3), so the verifier must be deployed (or its address
# fixed) before proving. Logs go to spikes/zone-spf/z-logs/.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
spf="$root/spikes/zone-spf"
addr="${1:?usage: [ZONE_CASE=<name>] zone-prove.sh <verifier-address> [fixture-out] [destination-chain-id]}"
case_="${ZONE_CASE:-hardfork_t13_recovery}"
if [ "$case_" = hardfork_t13_recovery ]; then def_out="$root/contracts/test/vectors/zone-hardfork-sworn-sp1-groth16-v1.json"
else def_out="$root/contracts/test/vectors/zone-$case_-sworn-sp1-groth16-v1.json"; fi
out="${2:-$def_out}"
chain="${3:-42431}"
[[ "$addr" =~ ^0x[0-9a-fA-F]{40}$ ]] || { echo "zone-prove: bad address $addr" >&2; exit 2; }
for f in "$spf/witness/$case_.case.json" "$spf/genesis/$case_.genesis.json"; do
  [ -f "$f" ] || { echo "zone-prove: missing $f" >&2; exit 2; }
done
genesis_hash=$(cast keccak "0x$(xxd -p "$spf/genesis/$case_.genesis.json" | tr -d '\n')")
tag="$(echo "$addr" | tr 'A-F' 'a-f')-$chain"
work="$spf/zin/prove-$tag"
mkdir -p "$work" "$spf/z-logs"
log="$spf/z-logs/prove-$case_-$tag.log"

pgrep -f "spike-runner .* groth16" >/dev/null && { echo "zone-prove: a groth16 run is already in progress; refusing to start a second" >&2; exit 1; }

"$spf/build-guest.sh" >"$spf/z-logs/guest-build-prove-$tag.log" 2>&1
# Read-only pre-check (saves a wasted 15-min proof): if the verifier is already deployed on $RPC, its
# ZONE_VKEY and ZK_VERIFIER_CONFIG_V1 must match this ELF and the host's tag.
RPC="${RPC:-https://rpc.moderato.tempo.xyz}"
if [ "$(cast chain-id --rpc-url "$RPC" 2>/dev/null || true)" = "$chain" ] && [ -n "$(cast code --rpc-url "$RPC" "$addr" 2>/dev/null | sed 's/^0x//')" ]; then
  ev=$("$spf/elf-vkey.sh"); elf_vkey=$(awk '/^vkey /{print $2}' <<<"$ev")
  onchain=$(cast call --rpc-url "$RPC" "$addr" 'ZONE_VKEY()(bytes32)')
  [ "$onchain" = "$elf_vkey" ] || { echo "zone-prove: on-chain ZONE_VKEY $onchain != ELF vkey $elf_vkey ($ev)" >&2; exit 1; }
  cfg=$(cast call --rpc-url "$RPC" "$addr" 'ZK_VERIFIER_CONFIG_V1()(bytes)')
  [ "$cfg" = "$(cast from-utf8 sworn-sp1-groth16-v1)" ] || { echo "zone-prove: verifier at $addr accepts config $cfg, not sworn-sp1-groth16-v1" >&2; exit 1; }
  pg=$(cast call --rpc-url "$RPC" "$addr" 'PINNED_GENESIS_ARTIFACT_HASH()(bytes32)')
  [ "$pg" = "$genesis_hash" ] || { echo "zone-prove: verifier at $addr pins genesis $pg, but $case_.genesis.json is $genesis_hash" >&2; exit 1; }
  echo "pre-check ok: $addr on chain $chain has ZONE_VKEY = ELF vkey $elf_vkey, the sworn-sp1-groth16-v1 tag and genesis $genesis_hash ($case_)"
else
  echo "pre-check skipped: no code at $addr on $RPC (chain $chain)"
fi
elf="$spf/guest/target/elf-compilation/riscv64im-succinct-zkvm-elf/release/zone-spf-guest"
(cd "$spf/host" && cargo build --release --quiet)
host="$spf/host/target/release/sworn-zone-host"
runner="$root/runner/target/release/spike-runner"
[ -x "$runner" ] || (cd "$root/runner" && cargo build --release --quiet)

"$host" input "$spf/witness/$case_.case.json" "$spf/genesis/$case_.genesis.json" "$addr" "$chain" \
  "$work/input.bin" "$work/summary.json" >"$work/native.log"
echo "native host public values: $(xxd -p -c 64 "$work/input.bin.expected")"

{ echo "elf sha256: $(shasum -a 256 "$elf" | cut -d' ' -f1)"; echo "case: $case_  genesis keccak256: $genesis_hash"; echo "verifier: $addr  destinationChainId: $chain"; } >"$log"
rc=0
( /usr/bin/time -l "$runner" "$elf" "$work/input.bin" groth16 "$work/groth16.json" ) >>"$log" 2>&1 || rc=$?
echo "EXIT $rc" >>"$log"
[ "$rc" -eq 0 ] || { echo "zone-prove: prover failed (exit $rc), see $log" >&2; exit 1; }

python3 - "$work/groth16.json" "$work/summary.json" "$out" "$case_" <<'EOF'
import json, sys
proof, summ, out, case = sys.argv[1:5]
p = json.load(open(proof)); s = json.load(open(summ))
assert p["publicValues"] == s["publicValues"], "proof public values != native host"
fx = {
    "note": f"spec 003 fixture: real SP1 v6.1.0 Groth16 proof of {case} (Tempo zones ac49071f integration test, dev chain 1337). Produced by scripts/zone-prove.sh.",
    "case": case,
    "genesisArtifact": f"spikes/zone-spf/genesis/{case}.genesis.json",
    **s,
    "vkey": p["vkey"], "proof": p["proof"], "mode": p["mode"],
    "prove_wall_secs": p["prove_wall_secs"], "sp1_sdk": p["sp1_sdk"],
}
json.dump(fx, open(out, "w"), indent=1); open(out, "a").write("\n")
print("fixture written:", out)
EOF
grep -E "cycles|PROVE|proof pv match|verify ok|maximum resident" "$log" || true
