#!/usr/bin/env bash
# Start / stop the Sworn local chain: Tempo's own node (ghcr.io/tempoxyz/tempo-localnet, built from
# tempo revision 61c979a = the vendored tempo/ commit) in --dev mode on the Moderato-config genesis
# written by localnet-genesis.py. Proof window 250 blocks (mirrors Moderato public RPC, ~150 s). RPC: http://127.0.0.1:${SWORN_LOCAL_PORT:-8546}.
#   scripts/localnet.sh up | down | logs
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=${SWORN_LOCALNET_NAME:-sworn-localnet}
PORT=${SWORN_LOCAL_PORT:-8546}
IMAGE=${SWORN_LOCALNET_IMAGE:-ghcr.io/tempoxyz/tempo-localnet@sha256:3dbd3ec8930f44518f7e080fe96eb4f0a1bdf04641b5c6d8470a2049ac579955}
DIR=${SWORN_LOCAL_DIR:-/tmp/$NAME}
case "${1:-up}" in
  up)
    docker rm -f $NAME >/dev/null 2>&1 || true
    mkdir -p "$DIR"
    (cd contracts && forge build >/dev/null 2>&1)
    python3 scripts/localnet-genesis.py "$DIR/genesis.json"
    docker run -d --name $NAME -p 127.0.0.1:$PORT:8545 -v "$DIR/genesis.json:/genesis.json:ro" \
      --entrypoint /usr/local/bin/tempo "$IMAGE" node --chain /genesis.json --dev --dev.block-time 1s \
      --datadir /tmp/data --tempo.bootnodes-endpoint none --disable-discovery --no-persist-peers \
      --http --http.addr 0.0.0.0 --http.port 8545 --http.api all --http.corsdomain '*' \
      --builder.gaslimit 3000000000 --rpc.eth-proof-window 250 >/dev/null
    for i in $(seq 1 90); do
      if out=$(curl -s -m 3 http://127.0.0.1:$PORT -H 'content-type: application/json' \
          -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' 2>/dev/null) && [[ "$out" == *result* ]]; then
        echo "localnet up on :$PORT after ${i}s: $out"; exit 0; fi
      if [ "$(docker inspect -f '{{.State.Running}}' $NAME 2>/dev/null)" != true ]; then docker logs $NAME | tail -30; exit 1; fi
      sleep 1
    done
    docker logs $NAME | tail -30; exit 1 ;;
  down) docker rm -f $NAME >/dev/null 2>&1 || true; echo down ;;
  logs) docker logs $NAME 2>&1 | tail -${2:-50} ;;
esac
