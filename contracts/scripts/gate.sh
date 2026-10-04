#!/usr/bin/env bash
# Contract gate: no-owner on Sworn and on SwornZoneVerifier (+ the planted-variant selftest), then the
# required-test-set check (which also fails on any other failing test, e.g. SwornZoneVerifier.t.sol).
set -euo pipefail
cd "$(dirname "$0")/.."
scripts/no-owner.sh
scripts/no-owner.sh --zone-verifier   # spec 003
scripts/no-owner-selftest.sh
scripts/check-tests.sh
