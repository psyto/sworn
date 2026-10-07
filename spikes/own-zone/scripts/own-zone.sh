#!/usr/bin/env bash
# Own Tempo Zone anchored to Moderato: one step per invocation. PRINT-ONLY unless --send.
#
#   spikes/own-zone/scripts/with-zone-keys.sh spikes/own-zone/scripts/own-zone.sh <step> [--send]
#
# Steps, in order (see spikes/own-zone/RUNBOOK.md):
#   preflight         read-only: chain, fork, binaries, vkey, key addresses, balances, nonces
#   genesis           anchor = current L1 head; Zone genesis pinning portal = CREATE(deployer, nonce+1)
#   deploy-verifier   deployer nonce n   -> SwornZoneVerifier(SP1, VKEY, 42431, ZONE_ID, genesisKeccak)
#   deploy-portal     deployer nonce n+1 -> OwnZonePortal (must equal the pinned address)
#   initialize        deployer: initialize(ZONE_ID, pathUSD, open, messenger, admin, [sequencer], 1, verifier)
#   encryption-key    sequencer: setSequencerEncryptionKey (proof of possession)
#   start             zone node + sequencer (+ in-process SPF + proof collector) and the Sworn prover
#   deposit           user: approve + encrypted deposit; waits for the mint on the zone
#   withdraw          user, on the zone: approve ZoneOutbox + requestWithdrawal
#   status            read-only: batches, anchor ages, proofs, withdrawals, balances
#   forged-batch      a malicious sequencer's forged batch is rejected by the proof (print-only unless --send)
#   stop              stop the zone node and the prover
#
# Keys come ONLY from the environment (never printed): OWN_ZONE_DEPLOYER_KEY, OWN_ZONE_SEQUENCER_KEY,
# OWN_ZONE_USER_KEY (scripts/with-zone-keys.sh loads them from Foundry keystores). Everything else comes
# from $OWN_ZONE_RUN/config.env (created by `preflight` from the environment on first use).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; spike="$(cd "$here/.." && pwd)"
STEP="${1:-}"; SEND=""; [ "${2:-}" = "--send" ] && SEND=1
die() { echo "own-zone: $*" >&2; exit 1; }
say() { echo "[own-zone $STEP] $*"; }

: "${OWN_ZONE_RUN:?set OWN_ZONE_RUN=<run directory, e.g. spikes/own-zone/runs/moderato-20261007>}"
mkdir -p "$OWN_ZONE_RUN"; RUN="$(cd "$OWN_ZONE_RUN" && pwd)"
CFG="$RUN/config.env"; STATE="$RUN/state.env"
if [ ! -f "$CFG" ]; then
  cat > "$CFG" <<EOF
