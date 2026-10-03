#!/usr/bin/env bash
# Contract gate: no-owner (+ its planted-variant selftest), then the required-test-set check.
set -euo pipefail
cd "$(dirname "$0")/.."
scripts/no-owner.sh
scripts/no-owner-selftest.sh
scripts/check-tests.sh
