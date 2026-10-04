#!/usr/bin/env bash
# Spec 003 AC-Z5: deploy SwornZoneVerifier on Tempo Moderato.
#
#   scripts/deploy-zone-verifier.sh                               PRINT ONLY: reads the chain (chain id,
#                                                                 SP1 verifier hash, eth_estimateGas) and
#                                                                 prints exactly what would be sent
#   scripts/with-keys.sh scripts/deploy-zone-verifier.sh --send   operator only: deploys
#
# The key is read from SWORN_DEPLOYER_KEY in the environment (exported by scripts/with-keys.sh) by the
# forge script; it is never a flag and never printed. Without --send nothing is broadcast.
#
# Constructor arguments (env overrides in brackets):
#   SP1_VERIFIER                  [ZONE_SP1_VERIFIER]  0x2c77329747b7C8B293514A6129404D4cefDd9B18 (v6.1.0, Moderato)
#   ZONE_VKEY                     [ZONE_VKEY]          .vkey of contracts/test/vectors/zone-hardfork-placeholder.json
#                                                      (the program vkey does not depend on the verifier address;
#                                                      it MUST equal the vkey zone-prove.sh prints for the same ELF)
#   PARENT_CHAIN_ID               [ZONE_PARENT_CHAIN_ID] 1337 (D1)
#   PINNED_ZONE_ID                [ZONE_ID]            1
#   PINNED_GENESIS_ARTIFACT_HASH  keccak256 of spikes/zone-spf/genesis/hardfork_t13_recovery.genesis.json (D3)
#
# After --send: run scripts/zone-prove.sh <address>, then scripts/zone-attest.sh <address> <fixture>.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/contracts"
SEND=
case "${1:-}" in
  --send) SEND=1 ;;
  "") ;;
  -h|--help) sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "unknown argument $1 (try --help)"; exit 2 ;;
esac
RPC="${RPC:-https://rpc.moderato.tempo.xyz}"
CAP=30000000   # TEMPO_T1_TX_GAS_LIMIT_CAP
genesis_file="$root/spikes/zone-spf/genesis/hardfork_t13_recovery.genesis.json"
placeholder="$root/contracts/test/vectors/zone-hardfork-placeholder.json"

export ZONE_SP1_VERIFIER="${ZONE_SP1_VERIFIER:-0x2c77329747b7C8B293514A6129404D4cefDd9B18}"
export ZONE_VKEY="${ZONE_VKEY:-$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["vkey"])' "$placeholder")}"
export ZONE_PARENT_CHAIN_ID="${ZONE_PARENT_CHAIN_ID:-1337}"
export ZONE_ID="${ZONE_ID:-1}"
export ZONE_GENESIS_ARTIFACT_HASH
ZONE_GENESIS_ARTIFACT_HASH=$(cast keccak "0x$(xxd -p "$genesis_file" | tr -d '\n')")
fx_genesis=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["genesisArtifactHash"])' "$placeholder")
[ "$ZONE_GENESIS_ARTIFACT_HASH" = "$fx_genesis" ] || { echo "genesis artifact hash $ZONE_GENESIS_ARTIFACT_HASH != fixture's $fx_genesis"; exit 1; }

[ "$(cast chain-id --rpc-url "$RPC")" = "42431" ] || { echo "RPC is not Moderato (42431)"; exit 1; }
vh=$(cast call --rpc-url "$RPC" "$ZONE_SP1_VERIFIER" "VERIFIER_HASH()(bytes32)")
[ "$vh" = "0x4388a21c687fdd5f218d7e3d13190cac4c5355818d3605fd5fb811df468ee696" ] || { echo "SP1 verifier at $ZONE_SP1_VERIFIER is not v6.1.0 Groth16 ($vh)"; exit 1; }
scripts/no-owner.sh --zone-verifier
forge build --quiet

ctor=$(cast abi-encode "constructor(address,bytes32,uint256,uint32,bytes32)" \
  "$ZONE_SP1_VERIFIER" "$ZONE_VKEY" "$ZONE_PARENT_CHAIN_ID" "$ZONE_ID" "$ZONE_GENESIS_ARTIFACT_HASH")
init="$(forge inspect SwornZoneVerifier bytecode)${ctor#0x}"
chain_est=$(cast estimate --rpc-url "$RPC" --create "$init")
local_est=$(forge script script/ZoneVerifier.s.sol:DeployZoneVerifier --sig 'localCreationGas()' 2>/dev/null | awk '/localCreationGas/{print $2}')
[ -n "$local_est" ] && [ "$chain_est" -gt 0 ] || { echo "could not estimate gas"; exit 1; }
target=$(( chain_est * 3 / 2 )); [ "$target" -le "$CAP" ] || target=$CAP
mult=$(( (target * 100 + local_est - 1) / local_est ))
offered=$(( local_est * mult / 100 ))

cat <<EOF
=== SwornZoneVerifier deployment (chain 42431, $RPC) ===
constructor(
  sp1Verifier               $ZONE_SP1_VERIFIER   (VERIFIER_HASH $vh)
  zoneVkey                  $ZONE_VKEY
  parentChainId             $ZONE_PARENT_CHAIN_ID
  pinnedZoneId              $ZONE_ID
  pinnedGenesisArtifactHash $ZONE_GENESIS_ARTIFACT_HASH
)
constructor args (abi)      $ctor
init code                   $(( (${#init} - 2) / 2 )) bytes, keccak256 $(cast keccak "$init")
gas                         chain eth_estimateGas=$chain_est  forge-local=$local_est  -> -g $mult (~$offered offered, cap $CAP)
EOF
if [ -z "$SEND" ]; then echo "PRINT ONLY: nothing sent. To deploy: scripts/with-keys.sh scripts/deploy-zone-verifier.sh --send"; exit 0; fi

: "${SWORN_DEPLOYER_KEY:?--send needs SWORN_DEPLOYER_KEY in the environment (run under scripts/with-keys.sh)}"
[ $(( chain_est * 110 / 100 )) -le "$CAP" ] || { echo "chain estimate within 10% of the cap; refusing"; exit 1; }
[ $(( offered * 100 )) -ge $(( chain_est * 115 )) ] || { echo "offered limit within 15% of chain estimate; refusing"; exit 1; }
forge script script/ZoneVerifier.s.sol:DeployZoneVerifier --rpc-url "$RPC" -g "$mult" --slow --broadcast
echo "Next: read the receipt; scripts/no-owner.sh --zone-verifier --code \$(cast code <address> --rpc-url $RPC);"
echo "      record address/codehash/constructor args in deployments/moderato.json under zoneVerifier;"
echo "      scripts/zone-prove.sh <address>; scripts/zone-attest.sh <address> contracts/test/vectors/zone-hardfork.json"