# own-zone run config (no secrets). Edit before 'genesis'.
L1_HTTP=${L1_HTTP:-https://rpc.moderato.tempo.xyz}
L1_WS=${L1_WS:-wss://rpc.moderato.tempo.xyz}
L1_CHAIN_ID=${L1_CHAIN_ID:-42431}
SP1_VERIFIER=${SP1_VERIFIER:-0x2c77329747b7C8B293514A6129404D4cefDd9B18}
VKEY=${VKEY:-0x00ab5a9e697e8e1f81e1db06c7e41afd5dd046438f50b972a48c417d724a5c7b}
ZONE_ID=${ZONE_ID:-4242}
MESSENGER=0x5A4d000000000000000000000000000000000000
PATH_USD=0x20C0000000000000000000000000000000000000
DEPOSIT_AMOUNT=${DEPOSIT_AMOUNT:-1000000}
WITHDRAW_AMOUNT=${WITHDRAW_AMOUNT:-500000}
ZONE_HTTP_PORT=${ZONE_HTTP_PORT:-9545}
# Direct anchors are used only while at least this many EIP-2935 blocks remain (one Groth16 ~ 15 min).
ANCHOR_SAFETY_MARGIN=${ANCHOR_SAFETY_MARGIN:-3000}
OWN_ZONE_BUILD=${OWN_ZONE_BUILD:-$spike/build}
RUNNER=${RUNNER:-$(cd "$spike/../.." && pwd)/runner/target/release/spike-runner}
EOF
  echo "own-zone: wrote $CFG -- review it, then re-run"; exit 0
fi
# shellcheck disable=SC1090
. "$CFG"; [ -f "$STATE" ] && . "$STATE"
B="$OWN_ZONE_BUILD"; PROFILE="${OWN_ZONE_PROFILE:-release}"
ZONE_BIN="$B/zones/target/$PROFILE/tempo-zone"; GEN_BIN="$B/zones/target/$PROFILE/own-zone-genesis"
XTASK="$B/zones/target/$PROFILE/tempo-xtask"; HOST="$B/zspf/host/target/release/sworn-zone-host"
ELF="${OWN_ZONE_ELF:-$spike/guest-elf/zone-spf-guest-own}"
ART="$spike/contracts/out"
ZONE_HTTP="http://127.0.0.1:$ZONE_HTTP_PORT"
setstate() { grep -v "^$1=" "$STATE" 2>/dev/null > "$STATE.tmp" || true; echo "$1=$2" >> "$STATE.tmp"; mv "$STATE.tmp" "$STATE"; export "$1=$2"; }
addr_of() { local k="${!1:-}"; [[ "$k" =~ ^0x[0-9a-fA-F]{64}$ ]] || return 0; cast wallet address --private-key "$k"; }
nonce() { cast nonce "$1" --rpc-url "$L1_HTTP"; }
bytecode() { python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['bytecode']['object'])" "$1"; }
send_l1() { # key-env-var, then cast send args (no --private-key / --rpc-url)
  local kv="$1"; shift
  if [ -z "$SEND" ]; then
    local shown="$*"; [ ${#shown} -gt 400 ] && shown="${shown:0:120}… ($(( ${#shown} )) chars, keccak $(cast keccak "${!#}"))"
    say "PRINT ONLY: cast send --rpc-url $L1_HTTP --private-key \$$kv $shown"; return 1; fi
  cast send --rpc-url "$L1_HTTP" --private-key "${!kv}" --json "$@" > "$RUN/last-tx.json"
  python3 -c "import json;r=json.load(open('$RUN/last-tx.json'));assert r['status'] in ('0x1',1),r;print('tx',r['transactionHash'],'block',int(r['blockNumber'],16),'gasUsed',int(r['gasUsed'],16),'contract',r.get('contractAddress'))" | tee -a "$RUN/txs.log"
}
need_state() { for v in "$@"; do [ -n "${!v:-}" ] || die "missing $v in $STATE (run the earlier step)"; done; }

DEPLOYER=$(addr_of OWN_ZONE_DEPLOYER_KEY); SEQUENCER=$(addr_of OWN_ZONE_SEQUENCER_KEY); USERADDR=$(addr_of OWN_ZONE_USER_KEY)
case "$STEP" in stop|status|"") ;; *) [ -n "$DEPLOYER" ] && [ -n "$SEQUENCER" ] && [ -n "$USERADDR" ] \
  || die "OWN_ZONE_{DEPLOYER,SEQUENCER,USER}_KEY missing (run under scripts/with-zone-keys.sh)";; esac

case "$STEP" in
preflight)
  [ "$(cast chain-id --rpc-url "$L1_HTTP")" = "$L1_CHAIN_ID" ] || die "L1 is not chain $L1_CHAIN_ID"
  fork=$(cast rpc tempo_forkSchedule --rpc-url "$L1_HTTP" | python3 -c "import json,sys;print(json.load(sys.stdin)['active'])")
  say "L1 $L1_HTTP chain $L1_CHAIN_ID, active fork $fork, head $(cast block-number --rpc-url "$L1_HTTP")"
  for f in "$ZONE_BIN" "$GEN_BIN" "$XTASK" "$HOST" "$ELF" "$RUNNER" "$ART/OwnZonePortal.sol/OwnZonePortal.json" "$ART/SwornZoneVerifier.sol/SwornZoneVerifier.json"; do
    [ -e "$f" ] || die "missing $f (run spikes/own-zone/build.sh)"; done
  es=$(shasum -a 256 "$ELF" | cut -d' ' -f1); say "guest ELF sha256 $es"
  [ "$es" = 6f6fb01e42cd46a2753b12637242fc4b4b4023f1cce3f24ef1e770b5f636d6e4 ] || die "guest ELF is not the pinned one (vkey would differ)"
  [ -n "$(cast code "$SP1_VERIFIER" --rpc-url "$L1_HTTP")" ] && [ "$(cast code "$SP1_VERIFIER" --rpc-url "$L1_HTTP")" != 0x ] || die "no SP1 verifier at $SP1_VERIFIER"
  for who in DEPLOYER SEQUENCER USERADDR; do
    a="${!who}"; [ -n "$a" ] || die "$who key missing"
    say "$who $a nonce $(nonce "$a") pathUSD $(cast call "$PATH_USD" 'balanceOf(address)(uint256)' "$a" --rpc-url "$L1_HTTP" | cut -d' ' -f1)"
  done
  [ "$DEPLOYER" != "$SEQUENCER" ] && [ "$DEPLOYER" != "$USERADDR" ] || die "use three distinct keys"
  ub=$(cast call "$PATH_USD" 'balanceOf(address)(uint256)' "$USERADDR" --rpc-url "$L1_HTTP" | cut -d' ' -f1)
  python3 -c "import sys; sys.exit(0 if int('$ub') >= $DEPOSIT_AMOUNT + 100000 else 1)" || die "user needs >= $((DEPOSIT_AMOUNT + 100000)) pathUSD units (has $ub): use the faucet"
  for who in DEPLOYER SEQUENCER; do b=$(cast call "$PATH_USD" 'balanceOf(address)(uint256)' "${!who}" --rpc-url "$L1_HTTP" | cut -d' ' -f1)
    python3 -c "import sys; sys.exit(0 if int('$b') >= 100000 else 1)" || say "WARNING: $who has < 0.1 pathUSD; make sure it holds a fee token (faucet)"; done
  swap=$(sysctl -n vm.swapusage 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="used") print $(i+2)}' | tr -d M)
  [ -n "$swap" ] && python3 -c "import sys; sys.exit(0 if float('$swap') < 4096 else 1)" \
    || say "WARNING: swap in use (${swap:-?} MB). Groth16 needs ~20 GB RAM; close other apps/agents or proofs may outlast the anchor window (DRESS.md dress 4)."
  say "OK. The deployer must send NOTHING else until deploy-portal has landed (its nonce pins the portal address)." ;;

