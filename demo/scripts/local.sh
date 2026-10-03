#!/usr/bin/env bash
# Local demo: anvil --network tempo + seeded Sworn + demo backend + Vite. Nothing touches Moderato.
# Usage: demo/scripts/local.sh   (Ctrl-C stops everything)
set -euo pipefail
cd "$(dirname "$0")/.."
PORT_RPC=${PORT_RPC:-8545}
anvil --network tempo --chain-id 42431 --port "$PORT_RPC" --silent &
ANVIL=$!
trap 'kill $ANVIL ${BACKEND:-} 2>/dev/null || true' EXIT
for _ in $(seq 50); do cast chain-id --rpc-url "http://127.0.0.1:$PORT_RPC" >/dev/null 2>&1 && break; sleep 0.1; done
[ -f test/fixtures/sworn.bytecode ] || node scripts/gen-abi.mjs
node scripts/seed-anvil.ts "http://127.0.0.1:$PORT_RPC" > .env.local.generated
set -a; . ./.env.local.generated; set +a
DEMO_RECORDING_LOG=${DEMO_RECORDING_LOG:-../out/ac7_groth16.log} node backend/server.ts &
BACKEND=$!
npx vite --port "${PORT_UI:-5173}" --strictPort
