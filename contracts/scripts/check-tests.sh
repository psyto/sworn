#!/usr/bin/env bash
# Gate (spec §6): assert the SET of required test ids exists and passed. A filter that matches
# nothing exits 0 in forge, so the names are checked explicitly here.
# The two fixture tests may be Skipped only while ../out/fixtures/ has no proof; they are reported.
set -euo pipefail
cd "$(dirname "$0")/.."
json=$(forge test --json 2>/dev/null)
REQUIRED="
SwornTest.test_AC3_pays_success
SwornTest.test_AC3_pays_returnDataHash
SwornTest.test_AC3_pays_gasUsed
SwornTest.test_AC3_pays_feeCharged
SwornTest.test_AC3_pays_receiver
SwornTest.test_AC3_pays_receiverBefore
SwornTest.test_AC3_pays_receiverAfter
SwornTest.test_AC4_reverts_correct_answer
SwornTest.test_AC4_reverts_pvq_chainId
SwornTest.test_AC4_reverts_pvq_blockNumber
SwornTest.test_AC4_reverts_pvq_blockHash
SwornTest.test_AC4_reverts_pvq_from
SwornTest.test_AC4_reverts_pvq_token
SwornTest.test_AC4_reverts_pvq_data
SwornTest.test_AC4_reverts_pvq_feeToken
SwornTest.test_AC4_reverts_pvq_gasLimit
SwornTest.test_AC4_reverts_different_blockHash
SwornTest.test_AC4_reverts_pv_blockHash_ne_q_blockHash
SwornTest.test_AC4_reverts_no_reservation
SwornTest.test_AC4_reverts_expired
SwornTest.test_AC4_reverts_second_challenge
SwornTest.test_AC4_reverts_wrong_vkey
SwornTest.test_AC4_reverts_wrong_version
SwornTest.test_AC4_reverts_other_servers_reservation
SwornTest.test_AC5_reverts_unbonding
SwornTest.test_AC5_reverts_free_lt_coverage
SwornTest.test_AC5_reverts_block_older_than_MAX_AGE
SwornTest.test_AC5_reverts_block_is_current
SwornTest.test_AC5_reverts_blockHash_not_canonical
SwornTest.test_AC5_reverts_blockHash_unreadable
SwornTest.test_AC5_reverts_reused_digest
SwornTest.test_AC5_reverts_no_bond
SwornTest.test_AC5_accepts_transfer
SwornTest.test_AC5_accepts_transferWithMemo
SwornTest.test_AC5_accepts_zero_receiver_provable_failure
SwornTest.test_AC5_reverts_token_not_tip20
SwornTest.test_AC5_reverts_wrong_selector
SwornTest.test_AC5_reverts_wrong_length
SwornTest.test_AC5_reverts_dirty_address_word
SwornTest.test_AC5_reverts_virtual_receiver
SwornTest.test_AC5_reverts_receiver_is_sender
SwornTest.test_AC5_reverts_wrong_chain
SwornTest.test_AC6_withdraw_cannot_take_reserved
SwornTest.test_AC6_withdraw_reverts_before_delay
SwornTest.test_AC6_challenge_pays_during_unbond_delay
RealGroth16Test.test_REAL_groth16_fixture_verifies
RealGroth16Test.test_REAL_groth16_fixture_challenge_pays
SwornTest.test_EIP712_vector_matches_ethers
VendoredVerifierSmokeTest.test_REAL_vendored_verifier_accepts_real_v6_1_0_proof
"
FIXTURE="
RealGroth16Test.test_REAL_groth16_fixture_verifies
RealGroth16Test.test_REAL_groth16_fixture_challenge_pays
"
# Spec 003: the zone real-proof test needs the Moderato fixture of the redeployed (sworn-sp1-groth16-v1)
# verifier. Until scripts/zone-prove.sh <address> writes test/vectors/zone-hardfork-sworn-sp1-groth16-v1.json it is SKIPPED and
# reported as PENDING here; it is not one of the required ids and is never counted as passed.
PENDING="
SwornZoneVerifierTest.test_ACZ4_REAL_groth16_moderato_all_cases
"
REQUIRED="$REQUIRED" FIXTURE="$FIXTURE" PENDING="$PENDING" python3 -c '
import json, os, sys
d = json.loads(sys.stdin.read())
got = {}
for suite, v in d.items():
    for t, r in v["test_results"].items():
        got[suite.split(":")[-1] + "." + t.split("(")[0]] = r["status"]
bad = 0
for n in os.environ["REQUIRED"].split():
    s = got.get(n, "MISSING")
    if s != "Success": print("FAIL", n, s); bad += 1
for n in os.environ["FIXTURE"].split():
    s = got.get(n, "MISSING")
    if s == "Skipped": print("SKIPPED (no fixture / placeholders):", n)
    elif s != "Success": print("FAIL", n, s); bad += 1
for n in os.environ["PENDING"].split():
    s = got.get(n, "MISSING")
    if s == "Skipped": print("PENDING (skipped, not counted):", n)
    elif s == "Success": print("ran (fixture present):", n)
    else: print("FAIL", n, s); bad += 1
others = [k for k, s in got.items() if s not in ("Success", "Skipped")]
for k in others: print("FAIL", k, got[k]); bad += 1
names = os.environ["REQUIRED"].split()
ok = sum(1 for n in names if got.get(n) == "Success")
print("required %d / passed %d; total tests run %d" % (len(names), ok, len(got)))
sys.exit(1 if bad else 0)
' <<<"$json"