genesis)
  [ -z "${PORTAL:-}" ] || die "genesis already made for portal $PORTAL ($STATE); use a new OWN_ZONE_RUN to start over"
  n=$(nonce "$DEPLOYER"); anchor=$(cast block-number --rpc-url "$L1_HTTP")
  "$GEN_BIN" --l1-rpc "$L1_HTTP" --anchor "$anchor" --zone-id "$ZONE_ID" --deployer "$DEPLOYER" \
    --portal-nonce $((n + 1)) --expect-chain-id "$L1_CHAIN_ID" --out "$RUN/genesis" > /dev/null
  P=$(python3 -c "import json;print(json.load(open('$RUN/genesis/summary.json'))['portal'])")
  K=$(python3 -c "import json;print(json.load(open('$RUN/genesis/summary.json'))['genesisArtifactKeccak'])")
  [ "$(cast keccak "0x$(xxd -p "$RUN/genesis/genesis-artifact.json" | tr -d '\n')")" = "$K" ] || die "artifact keccak mismatch"
  setstate ANCHOR "$anchor"; setstate DEPLOYER_NONCE "$n"; setstate PORTAL "$(cast to-check-sum-address "$P")"
  setstate VERIFIER "$(cast compute-address "$DEPLOYER" --nonce "$n" | awk '{print $NF}')"; setstate GENESIS_KECCAK "$K"
  say "anchor $anchor; verifier will be $VERIFIER (nonce $n); portal $PORTAL (nonce $((n+1))); genesis keccak $K"
  say "Re-run is deterministic: own-zone-genesis --anchor $anchor --deployer $DEPLOYER --portal-nonce $((n+1)) gives the same keccak." ;;

