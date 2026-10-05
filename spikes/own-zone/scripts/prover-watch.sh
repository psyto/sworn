#!/usr/bin/env bash
# Sworn prover for an own Zone (spike). Watches the sequencer's witness dumps (ZONE_SPF_DUMP_DIR) and,
# for each validated batch in zone-block order: cuts the genesis artifact (must equal the pinned hash),
# builds the guest input for VERIFIER on DEST_CHAIN, runs the native host, proves Groth16 with the SP1
# runner, and drops "<nextBlockHash>-<anchorBlock>.proof" (hex) into PROOF_DIR, where the patched sequencer picks it up.
#
#   DUMP=… PROOF_DIR=… VERIFIER=0x… DEST_CHAIN=42431 GENESIS_HASH=0x… \
#   HOST=…/sworn-zone-host RUNNER=…/spike-runner ELF=…/zone-spf-guest  prover-watch.sh
# MODE=groth16 (default) or MODE=execute (zkVM execute only, writes no proof). MAX_PROOFS=N stops after N proofs.
set -euo pipefail
: "${DUMP:?}" "${PROOF_DIR:?}" "${VERIFIER:?}" "${DEST_CHAIN:?}" "${GENESIS_HASH:?}" "${HOST:?}" "${RUNNER:?}" "${ELF:?}"
MODE="${MODE:-groth16}"
mkdir -p "$PROOF_DIR" "$PROOF_DIR/work"
log() { echo "[prover-watch $(date -u +%H:%M:%S)] $*"; }
log "watching $DUMP (verifier $VERIFIER, chain $DEST_CHAIN, mode $MODE)"
while true; do
  # Stop after the demo's batches: later automatic boundaries are ever-growing batches nobody needs.
  if [ -n "${MAX_PROOFS:-}" ] && [ "$(ls "$PROOF_DIR"/work/*.done 2>/dev/null | wc -l | tr -d ' ')" -ge "$MAX_PROOFS" ]; then
    log "MAX_PROOFS=$MAX_PROOFS reached; not proving later batches"; exit 0; fi
  for case in $(python3 -c "import glob,re,sys;print('\n'.join(sorted(glob.glob(sys.argv[1]+'/zone*-blocks*.case.json'),key=lambda p:int(re.search(r'blocks(\d+)-',p).group(1)))))" "$DUMP"); do
    base="${case%.case.json}"; name="$(basename "$base")"
    [ -f "$base.native-output.json" ] || continue          # the sequencer's own SPF run must have passed
    # The proof binds the anchor; a re-prepared batch (new anchor) overwrites the case and needs a new proof.
    anchor=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['witness']['publicInputs']['anchorBlockNumber'])" "$case") || continue
    [ -f "$PROOF_DIR/work/$name-a$anchor.done" ] && continue
    next=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['blockTransition']['nextBlockHash'])" "$base.native-output.json")
    name="$name-a$anchor"; w="$PROOF_DIR/work/$name"; mkdir -p "$w"
    got=$("$HOST" extract-genesis "$case" "$w/genesis.json" | sed -E 's/.*keccak256 //')
    [ "$got" = "$GENESIS_HASH" ] || { log "$name: genesis $got != pinned $GENESIS_HASH"; exit 1; }
    "$HOST" input "$case" "$w/genesis.json" "$VERIFIER" "$DEST_CHAIN" "$w/input.bin" "$w/summary.json" > "$w/host.log"
    log "$name: native host OK, digest $(python3 -c "import json;print(json.load(open('$w/summary.json'))['digest'])"); proving ($MODE)"
    start=$(date +%s)
    if [ "$MODE" = groth16 ]; then
      "$RUNNER" "$ELF" "$w/input.bin" groth16 "$w/fixture.json" > "$w/prove.log" 2>&1
      grep -q "publicValues match native host: PASS" "$w/prove.log" || { log "$name: prove failed"; tail -5 "$w/prove.log"; exit 1; }
      python3 -c "import json;print(json.load(open('$w/fixture.json'))['proof'])" > "$PROOF_DIR/$next-$anchor.proof.tmp"
      mv "$PROOF_DIR/$next-$anchor.proof.tmp" "$PROOF_DIR/$next-$anchor.proof"
    else
      "$RUNNER" "$ELF" "$w/input.bin" execute > "$w/exec.log" 2>&1
    fi
    log "$name: done in $(( $(date +%s) - start )) s -> $next"
    touch "$PROOF_DIR/work/$name.done"
  done
  sleep 3
done
