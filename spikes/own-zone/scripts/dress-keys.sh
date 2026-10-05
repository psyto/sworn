#!/usr/bin/env bash
# DRESS REHEARSAL ONLY (local L1): public test-mnemonic keys in place of with-zone-keys.sh.
set -euo pipefail
M="test test test test test test test test test test test junk"
OWN_ZONE_DEPLOYER_KEY=$(cast wallet private-key --mnemonic "$M" --mnemonic-index 5);  export OWN_ZONE_DEPLOYER_KEY
OWN_ZONE_SEQUENCER_KEY=$(cast wallet private-key --mnemonic "$M" --mnemonic-index 6); export OWN_ZONE_SEQUENCER_KEY
OWN_ZONE_USER_KEY=$(cast wallet private-key --mnemonic "$M" --mnemonic-index 7);      export OWN_ZONE_USER_KEY
exec "$@"
