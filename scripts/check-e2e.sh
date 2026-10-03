#!/usr/bin/env bash
# Gate for spec 002 S-1..S-4: asserts that EVERY required check id printed `CHECK <id> PASS`, that no
# check printed FAIL, and that the Rust S-4 unit tests ran and passed. A run that prints nothing
# (zero matches) fails — the set is checked, not the exit code alone.
#   scripts/check-e2e.sh               run scripts/e2e.sh (needs the env keys) and gate its output
#   scripts/check-e2e.sh --log FILE    gate an existing e2e log (no chain needed)
set -uo pipefail
cd "$(dirname "$0")/.."
LOG=$(mktemp)
if [ "${1:-}" = "--log" ]; then cp "$2" "$LOG"; else scripts/e2e.sh 2>&1 | tee "$LOG"; fi
RT=$(mktemp)
cargo test --release -p sworn-answerer 2>&1 > "$RT"
REQUIRED=(
  SETUP.verifier SETUP.vkey SETUP.receivePolicy SETUP.bond
  S-1.mpp S-1.reserved S-1.sdkVerify S-1.witness
  S-2.dishonestReserved S-2.witness S-2.challengePays S-2.slashedState S-2.honestReverts
  S-3.wrongClient S-3.digestMismatch S-3.otherContract S-3.unknownVkey S-3.unknownVkeyPinned
  S-3.missingReservation S-3.r33ReceiverIsSender S-3.r33RefusedBeforePaying S-3.r33NotTip20 S-3.controlAccepts
  S-4.matchingScheduleAnswers S-4.liveDriftRefused
)
RUST=(
  tests::s4_accepts_identical_schedule tests::s4_refuses_changed_activation tests::s4_refuses_extra_live_fork
  tests::s4_refuses_missing_live_fork tests::s4_refuses_activation_within_max_age
)
fail=0
for id in "${REQUIRED[@]}"; do
  if grep -qE "^CHECK $id PASS( |$)" "$LOG"; then echo "ok   $id"; else echo "MISSING/FAILED $id"; fail=1; fi
done
for t in "${RUST[@]}"; do
  if grep -qE "^test $t \.\.\. ok$" "$RT"; then echo "ok   $t"; else echo "MISSING/FAILED $t"; fail=1; fi
done
if grep -qE "^CHECK [^ ]+ FAIL" "$LOG"; then echo "a check FAILED:"; grep -E "^CHECK [^ ]+ FAIL" "$LOG"; fail=1; fi
echo "required: $(( ${#REQUIRED[@]} + ${#RUST[@]} ))  verdict: $([ $fail = 0 ] && echo PASS || echo FAIL)"
exit $fail
