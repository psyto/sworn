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
#   ZONE_VKEY                     [ZONE_VKEY]          the vkey of the guest ELF as built now: build-guest.sh, then
#                                                      spikes/zone-spf/elf-vkey.sh (zkVM execute + setup, no proof).
#                                                      An explicit ZONE_VKEY is used as given, but the ELF's sha256
#                                                      and vkey are still printed, and a mismatch is refused unless
#                                                      ZONE_VKEY_FORCE=1. Prove later with the SAME ELF.
#   PARENT_CHAIN_ID               [ZONE_PARENT_CHAIN_ID] 1337 (D1)
#   PINNED_ZONE_ID                [ZONE_ID]            1
#   PINNED_GENESIS_ARTIFACT_HASH  [ZONE_GENESIS_FILE]  keccak256 of that file (D3); default
#                                                      spikes/zone-spf/genesis/hardfork_t13_recovery.genesis.json.
#                                                      The hash must equal the one recorded in spec 003 for that
#                                                      artifact (table below), or ZONE_GENESIS_EXPECT for any other file.
#   ZONE_CASE=<name> is shorthand for ZONE_GENESIS_FILE=spikes/zone-spf/genesis/<name>.genesis.json, e.g.
#   ZONE_CASE=deposit_and_withdrawal_blocks5-6 (the withdrawal batch; zone id 1, parent chain 1337 like the default).
#
# After --send: run ZONE_CASE=<name> scripts/zone-prove.sh <address>, then scripts/zone-attest.sh <address> <fixture>.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/contracts"
SEND=
case "${1:-}" in
  --send) SEND=1 ;;
  "") ;;
  -h|--help) sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "unknown argument $1 (try --help)"; exit 2 ;;
esac
RPC="${RPC:-https://rpc.moderato.tempo.xyz}"
CAP=30000000   # TEMPO_T1_TX_GAS_LIMIT_CAP
case_="${ZONE_CASE:-hardfork_t13_recovery}"
genesis_file="${ZONE_GENESIS_FILE:-$root/spikes/zone-spf/genesis/$case_.genesis.json}"
[ -f "$genesis_file" ] || { echo "no genesis artifact at $genesis_file"; exit 1; }

export ZONE_SP1_VERIFIER="${ZONE_SP1_VERIFIER:-0x2c77329747b7C8B293514A6129404D4cefDd9B18}"
"$root/spikes/zone-spf/build-guest.sh" >/dev/null 2>&1 || { echo "guest build failed (run spikes/zone-spf/build-guest.sh)"; exit 1; }
ev=$("$root/spikes/zone-spf/elf-vkey.sh")
elf_sha=$(awk '/^elf_sha256 /{print $2}' <<<"$ev"); elf_vkey=$(awk '/^vkey /{print $2}' <<<"$ev")
[[ "$elf_vkey" =~ ^0x[0-9a-f]{64}$ ]] || { echo "could not compute the ELF vkey"; exit 1; }
if [ -n "${ZONE_VKEY:-}" ] && [ "$(tr 'A-F' 'a-f' <<<"$ZONE_VKEY")" != "$elf_vkey" ] && [ "${ZONE_VKEY_FORCE:-}" != 1 ]; then
  echo "ZONE_VKEY $ZONE_VKEY != vkey of the built ELF $elf_vkey (sha256 $elf_sha); set ZONE_VKEY_FORCE=1 to deploy it anyway"; exit 1
fi
export ZONE_VKEY="${ZONE_VKEY:-$elf_vkey}"
export ZONE_PARENT_CHAIN_ID="${ZONE_PARENT_CHAIN_ID:-1337}"
export ZONE_ID="${ZONE_ID:-1}"
export ZONE_GENESIS_ARTIFACT_HASH
ZONE_GENESIS_ARTIFACT_HASH=$(cast keccak "0x$(xxd -p "$genesis_file" | tr -d '\n')")
# keccak256 of each committed artifact, as recorded in spec 003 (Results / Withdrawal batch).
case "$(basename "$genesis_file")" in
  hardfork_t13_recovery.genesis.json)              expect=0xd39aa765427c64ea95821bd5f93d44c89854b0f00fec0e21137421d04fb7c11e ;;
  deposit_and_withdrawal_blocks5-6.genesis.json)   expect=0x2736e5fba4db8533f8611e21035914ebd9bab157b2d1a751d939136b52133236 ;;
  *) expect="${ZONE_GENESIS_EXPECT:?$genesis_file is not a recorded artifact; set ZONE_GENESIS_EXPECT to its expected keccak256}" ;;
esac
[ "$ZONE_GENESIS_ARTIFACT_HASH" = "$(tr 'A-F' 'a-f' <<<"$expect")" ] || \
  { echo "genesis artifact hash $ZONE_GENESIS_ARTIFACT_HASH != the recorded $expect for $(basename "$genesis_file")"; exit 1; }

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
                            (guest ELF sha256 $elf_sha, ELF vkey $elf_vkey)
  parentChainId             $ZONE_PARENT_CHAIN_ID
  pinnedZoneId              $ZONE_ID
  pinnedGenesisArtifactHash $ZONE_GENESIS_ARTIFACT_HASH
                            (keccak256 of ${genesis_file#$root/}, $(wc -c <"$genesis_file" | tr -d ' ') bytes)
)
verifierConfig accepted    "sworn-sp1-groth16-v1" = $(cast from-utf8 sworn-sp1-groth16-v1)
constructor args (abi)      $ctor
init code                   $(( (${#init} - 2) / 2 )) bytes, keccak256 $(cast keccak "$init")
gas                         chain eth_estimateGas=$chain_est  forge-local=$local_est  -> -g $mult (~$offered offered, cap $CAP)
EOF
envp=""; [ "$case_" != hardfork_t13_recovery ] && envp="ZONE_CASE=$case_ "
if [ -z "$SEND" ]; then echo "PRINT ONLY: nothing sent. To deploy: ${envp}scripts/with-keys.sh scripts/deploy-zone-verifier.sh --send"; exit 0; fi

: "${SWORN_DEPLOYER_KEY:?--send needs SWORN_DEPLOYER_KEY in the environment (run under scripts/with-keys.sh)}"
[ $(( chain_est * 110 / 100 )) -le "$CAP" ] || { echo "chain estimate within 10% of the cap; refusing"; exit 1; }
[ $(( offered * 100 )) -ge $(( chain_est * 115 )) ] || { echo "offered limit within 15% of chain estimate; refusing"; exit 1; }
forge script script/ZoneVerifier.s.sol:DeployZoneVerifier --rpc-url "$RPC" -g "$mult" --slow --broadcast
echo "Next: read the receipt; scripts/no-owner.sh --zone-verifier --code \$(cast code <address> --rpc-url $RPC);"
echo "      record address/codehash/constructor args in deployments/moderato.json under zoneVerifier;"
echo "      ${envp}scripts/zone-prove.sh <address>; scripts/zone-attest.sh <address> <the fixture zone-prove.sh printed>"
