#!/usr/bin/env bash
# Spec 003 AC-Z3: Groth16-prove `hardfork_t13_recovery` for a given SwornZoneVerifier address and write
# the Foundry fixture. Local only: sends nothing, needs no keys. ~12 min, ~18 GB RAM — never run two.
#
#   scripts/zone-prove.sh <verifier-address> [fixture-out] [destination-chain-id]
#     fixture-out           default contracts/test/vectors/zone-hardfork.json
#     destination-chain-id  default 42431 (Moderato)
#
# The verifier address is a guest input (spec §3), so the verifier must be deployed (or its address
# fixed) before proving. Logs go to spikes/zone-spf/z-logs/.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
spf="$root/spikes/zone-spf"
addr="${1:?usage: zone-prove.sh <verifier-address> [fixture-out] [destination-chain-id]}"
out="${2:-$root/contracts/test/vectors/zone-hardfork.json}"
chain="${3:-42431}"
[[ "$addr" =~ ^0x[0-9a-fA-F]{40}$ ]] || { echo "zone-prove: bad address $addr" >&2; exit 2; }
case_="hardfork_t13_recovery"
tag="$(echo "$addr" | tr 'A-F' 'a-f')-$chain"
work="$spf/zin/prove-$tag"
mkdir -p "$work" "$spf/z-logs"
log="$spf/z-logs/prove-$case_-$tag.log"

pgrep -f "spike-runner .* groth16" >/dev/null && { echo "zone-prove: a groth16 run is already in progress; refusing to start a second" >&2; exit 1; }

"$spf/build-guest.sh" >"$spf/z-logs/guest-build-prove-$tag.log" 2>&1
elf="$spf/guest/target/elf-compilation/riscv64im-succinct-zkvm-elf/release/zone-spf-guest"
(cd "$spf/host" && cargo build --release --quiet)
host="$spf/host/target/release/sworn-zone-host"
runner="$root/runner/target/release/spike-runner"
[ -x "$runner" ] || (cd "$root/runner" && cargo build --release --quiet)

"$host" input "$spf/witness/$case_.case.json" "$spf/genesis/$case_.genesis.json" "$addr" "$chain" \
  "$work/input.bin" "$work/summary.json" >"$work/native.log"
echo "native host public values: $(xxd -p -c 64 "$work/input.bin.expected")"

{ echo "elf sha256: $(shasum -a 256 "$elf" | cut -d' ' -f1)"; echo "verifier: $addr  destinationChainId: $chain"; } >"$log"
rc=0
( /usr/bin/time -l "$runner" "$elf" "$work/input.bin" groth16 "$work/groth16.json" ) >>"$log" 2>&1 || rc=$?
echo "EXIT $rc" >>"$log"
[ "$rc" -eq 0 ] || { echo "zone-prove: prover failed (exit $rc), see $log" >&2; exit 1; }

python3 - "$work/groth16.json" "$work/summary.json" "$out" "$spf/genesis/$case_.genesis.json" <<'EOF'
import json, sys, hashlib
proof, summ, out, genesis = sys.argv[1:5]
p = json.load(open(proof)); s = json.load(open(summ))
assert p["publicValues"] == s["publicValues"], "proof public values != native host"
fx = {
    "note": "spec 003 AC-Z3 fixture: real SP1 v6.1.0 Groth16 proof of hardfork_t13_recovery (Tempo zones ac49071f integration test, dev chain 1337). Produced by scripts/zone-prove.sh.",
    "case": "hardfork_t13_recovery",
    "genesisArtifact": "spikes/zone-spf/genesis/hardfork_t13_recovery.genesis.json",
    **s,
    "vkey": p["vkey"], "proof": p["proof"], "mode": p["mode"],
    "prove_wall_secs": p["prove_wall_secs"], "sp1_sdk": p["sp1_sdk"],
}
json.dump(fx, open(out, "w"), indent=1); open(out, "a").write("\n")
print("fixture written:", out)
EOF
grep -E "cycles|PROVE|proof pv match|verify ok|maximum resident" "$log" || true