deploy-verifier)
  need_state VERIFIER PORTAL GENESIS_KECCAK DEPLOYER_NONCE
  [ "$(nonce "$DEPLOYER")" = "$DEPLOYER_NONCE" ] || die "deployer nonce moved ($(nonce "$DEPLOYER") != $DEPLOYER_NONCE): addresses no longer match the genesis. ABORT: start a new run."
  ctor=$(cast abi-encode "constructor(address,bytes32,uint256,uint32,bytes32)" "$SP1_VERIFIER" "$VKEY" "$L1_CHAIN_ID" "$ZONE_ID" "$GENESIS_KECCAK")
  init="$(bytecode "$ART/SwornZoneVerifier.sol/SwornZoneVerifier.json")${ctor#0x}"
  say "SwornZoneVerifier($SP1_VERIFIER, $VKEY, $L1_CHAIN_ID, $ZONE_ID, $GENESIS_KECCAK) -> expected $VERIFIER; estimateGas $(cast estimate --rpc-url "$L1_HTTP" --from "$DEPLOYER" --create "$init")"
  send_l1 OWN_ZONE_DEPLOYER_KEY --create "$init" || exit 0
  for f in "PARENT_CHAIN_ID()(uint256)" "PINNED_ZONE_ID()(uint32)" "PINNED_GENESIS_ARTIFACT_HASH()(bytes32)" "ZONE_VKEY()(bytes32)" "SP1_VERIFIER()(address)"; do
    say "check $f = $(cast call "$VERIFIER" "$f" --rpc-url "$L1_HTTP")"; done ;;

deploy-portal)
  need_state PORTAL DEPLOYER_NONCE VERIFIER
  [ "$(cast code "$VERIFIER" --rpc-url "$L1_HTTP")" != 0x ] || die "verifier not deployed yet"
  [ "$(nonce "$DEPLOYER")" = "$((DEPLOYER_NONCE + 1))" ] || die "deployer nonce is $(nonce "$DEPLOYER"), expected $((DEPLOYER_NONCE + 1)): the portal would not land at $PORTAL. ABORT: new run."
  init="$(bytecode "$ART/OwnZonePortal.sol/OwnZonePortal.json")"
  say "OwnZonePortal -> expected $PORTAL; estimateGas $(cast estimate --rpc-url "$L1_HTTP" --from "$DEPLOYER" --create "$init")"
  send_l1 OWN_ZONE_DEPLOYER_KEY --create "$init" || exit 0
  say "check INITIALIZER = $(cast call "$PORTAL" 'INITIALIZER()(address)' --rpc-url "$L1_HTTP") (want $DEPLOYER)" ;;

initialize)
  need_state PORTAL VERIFIER
  args=("$ZONE_ID" "$PATH_USD" false false "[]" "[]" "$MESSENGER" "$DEPLOYER" "[$SEQUENCER]" 1 "$VERIFIER" "")
  say "initialize(${args[*]})"
  send_l1 OWN_ZONE_DEPLOYER_KEY "$PORTAL" "initialize(uint32,address,bool,bool,address[],address[],address,address,address[],uint8,address,string)" "${args[@]}" || exit 0
  say "check zoneId=$(cast call "$PORTAL" 'zoneId()(uint32)' --rpc-url "$L1_HTTP") verifier=$(cast call "$PORTAL" 'verifier()(address)' --rpc-url "$L1_HTTP") isSequencer=$(cast call "$PORTAL" 'isSequencer(address)(bool)' "$SEQUENCER" --rpc-url "$L1_HTTP") enabledTokens=$(cast call "$PORTAL" 'enabledTokenCount()(uint256)' --rpc-url "$L1_HTTP")" ;;

