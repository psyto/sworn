#!/usr/bin/env bash
# Spec 003 AC-Z5: check a deployed SwornZoneVerifier against a fixture, and print (or send) `attest`.
#
#   scripts/zone-attest.sh <verifier-address> <fixture.json>                  PRINT ONLY (reads only)
#   scripts/with-keys.sh scripts/zone-attest.sh <address> <fixture> --send    operator only: sends attest
#
# Always (eth_call only, nothing sent):
#   - the on-chain immutables equal the fixture's (ZONE_VKEY, PARENT_CHAIN_ID, PINNED_ZONE_ID,
#     PINNED_GENESIS_ARTIFACT_HASH) and the fixture was proved for this address and chain;
#   - attestationDigest(args) == fixture digest;
#   - verify(args, 0x02, proof) returns true;
#   - verify with ONE field mutated (nextZoneHeight + 1) reverts with InvalidProof();
#   - prints the exact attest calldata.
# With --send: broadcasts that calldata via forge script (key from SWORN_DEPLOYER_KEY in the env, never a
# flag), then prints how to read the receipt and the ZoneBatchVerified event.
#   RPC (default https://rpc.moderato.tempo.xyz) may be overridden, e.g. to a local anvil for a rehearsal.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/contracts"
addr="${1:?usage: zone-attest.sh <verifier-address> <fixture.json> [--send]}"
fx="${2:?usage: zone-attest.sh <verifier-address> <fixture.json> [--send]}"
SEND=
case "${3:-}" in --send) SEND=1 ;; "") ;; *) echo "unknown argument $3"; exit 2 ;; esac
RPC="${RPC:-https://rpc.moderato.tempo.xyz}"
CAP=30000000

