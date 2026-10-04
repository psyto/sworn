#!/usr/bin/env bash
# Spec 002 S-1..S-4 against the DEPLOYED Sworn on Tempo Moderato (deployments/moderato.json).
# Sends real Moderato transactions (bond/policy only if missing, 2 MPP charges, 2 reserves, 1 real
# payment, 1 challenge). Proves locally twice (~6 min each, ~15 GB RAM).
#
#   scripts/with-keys.sh scripts/moderato-run.sh            run it
#   scripts/with-keys.sh scripts/moderato-run.sh --dry-run  reads only: checks the deployment,
#                                                           balances, bond and policy; prints the plan
#   scripts/moderato-run.sh --help
#
# Keys ONLY from env (exported by scripts/with-keys.sh); never printed:
#   SWORN_DEPLOYER_KEY (also R', the receiver whose receive policy blocks the client)
#   SWORN_CHALLENGER_KEY SWORN_HONEST_KEY SWORN_DISHONEST_KEY DEMO_CLIENT_KEY
# MPP_SECRET_KEY: from env, else generated for this run (kept in memory only).
# Log: out/e2e/moderato-<UTC timestamp>.log, then gated with scripts/check-e2e.sh --set moderato.
# Gate exit 3 = HARNESS-FAILURE: the challenger died/timed out/lost its output; no contract outcome
# was observed for those checks (selftest: node sdk/test/harness-selftest.ts).
# Server ports: SWORN_E2E_PORTS (default 8787,8788).
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-}" in
  -h|--help) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  --dry-run) DRY=1 ;;
  "") DRY= ;;
  *) echo "unknown argument $1 (try --help)"; exit 2 ;;
esac
for k in SWORN_DEPLOYER_KEY SWORN_CHALLENGER_KEY SWORN_HONEST_KEY SWORN_DISHONEST_KEY DEMO_CLIENT_KEY; do
  [ -n "${!k:-}" ] || { echo "missing env $k — run under scripts/with-keys.sh"; exit 2; }
done
cargo build --release -p sworn-answerer -p sworn-challenger 2>&1 | tail -1
[ -x runner/target/release/spike-runner ] || (cd runner && cargo build --release 2>&1 | tail -1)
export MPP_SECRET_KEY=${MPP_SECRET_KEY:-$(openssl rand -hex 32)}
mkdir -p out/e2e
TS=$(date -u +%Y%m%dT%H%M%SZ)
LOG=out/e2e/moderato-${TS}${DRY:+-dry-run}.log
echo "log: $LOG"
set +e
SWORN_E2E_TARGET=moderato SWORN_RPC_URL=https://rpc.moderato.tempo.xyz SWORN_E2E_DRY_RUN=$DRY \
  SWORN_E2E_DIR=/tmp/sworn-moderato-$TS NODE_NO_WARNINGS=1 node sdk/test/e2e.ts 2>&1 | tee "$LOG"
rc=${PIPESTATUS[0]}
set -e
[ -n "$DRY" ] && exit $rc
echo "--- gate ---" | tee -a "$LOG"
scripts/check-e2e.sh --log "$LOG" --set moderato 2>&1 | tee -a "$LOG.gate"
exit ${PIPESTATUS[0]}