encryption-key)
  need_state PORTAL
  [ -n "${OWN_ZONE_SEQUENCER_KEY:-}" ] || die "sequencer key missing"
  pub=$(cast wallet public-key --raw-private-key "$OWN_ZONE_SEQUENCER_KEY" | sed 's/^0x//')
  x="0x${pub:0:64}"; ylast=${pub:127:1}; case "$ylast" in [02468aAcCeE]) par=2;; *) par=3;; esac
  msg=$(cast keccak "$(cast abi-encode 'f(address,bytes32,uint8)' "$PORTAL" "$x" "$par")")
  sig=$(cast wallet sign --no-hash "$msg" --private-key "$OWN_ZONE_SEQUENCER_KEY" | sed 's/^0x//')
  r="0x${sig:0:64}"; s="0x${sig:64:64}"; v=$((16#${sig:128:2}))
  say "setSequencerEncryptionKey(x=$x, yParity=$par, v=$v, r, s)  [the sequencer key is also the deposit-decryption key]"
  send_l1 OWN_ZONE_SEQUENCER_KEY "$PORTAL" "setSequencerEncryptionKey(bytes32,uint8,uint8,bytes32,bytes32)" "$x" "$par" "$v" "$r" "$s" || exit 0
  say "check encryptionKeyCount = $(cast call "$PORTAL" 'encryptionKeyCount()(uint256)' --rpc-url "$L1_HTTP")" ;;

start)
  need_state PORTAL VERIFIER GENESIS_KECCAK
  mkdir -p "$RUN/dump" "$RUN/proofs" "$RUN/zone-data"
  cmd=("$ZONE_BIN" node --chain "$RUN/genesis/genesis.json" --l1.rpc-url "$L1_WS" --l1.portal-address "$PORTAL"
       --http --http.addr 127.0.0.1 --http.port "$ZONE_HTTP_PORT" --http.api all --datadir "$RUN/zone-data"
       --port 30319 --discovery.port 30319 --authrpc.port 18571 --redacted-rpc.port 18572
       --sequencer --sequencer.enable-prover --zone.batch-interval-blocks 1000000)
  say "env OWN_ZONE_ANCHOR_SAFETY_MARGIN=$ANCHOR_SAFETY_MARGIN OWN_ZONE_PROOF_DIR=$RUN/proofs ZONE_SPF_DUMP_DIR=$RUN/dump OWN_ZONE_VERIFIER_CONFIG=sworn-sp1-groth16-v1 OWN_ZONE_FORCE_T13_SETTLEMENT=1 OWN_ZONE_SINGLE_PROOFS=1"
  say "${cmd[*]} --sequencer-key-file <(fifo: \$OWN_ZONE_SEQUENCER_KEY)"
  say "prover: DUMP=$RUN/dump PROOF_DIR=$RUN/proofs VERIFIER=$VERIFIER DEST_CHAIN=$L1_CHAIN_ID GENESIS_HASH=$GENESIS_KECCAK $here/prover-watch.sh"
  [ -n "$SEND" ] || { say "PRINT ONLY: the node submits batches and processes withdrawals with the sequencer key. Re-run with --send."; exit 0; }
  [ -n "${OWN_ZONE_SEQUENCER_KEY:-}" ] || die "sequencer key missing"
  ( OWN_ZONE_ANCHOR_SAFETY_MARGIN="$ANCHOR_SAFETY_MARGIN" OWN_ZONE_PROOF_DIR="$RUN/proofs" ZONE_SPF_DUMP_DIR="$RUN/dump" OWN_ZONE_VERIFIER_CONFIG=sworn-sp1-groth16-v1 \
    OWN_ZONE_FORCE_T13_SETTLEMENT=1 OWN_ZONE_SINGLE_PROOFS=1 RUST_LOG="${RUST_LOG:-info}" \
    exec "${cmd[@]}" --sequencer-key-file <(printf '%s' "$OWN_ZONE_SEQUENCER_KEY") ) > "$RUN/zone.log" 2>&1 &
  echo $! > "$RUN/zone.pid"
  ( DUMP="$RUN/dump" PROOF_DIR="$RUN/proofs" VERIFIER="$VERIFIER" DEST_CHAIN="$L1_CHAIN_ID" GENESIS_HASH="$GENESIS_KECCAK" \
    HOST="$HOST" RUNNER="$RUNNER" ELF="$ELF" MAX_PROOFS="${MAX_PROOFS:-$([ -n "${DEPOSIT_AFTER_START:-}" ] && echo 4 || echo 3)}" \
    exec "$here/prover-watch.sh" ) > "$RUN/prover.log" 2>&1 &
  echo $! > "$RUN/prover.pid"
  for _ in $(seq 1 120); do cast block-number --rpc-url "$ZONE_HTTP" >/dev/null 2>&1 && break; sleep 1; done
  say "zone node pid $(cat "$RUN/zone.pid"), prover pid $(cat "$RUN/prover.pid"), zone head $(cast block-number --rpc-url "$ZONE_HTTP" 2>/dev/null || echo '?')"
  setstate STARTED_AT "$(date -u +%s)" ;;

deposit)
  need_state PORTAL
  say "approve($PORTAL, $DEPOSIT_AMOUNT) + encrypted deposit of $DEPOSIT_AMOUNT pathUSD to $USERADDR on the zone"
  [ -n "$SEND" ] || { say "PRINT ONLY: cast send approve; PRIVATE_KEY=\$OWN_ZONE_USER_KEY $XTASK deposit --l1-rpc-url $L1_HTTP --portal $PORTAL --amount $DEPOSIT_AMOUNT --to $USERADDR --zone-rpc-url $ZONE_HTTP"; exit 0; }
  send_l1 OWN_ZONE_USER_KEY "$PATH_USD" "approve(address,uint256)" "$PORTAL" "$DEPOSIT_AMOUNT"
  wait_args=(--zone-rpc-url "$ZONE_HTTP"); [ -n "${NO_WAIT:-}" ] && wait_args=()
  PRIVATE_KEY="$OWN_ZONE_USER_KEY" "$XTASK" deposit --l1-rpc-url "$L1_HTTP" --portal "$PORTAL" --amount "$DEPOSIT_AMOUNT" \
    --to "$USERADDR" ${wait_args[@]+"${wait_args[@]}"} 2>&1 | grep -v -i "private" | tee -a "$RUN/txs.log"
  [ -n "${NO_WAIT:-}" ] || say "zone balance $(cast call --from "$USERADDR" "$PATH_USD" 'balanceOf(address)(uint256)' "$USERADDR" --rpc-url "$ZONE_HTTP")"
  setstate DEPOSITED_AT "$(date -u +%s)" ;;

