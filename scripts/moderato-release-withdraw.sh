#!/usr/bin/env bash
# Exercise release / beginUnbond / withdraw on the DEPLOYED Sworn (deployments/moderato.json).
# Without --send every step only READS: chain state, the exact calls (cast form + calldata), and an
# eth_call simulation of each. With --send (and only under scripts/with-keys.sh) it sends, then
# verifies read-only after each tx: receipt status, the Sworn event, servers() accounting, balances.
#
#   scripts/moderato-release-withdraw.sh [status]          reads only: reservations, releasable ones, bonds
#   scripts/with-keys.sh scripts/moderato-release-withdraw.sh release --send
#         release() Active reservations past expiry (reserve time + CHALLENGE_PERIOD 24 h), honest first,
#         at most --max N (default 2); sent from roles.deployer (release is permissionless)
#   scripts/with-keys.sh scripts/moderato-release-withdraw.sh unbond --send
#         actor (default roles.client, a throwaway server entry): approve + bond(actor, --amount, default
#         1000000 = 1 pathUSD) if it has no bond, then beginUnbond(); prints the earliest withdraw time
#   scripts/with-keys.sh scripts/moderato-release-withdraw.sh withdraw --send
#         ≥ 25 h (UNBOND_DELAY) after beginUnbond: withdraw() all free bond to the actor
# Options: --actor client|honest   --retire-honest-server (required with --actor honest --send:
#          beginUnbond has no amount and PERMANENTLY stops that server reserving)
#          --amount N   --max N   --server 0x… (release only this server's reservations)
# Log: out/release-withdraw/<step>-<UTC>.log. Keys only from env (scripts/with-keys.sh); never printed.
set -euo pipefail
cd "$(dirname "$0")/.."
STEP=status SEND= ACTOR=client RETIRE= AMOUNT= MAX= SERVER=
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    status|release|unbond|withdraw) STEP=$1 ;;
    --send) SEND=1 ;;
    --actor) ACTOR=$2; shift ;;
    --retire-honest-server) RETIRE=1 ;;
    --amount) AMOUNT=$2; shift ;;
    --max) MAX=$2; shift ;;
    --server) SERVER=$2; shift ;;
    *) echo "unknown argument $1 (try --help)"; exit 2 ;;
  esac
  shift
done
case "$ACTOR" in client|honest) ;; *) echo "--actor must be client|honest"; exit 2 ;; esac
if [ -n "$SEND" ]; then
  [ "$STEP" = status ] && { echo "status never sends"; exit 2; }
  for k in SWORN_DEPLOYER_KEY SWORN_HONEST_KEY DEMO_CLIENT_KEY; do
    [ -n "${!k:-}" ] || { echo "missing env $k — --send must run under scripts/with-keys.sh"; exit 2; }
  done
  [ "$ACTOR" = honest ] && [ "$STEP" = unbond ] && [ -z "$RETIRE" ] && {
    echo "refusing: beginUnbond() takes no amount and permanently retires the honest server; add --retire-honest-server"; exit 2; }
fi
mkdir -p out/release-withdraw
LOG=out/release-withdraw/$STEP-$(date -u +%Y%m%dT%H%M%SZ)${SEND:+-sent}.log
echo "log: $LOG"
set +e
export SWORN_RW_STEP=$STEP SWORN_RW_SEND=$SEND SWORN_RW_ACTOR=$ACTOR SWORN_RW_RETIRE_HONEST=$RETIRE NODE_NO_WARNINGS=1
[ -n "$AMOUNT" ] && export SWORN_RW_AMOUNT=$AMOUNT
[ -n "$MAX" ] && export SWORN_RW_MAX=$MAX
[ -n "$SERVER" ] && export SWORN_RW_SERVER=$SERVER
node sdk/test/release-withdraw.ts 2>&1 | tee "$LOG"
exit "${PIPESTATUS[0]}"