j() { python3 -c 'import json,sys; v=json.load(open(sys.argv[1]));
for k in sys.argv[2].split("."): v=v[k]
print(v)' "$fx" "$1"; }
lc() { tr 'A-F' 'a-f' <<<"$1"; }

chain=$(cast chain-id --rpc-url "$RPC")
[ "$(lc "$(j verifier)")" = "$(lc "$addr")" ] || { echo "fixture was proved for verifier $(j verifier), not $addr"; exit 1; }
[ "$(j destinationChainId)" = "$chain" ] || { echo "fixture is for chain $(j destinationChainId), RPC is $chain"; exit 1; }
[ -n "$(cast code --rpc-url "$RPC" "$addr" | sed 's/^0x//')" ] || { echo "no code at $addr"; exit 1; }
chk() { # label, on-chain value, fixture value
  if [ "$(lc "$2")" = "$(lc "$3")" ]; then echo "ok    $1 = $2"; else echo "FAIL  $1: on-chain $2 != fixture $3"; exit 1; fi; }
chk ZONE_VKEY "$(cast call --rpc-url "$RPC" "$addr" 'ZONE_VKEY()(bytes32)')" "$(j vkey)"
chk PARENT_CHAIN_ID "$(cast call --rpc-url "$RPC" "$addr" 'PARENT_CHAIN_ID()(uint256)')" "$(j parentChainId)"
chk PINNED_ZONE_ID "$(cast call --rpc-url "$RPC" "$addr" 'PINNED_ZONE_ID()(uint32)')" "$(j args.zoneId)"
chk PINNED_GENESIS_ARTIFACT_HASH "$(cast call --rpc-url "$RPC" "$addr" 'PINNED_GENESIS_ARTIFACT_HASH()(bytes32)')" "$(j genesisArtifactHash)"

BT="(bytes32,bytes32)"; DQ="(bytes32,bytes32,uint64,uint64)"; TE="(uint64,uint64)"
ARGS_T="uint32,uint64,uint64,bytes32,uint64,uint256,$BT,$DQ,$TE,bytes32,bytes"
args() { # nextZoneHeight override
  echo "$(j args.zoneId)" "$(j args.tempoBlockNumber)" "$(j args.anchorBlockNumber)" "$(j args.anchorBlockHash)" \
    "$(j args.expectedWithdrawalBatchIndex)" "$1" \
    "($(j args.prevBlockHash),$(j args.nextBlockHash))" \
    "($(j args.prevProcessedHash),$(j args.nextProcessedHash),$(j args.prevDepositNumber),$(j args.nextDepositNumber))" \
    "($(j args.prevProcessedTokenCount),$(j args.nextProcessedTokenCount))" \
    "$(j args.withdrawalQueueHash)" "$(j verifierConfig)"
}
nzh=$(j args.nextZoneHeight)
# shellcheck disable=SC2046
chk attestationDigest "$(cast call --rpc-url "$RPC" "$addr" "attestationDigest($ARGS_T)(bytes32)" $(args "$nzh"))" "$(j digest)"
# shellcheck disable=SC2046
v=$(cast call --rpc-url "$RPC" "$addr" "verify($ARGS_T,bytes)(bool)" $(args "$nzh") "$(j proof)")
[ "$v" = "true" ] && echo "ok    eth_call verify(real proof) = true" || { echo "FAIL  verify returned $v"; exit 1; }
set +e
# shellcheck disable=SC2046
mut=$(cast call --rpc-url "$RPC" "$addr" "verify($ARGS_T,bytes)(bool)" $(args $((nzh + 1))) "$(j proof)" 2>&1); rc=$?
set -e
sel=$(cast sig 'InvalidProof()')
if [ $rc -ne 0 ] && grep -qi "${sel#0x}\|InvalidProof" <<<"$mut"; then echo "ok    eth_call verify(nextZoneHeight+1) reverts InvalidProof() ($sel)"
else echo "FAIL  mutated verify did not revert with InvalidProof: rc=$rc $mut"; exit 1; fi

# shellcheck disable=SC2046
calldata=$(cast calldata "attest($ARGS_T,bytes)" $(args "$nzh") "$(j proof)")
echo "=== attest transaction (to $addr, chain $chain, value 0) ==="
echo "calldata ($(( (${#calldata} - 2) / 2 )) bytes): $calldata"
chain_est=$(cast estimate --rpc-url "$RPC" "$addr" "$calldata")
echo "chain eth_estimateGas: $chain_est"
if [ -z "$SEND" ]; then echo "PRINT ONLY: nothing sent. To send: scripts/with-keys.sh scripts/zone-attest.sh $addr $fx --send"; exit 0; fi

: "${SWORN_DEPLOYER_KEY:?--send needs SWORN_DEPLOYER_KEY in the environment (run under scripts/with-keys.sh)}"
export ZONE_VERIFIER="$addr" ZONE_ATTEST_CALLDATA="$calldata"
local_est=$(forge script script/ZoneVerifier.s.sol:AttestZoneBatch --rpc-url "$RPC" --sig 'localGas()' 2>/dev/null | awk '/localGas/{print $2}')
[ -n "$local_est" ] || { echo "could not simulate attest locally"; exit 1; }
target=$(( chain_est * 3 / 2 )); [ "$target" -le "$CAP" ] || target=$CAP
mult=$(( (target * 100 + local_est - 1) / local_est ))
[ $(( local_est * mult )) -ge $(( chain_est * 115 )) ] || { echo "offered limit within 15% of chain estimate; refusing"; exit 1; }
echo "using -g $mult (forge-local $local_est, chain $chain_est)"
forge script script/ZoneVerifier.s.sol:AttestZoneBatch --rpc-url "$RPC" -g "$mult" --slow --broadcast
echo "Next: cast receipt <tx> --rpc-url $RPC  (status 1; one log from $addr with topic0 $(cast sig-event 'ZoneBatchVerified(uint32,uint256,bytes32,bytes32,bytes32)'))"
echo "      record tx hash and block in deployments/moderato.json under zoneVerifier."
