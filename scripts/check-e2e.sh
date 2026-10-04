#!/usr/bin/env bash
# Gate for spec 002 S-1..S-4: asserts that EVERY required check id printed `CHECK <id> PASS`, that no
# check printed FAIL, and that the Rust S-4 unit tests ran and passed. A run that prints nothing
# (zero matches) fails — the set is checked, not the exit code alone.
# A challenger that died / timed out / lost its output is NOT a contract outcome: e2e prints
# `CHECK <id> HARNESS-FAILURE <reason>` (sdk/test/harness.ts) and this gate reports it as such, exit 3.
# Logs from before that existed (a FAIL whose challenger result was "no JSON output") are reclassified.
# Exit: 0 PASS; 1 a check FAILED or is missing; 3 only harness failures (re-run, says nothing about Sworn).
#   scripts/check-e2e.sh               run scripts/e2e.sh (needs the env keys) and gate its output
#   scripts/check-e2e.sh --log FILE    gate an existing e2e log (no chain needed)
#   scripts/check-e2e.sh --log FILE --set moderato   gate a scripts/moderato-run.sh log (Moderato
#                                      required set: no local deploy, no live-drift chain; adds
#                                      SETUP.chain / SETUP.codehash / SETUP.clientFunded)
set -uo pipefail
cd "$(dirname "$0")/.."
LOG=$(mktemp)
SET=local
if [ "${1:-}" = "--log" ]; then cp "$2" "$LOG"; [ "${3:-}" = "--set" ] && SET=${4:-local}; else scripts/e2e.sh 2>&1 | tee "$LOG"; fi
RT=$(mktemp)
cargo test --release -p sworn-answerer 2>&1 > "$RT"
REQUIRED=(
  SETUP.verifier SETUP.vkey SETUP.receivePolicy SETUP.bond
  S-1.mpp S-1.reserved S-1.sdkVerify S-1.witness S-1.honestNotOutOfGas
  S-2.dishonestReserved S-2.witness S-2.trueAnswerIsDiversion S-2.challengePays S-2.slashedState S-2.honestReverts
  S-3.wrongClient S-3.digestMismatch S-3.otherContract S-3.unknownVkey S-3.unknownVkeyPinned
  S-3.missingReservation S-3.r33ReceiverIsSender S-3.r33RefusedBeforePaying S-3.r33NotTip20 S-3.controlAccepts
  S-4.matchingScheduleAnswers S-4.liveDriftRefused
)
if [ "$SET" = moderato ]; then
  REQUIRED=("${REQUIRED[@]/S-4.liveDriftRefused}")
  REQUIRED=(${REQUIRED[@]} SETUP.chain SETUP.codehash SETUP.clientFunded)
elif [ "$SET" != local ]; then echo "unknown --set $SET"; exit 2; fi
RUST=(
  tests::s4_accepts_identical_schedule tests::s4_refuses_changed_activation tests::s4_refuses_extra_live_fork
  tests::s4_refuses_missing_live_fork tests::s4_refuses_activation_within_max_age
)
# Legacy logs: the challenger's output was lost but the check said FAIL ("did NOT revert"). Rewrite
# those FAIL lines as HARNESS-FAILURE when the matching challenger result has no JSON (never a PASS).
legacy() { # $1 check id, $2 result-line prefix
  if grep -qE "^ +[0-9:]+ $2: \{\"ok\":false,\"error\":\"no JSON output" "$LOG" && grep -qE "^CHECK $1 FAIL " "$LOG"; then
    sed -i.bak -E "s/^CHECK $1 FAIL (.*)$/CHECK $1 HARNESS-FAILURE (legacy log: challenger printed no JSON — process died or was killed; original line: \1)/" "$LOG"
  fi
}
legacy S-2.honestReverts 'honest challenge result'
legacy S-2.challengePays 'challenge result'
rm -f "$LOG.bak"
fail=0 harness=0
for id in "${REQUIRED[@]}"; do
  if grep -qE "^CHECK $id PASS( |$)" "$LOG"; then echo "ok   $id"
  elif grep -qE "^CHECK $id HARNESS-FAILURE( |$)" "$LOG"; then echo "HARNESS-FAILURE $id"; harness=1
  else echo "MISSING/FAILED $id"; fail=1; fi
done
for t in "${RUST[@]}"; do
  if grep -qE "^test $t \.\.\. ok$" "$RT"; then echo "ok   $t"; else echo "MISSING/FAILED $t"; fail=1; fi
done
if grep -qE "^CHECK [^ ]+ FAIL" "$LOG"; then echo "a check FAILED:"; grep -E "^CHECK [^ ]+ FAIL" "$LOG"; fail=1; fi
if grep -qE "^CHECK [^ ]+ HARNESS-FAILURE" "$LOG"; then
  harness=1
  echo "HARNESS-FAILURE: the challenger process died, timed out or lost its output — no contract outcome was observed for:"
  grep -E "^CHECK [^ ]+ HARNESS-FAILURE" "$LOG" | cut -c1-400
  echo "  this run proves nothing either way about Sworn for those checks; re-run them."
fi
if [ $fail = 0 ] && [ $harness = 0 ]; then verdict=PASS; elif [ $fail = 0 ]; then verdict=HARNESS-FAILURE; else verdict=FAIL; fi
echo "set: $SET  required: $(( ${#REQUIRED[@]} + ${#RUST[@]} ))  verdict: $verdict"
[ $fail = 1 ] && exit 1
[ $harness = 1 ] && exit 3
exit 0
