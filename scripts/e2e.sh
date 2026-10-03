#!/usr/bin/env bash
# Spec 002 local e2e (S-1..S-4). Starts a FRESH Sworn local chain (localnet.sh: Tempo's own node,
# Moderato genesis config, real SP1 verifier etched at genesis) and, for S-4, a second chain whose
# genesis config drifts from the guest's (T12 moved). Then runs sdk/test/e2e.ts.
#
# Keys: env vars only — SWORN_DEPLOYER_KEY SWORN_SERVER_KEY SWORN_DISHONEST_SERVER_KEY
# SWORN_CLIENT_KEY SWORN_CHALLENGER_KEY SWORN_BLOCKING_RECEIVER_KEY, each a DISTINCT dev account of
# the local chain (the standard development mnemonic in tempo/docs/localnet.md, indexes 0..5;
# derive with `cast wallet private-key --mnemonic "<mnemonic>" --mnemonic-index N`). This script
# never writes a key anywhere.
# SWORN_E2E_STAGES selects stages (default S-1,S-3,S-2,S-4; S-2 proves twice locally, ~15 min).
set -euo pipefail
cd "$(dirname "$0")/.."
for k in SWORN_DEPLOYER_KEY SWORN_SERVER_KEY SWORN_DISHONEST_SERVER_KEY SWORN_CLIENT_KEY SWORN_CHALLENGER_KEY SWORN_BLOCKING_RECEIVER_KEY; do
  [ -n "${!k:-}" ] || { echo "missing env $k"; exit 2; }
done
cargo build --release -p sworn-answerer -p sworn-challenger 2>&1 | tail -1
[ -x runner/target/release/spike-runner ] || (cd runner && cargo build --release 2>&1 | tail -1)
scripts/localnet.sh up
T12=$(python3 -c "import json;print(json.load(open('tempo/crates/chainspec/src/genesis/moderato.json'))['config']['t12Time'])")
SWORN_LOCALNET_NAME=sworn-localnet-drift SWORN_LOCAL_PORT=8547 SWORN_GENESIS_OVERRIDE="{\"t12Time\": $((T12 + 3600))}" scripts/localnet.sh up
trap 'SWORN_LOCALNET_NAME=sworn-localnet-drift scripts/localnet.sh down >/dev/null' EXIT
sleep 3
SWORN_RPC_URL=http://127.0.0.1:8546 SWORN_DRIFT_RPC_URL=http://127.0.0.1:8547 NODE_NO_WARNINGS=1 node sdk/test/e2e.ts
