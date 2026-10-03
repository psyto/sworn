#!/usr/bin/env bash
# Runs the Rust test suites and asserts that EVERY required test name ran and passed.
# (A filter matching zero tests exits 0 — so we check the set, not the exit code alone.)
set -uo pipefail
cd "$(dirname "$0")/.."
LOG=$(mktemp)
cargo test --release -p spike-core -p spike-host 2>&1 | tee "$LOG" >/dev/null
REQUIRED=(
  tests::guest_version_is_keccak_of_label
  tests::encoding_round_trip
  tests::eip712_digest_matches_ethers_vector
  tests::abort_wrong_selector
  tests::abort_non_tip20_token
  tests::abort_chain_id
  tests::abort_virtual_receiver
  tests::abort_receiver_is_sender
  tests::abort_non_canonical_calldata
  tests::accepts_transfer_and_memo
  tests::abort_header_hash_mismatch
  tests::abort_blockhash_read
  tests::abort_missing_witness
  tests::hardfork_schedule_from_chainspec_genesis
  tests::tip20_balance_slot_matches_measured
  tests::invalid_by_fee_is_proven_not_aborted
  tests::witness_replays_to_expected_public_values
  tests::abort_bad_proof
  tests::abort_missing_slot
  tests::abort_block_number_mismatch
  tests::abort_block_hash_mismatch
)
fail=0
for t in "${REQUIRED[@]}"; do
  if grep -qE "^test $t \.\.\. ok$" "$LOG"; then echo "ok   $t"; else echo "MISSING/FAILED $t"; fail=1; fi
done
grep -E "^test result" "$LOG"
if grep -qE "^test .* FAILED$" "$LOG"; then echo "some test FAILED"; fail=1; fi
echo "required: ${#REQUIRED[@]}"
exit $fail