withdraw)
  OUTBOX=0x1c00000000000000000000000000000000000002
  say "on the zone: approve(ZoneOutbox) + requestWithdrawal($PATH_USD, $USERADDR, $WITHDRAW_AMOUNT, 0, 0, $USERADDR, 0x, 0x)"
  [ -n "$SEND" ] || { say "PRINT ONLY"; exit 0; }
  for _ in $(seq 1 180); do
    bal=$(cast call --from "$USERADDR" "$PATH_USD" 'balanceOf(address)(uint256)' "$USERADDR" --rpc-url "$ZONE_HTTP" 2>/dev/null | cut -d' ' -f1 || echo 0)
    [ "${bal:-0}" -ge "$WITHDRAW_AMOUNT" ] 2>/dev/null && break; sleep 1; done
  say "zone balance $bal (deposit minted)"
  if [ "${WITHDRAW_AFTER_BLOCKS:-0}" -gt 0 ]; then   # optional: keep the withdrawal out of the deposit's batch
    h=$(cast block-number --rpc-url "$ZONE_HTTP"); until [ "$(cast block-number --rpc-url "$ZONE_HTTP")" -ge $((h + WITHDRAW_AFTER_BLOCKS)) ]; do sleep 1; done
  fi
  cast send --rpc-url "$ZONE_HTTP" --private-key "$OWN_ZONE_USER_KEY" --gas-limit 500000 --json "$PATH_USD" "approve(address,uint256)" "$OUTBOX" "$WITHDRAW_AMOUNT" | python3 -c "import json,sys;r=json.load(sys.stdin);print('zone approve',r['status'])"
  cast send --rpc-url "$ZONE_HTTP" --private-key "$OWN_ZONE_USER_KEY" --gas-limit 10000000 --json "$OUTBOX" \
    "requestWithdrawal(address,address,uint128,bytes32,uint64,address,bytes,bytes)" "$PATH_USD" "$USERADDR" "$WITHDRAW_AMOUNT" \
    0x0000000000000000000000000000000000000000000000000000000000000000 0 "$USERADDR" 0x 0x \
    | python3 -c "import json,sys;r=json.load(sys.stdin);print('zone requestWithdrawal',r['status'],'block',int(r['blockNumber'],16))" | tee -a "$RUN/txs.log"
  setstate L1_BALANCE_BEFORE_WITHDRAW "$(cast call "$PATH_USD" 'balanceOf(address)(uint256)' "$USERADDR" --rpc-url "$L1_HTTP" | cut -d' ' -f1)"
  setstate WITHDRAWN_AT "$(date -u +%s)" ;;

