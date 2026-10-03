#!/usr/bin/env bash
# Deploy Sworn to Tempo Moderato. FOUNDER ONLY — an agent never runs this (no keys, no txs).
#
#   SWORN_DEPLOYER_KEY=0x...  scripts/deploy-moderato.sh            # dry run against the RPC
#   SWORN_DEPLOYER_KEY=0x...  scripts/deploy-moderato.sh --broadcast
#
# Why this wrapper exists (reckn spec 011 §10.1): `forge script` sizes each broadcast tx from its own
# local simulation × -g, not from the chain's eth_estimateGas, and Tempo charges ~12.8x more per
# deployed byte than Ethereum, so a default forge deploy under-sizes ~5–6x and burns the whole limit.
# Here the chain is asked first (read-only eth_estimateGas) and -g is chosen so forge's limit is
# >= 1.5x the chain's estimate, and the run is refused if that would exceed Tempo's 30M per-tx cap.
# Over-sizing a gas LIMIT is free (a tx pays for gas used), a short one costs the whole deployment.
set -euo pipefail
cd "$(dirname "$0")/.."
RPC="${RPC:-https://rpc.moderato.tempo.xyz}"
CAP=30000000           # TEMPO_T1_TX_GAS_LIMIT_CAP (tempo crates/hardfork/src/constants.rs)
: "${SWORN_DEPLOYER_KEY:?set SWORN_DEPLOYER_KEY in the environment (never on the command line)}"

[ "$(cast chain-id --rpc-url "$RPC")" = "42431" ] || { echo "RPC is not Moderato (42431)"; exit 1; }
scripts/no-owner.sh
forge build --quiet

init=$(forge inspect Sworn bytecode)
chain_est=$(cast estimate --rpc-url "$RPC" --create "$init")
local_est=$(forge script script/Deploy.s.sol --sig 'localCreationGas()' 2>/dev/null | awk '/localCreationGas/{print $2}')
[ -n "$local_est" ] && [ "$chain_est" -gt 0 ] || { echo "could not estimate gas"; exit 1; }

target=$(( chain_est * 3 / 2 ))
[ "$target" -le "$CAP" ] || target=$CAP
[ $(( chain_est * 110 / 100 )) -le "$CAP" ] || { echo "chain estimate $chain_est is within 10% of the 30M cap; refusing"; exit 1; }
mult=$(( (target * 100 + local_est - 1) / local_est ))
offered=$(( local_est * mult / 100 ))
echo "Sworn creation: chain eth_estimateGas=$chain_est  forge-local=$local_est  ratio=$(( chain_est * 100 / local_est ))%"
echo "using -g $mult  => forge offers ~$offered gas (cap $CAP)"
if [ $(( offered * 100 )) -lt $(( chain_est * 115 )) ]; then echo "offered limit within 15% of chain estimate; refusing"; exit 1; fi

forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC" -g "$mult" --slow "$@"
