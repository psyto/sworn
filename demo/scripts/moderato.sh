#!/usr/bin/env bash
# The demo against the DEPLOYED Sworn on Tempo Moderato (deployments/moderato.json).
#
#   scripts/with-keys.sh demo/scripts/moderato.sh        (from the repo root; Ctrl-C stops everything)
#
# Starts: the honest answer server (:8787) and the dishonest-demo server (:8788) — both real MPP servers
# that reserve on Moderato; the demo backend (:8790), which signs as the client; and the UI (:5173).
# Buying, paying and challenging in the UI SENDS REAL MODERATO TRANSACTIONS (testnet funds only).
# A challenge proves locally (~7 min, ~15 GB RAM).
#
# Keys only from the environment exported by scripts/with-keys.sh — never printed, never written:
#   SWORN_HONEST_KEY  SWORN_DISHONEST_KEY  DEMO_CLIENT_KEY  (and SWORN_CHALLENGER_KEY for challenges)
# Receivers: R = the honest server's address (no receive policy); R′ = the deployer, whose receive
# policy blocks the client (set by scripts/moderato-run.sh; checked below, not assumed).
set -euo pipefail
cd "$(dirname "$0")/../.."
for k in SWORN_HONEST_KEY SWORN_DISHONEST_KEY DEMO_CLIENT_KEY SWORN_CHALLENGER_KEY SWORN_DEPLOYER_KEY; do
  [ -n "${!k:-}" ] || { echo "missing env $k — run under scripts/with-keys.sh"; exit 2; }
done
RPC=https://rpc.moderato.tempo.xyz
DEP=deployments/moderato.json
SWORN=$(jq -r .Sworn.address $DEP)
CODEHASH=$(jq -r .Sworn.codehash $DEP)
HONEST=$(cast wallet address "$SWORN_HONEST_KEY")
RBLOCKED=$(cast wallet address "$SWORN_DEPLOYER_KEY")
CLIENT=$(cast wallet address "$DEMO_CLIENT_KEY")
ALPHA=0x20C0000000000000000000000000000000000001
PATHUSD=0x20C0000000000000000000000000000000000000
TIP403=0x403c000000000000000000000000000000000000

# Preconditions read from chain, not assumed.
[ "$(cast chain-id --rpc-url $RPC)" = "42431" ] || { echo "not Moderato"; exit 1; }
[ "$(cast keccak "$(cast code "$SWORN" --rpc-url $RPC)")" = "$CODEHASH" ] || { echo "Sworn codehash differs from $DEP"; exit 1; }
POL=$(cast call $TIP403 "validateReceivePolicy(address,address,address)(bool,uint8)" $ALPHA "$CLIENT" "$RBLOCKED" --rpc-url $RPC | head -1)
[ "$POL" = "false" ] || { echo "R′ $RBLOCKED does not block the client — run scripts/with-keys.sh scripts/moderato-run.sh --dry-run to see the plan"; exit 1; }
echo "Moderato · Sworn $SWORN · R $HONEST · R′ $RBLOCKED (blocks client) · client $CLIENT"

cargo build --release -p sworn-answerer -p sworn-challenger 2>&1 | tail -1
[ -x runner/target/release/spike-runner ] || (cd runner && cargo build --release 2>&1 | tail -1)
export MPP_SECRET_KEY=${MPP_SECRET_KEY:-$(openssl rand -hex 32)}
PIDS=()
trap 'kill ${PIDS[@]:-} 2>/dev/null || true' EXIT

start_server() { # mode port key
  SWORN_SERVER_KEY="$3" SWORN_ADDRESS="$SWORN" SWORN_RPC_URL=$RPC SWORN_MODE="$1" PORT="$2" NODE_NO_WARNINGS=1 \
    node server/src/server.ts > "/tmp/sworn-demo-server-$1.log" 2>&1 &
  PIDS+=($!)
}
start_server honest 8787 "$SWORN_HONEST_KEY"
start_server dishonest-demo 8788 "$SWORN_DISHONEST_KEY"

cd demo
DEMO_PORT=8790 DEMO_RPC_URL=$RPC DEMO_ALLOW_REMOTE_TX=1 SWORN_ADDRESS="$SWORN" \
  DEMO_TOKEN=$ALPHA DEMO_FEE_TOKEN=$PATHUSD DEMO_RECEIVER="$HONEST" DEMO_RECEIVER_BLOCKED="$RBLOCKED" \
  HONEST_SERVER_URL=http://127.0.0.1:8787 DISHONEST_SERVER_URL=http://127.0.0.1:8788 \
  SWORN_RPC_URL=$RPC NODE_NO_WARNINGS=1 node backend/server.ts > /tmp/sworn-demo-backend.log 2>&1 &
PIDS+=($!)

DEMO_BACKEND_ORIGIN=http://127.0.0.1:8790 VITE_RPC_URL=$RPC VITE_CHAIN_ID=42431 VITE_NETWORK_LABEL="Moderato testnet" \
  VITE_SWORN_ADDRESS="$SWORN" VITE_SWORN_CODEHASH="$CODEHASH" VITE_EXPLORER_URL=https://explore.testnet.tempo.xyz \
  VITE_FEED_LOOKBACK=${VITE_FEED_LOOKBACK:-20000} \
  npx vite --port "${PORT_UI:-5173}" --strictPort