status)
  need_state PORTAL
  head=$(cast block-number --rpc-url "$L1_HTTP")
  say "L1 head $head; portal withdrawalBatchIndex $(cast call "$PORTAL" 'withdrawalBatchIndex()(uint64)' --rpc-url "$L1_HTTP"), zoneHeight $(cast call "$PORTAL" 'zoneHeight()(uint256)' --rpc-url "$L1_HTTP"), queue head/tail $(cast call "$PORTAL" 'withdrawalQueueHead()(uint256)' --rpc-url "$L1_HTTP")/$(cast call "$PORTAL" 'withdrawalQueueTail()(uint256)' --rpc-url "$L1_HTTP")"
  grep -E "Submitting batch to ZonePortal|Batch successfully submitted|Prover validated|could not complete|OWN-ZONE" "$RUN/zone.log" 2>/dev/null \
    | sed -E 's/\x1b\[[0-9;]*m//g' | grep -oE "^[0-9T:.-]+Z|anchor_block_number=[0-9]+|current_l1_block=[0-9]+|last_zone_block=[0-9]+|zone_from=[0-9]+ zone_to=[0-9]+|Batch successfully submitted|Prover validated batch|could not complete|OWN-ZONE[^,]*" | paste -sd' ' - | sed 's/ 20[0-9][0-9]-/\n20/g' | tail -12 || true
  tail -4 "$RUN/prover.log" 2>/dev/null || true
  [ -n "${L1_BALANCE_BEFORE_WITHDRAW:-}" ] && [ -n "$USERADDR" ] && say "user L1 pathUSD $(cast call "$PATH_USD" 'balanceOf(address)(uint256)' "$USERADDR" --rpc-url "$L1_HTTP" | cut -d' ' -f1) (before withdraw: $L1_BALANCE_BEFORE_WITHDRAW)"
  say "WithdrawalProcessed logs: $(cast logs --from-block "${ANCHOR:-0}" --address "$PORTAL" 'WithdrawalProcessed(address,bytes32,address,uint128,bool)' --rpc-url "$L1_HTTP" 2>/dev/null | grep -c transactionHash || true)" ;;

forged-batch)
  # A malicious sequencer submits a forged batch (signed certificate, replayed real proof, made-up withdrawal
  # queue). Print-only: builds, signs locally and eth_calls it (must revert InvalidProof() from the verifier).
  # --send: sends it with a fixed gas limit; it reverts (status 0, gas paid, nothing changes), then check-tx proves
  # the revert came from the verifier and the portal's state is unchanged. See forged-batch.mjs.
  need_state PORTAL VERIFIER
  out="$RUN/forged-batch.json"
  node "$here/forged-batch.mjs" selfcheck
  L1_HTTP="$L1_HTTP" node "$here/forged-batch.mjs" build "$out"
  [ -n "$SEND" ] || { say "PRINT ONLY: cast send --rpc-url $L1_HTTP --private-key \$OWN_ZONE_SEQUENCER_KEY --gas-limit 2000000 $PORTAL <calldata in $out>  (reverts; changes nothing). Re-run with --send within ~1 h."; exit 0; }
  data=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['calldata'])" "$out")
  tx=$(cast send --rpc-url "$L1_HTTP" --private-key "$OWN_ZONE_SEQUENCER_KEY" --gas-limit 2000000 --async "$PORTAL" "$data")
  [[ "$tx" =~ ^0x[0-9a-fA-F]{64}$ ]] || die "send failed: $tx"
  say "sent $tx; waiting for its receipt"
  for _ in $(seq 1 60); do cast receipt "$tx" --rpc-url "$L1_HTTP" >/dev/null 2>&1 && break; sleep 2; done
  echo "forged-batch tx $tx" >> "$RUN/txs.log"
  node "$here/forged-batch.mjs" check-tx "$out" "$tx" ;;

stop)
  for p in zone prover; do [ -f "$RUN/$p.pid" ] && kill "$(cat "$RUN/$p.pid")" 2>/dev/null || true; done
  pkill -f "tempo-zone node --chain $RUN/" 2>/dev/null || true
  pkill -f "DUMP=$RUN/dump" 2>/dev/null || true; pkill -f "prover-watch.sh" 2>/dev/null || true
  pkill -f "spike-runner .*$RUN/proofs" 2>/dev/null || true
  for _ in $(seq 1 20); do pgrep -f "tempo-zone node --chain $RUN/" >/dev/null || break; sleep 1; done
  pkill -9 -f "tempo-zone node --chain $RUN/" 2>/dev/null || true
  sleep 1; pgrep -f "tempo-zone node --chain $RUN/" >/dev/null && die "zone node still running" || say "stopped" ;;

setup)
  # genesis -> deploy-verifier -> deploy-portal -> initialize -> encryption-key -> deposit -> start -> withdraw.
  # Why one command: the zone node must start within ~250 L1 blocks (~2.5 min on Moderato) of the genesis
  # anchor, or the proof collector cannot fetch eth_getProof for the first catch-up blocks.
  [ -n "$SEND" ] || { say "PRINT ONLY: runs genesis, deploy-verifier, deploy-portal, initialize, encryption-key, deposit, start, withdraw with --send, back to back (~1-2 min). Then only 'status' until the withdrawal is paid."; exit 0; }
  t0=$(date +%s)
  "$0" genesis
  for s in deploy-verifier deploy-portal initialize encryption-key; do "$0" "$s" --send; done
  # Deposit BEFORE the node starts: the zone then processes it during its first catch-up blocks, so
  # the deposit lands in a tiny batch (a long gap before the deposit means a big, slow batch).
  if [ -n "${DEPOSIT_AFTER_START:-}" ]; then
    # Variant: separate setup / deposit / withdrawal batches (3 proofs instead of 2).
    "$0" start --send
    NO_WAIT=1 "$0" deposit --send
  else
    NO_WAIT=1 "$0" deposit --send
    "$0" start --send
  fi
  "$0" withdraw --send
  . "$STATE"
  say "setup done in $(( $(date +%s) - t0 )) s; L1 head $(cast block-number --rpc-url "$L1_HTTP") vs anchor $ANCHOR (must stay well under 250 at node start)" ;;

*) sed -n '2,20p' "$0"; exit 2 ;;
esac
