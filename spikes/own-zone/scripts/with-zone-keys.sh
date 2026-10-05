#!/usr/bin/env bash
# Run one command with the own-zone keys in its environment only (same pattern and password file as
# scripts/with-keys.sh). Three DEDICATED keystores, created by the founder by hand:
#   ~/.foundry/keystores/sworn-zone-deployer   fresh key, used ONLY for: verifier deploy, portal deploy, initialize
#   ~/.foundry/keystores/sworn-zone-sequencer  zone sequencer = L1 batch signer = deposit-decryption (ECIES) key
#   ~/.foundry/keystores/sworn-zone-user       demo depositor/withdrawer
# e.g.  cast wallet new ~/.foundry/keystores sworn-zone-deployer   (password = the one in ~/.config/sworn/keystore.pw)
# Nothing here prints a key.
set -euo pipefail
PW_FILE=${SWORN_PW_FILE:-$HOME/.config/sworn/keystore.pw}
[ -f "$PW_FILE" ] || { echo "with-zone-keys: missing $PW_FILE" >&2; exit 1; }
case "$(stat -f %Lp "$PW_FILE" 2>/dev/null || stat -c %a "$PW_FILE")" in 600|400) ;; *) echo "with-zone-keys: $PW_FILE must be chmod 600" >&2; exit 1 ;; esac
load() {
  local v
  v=$(CAST_UNSAFE_PASSWORD="$(cat "$PW_FILE")" cast wallet decrypt-keystore "$1" 2>/dev/null | awk '{print $NF}') || true
  [[ "$v" =~ ^0x[0-9a-fA-F]{64}$ ]] || { echo "with-zone-keys: could not decrypt keystore '$1'" >&2; exit 1; }
  printf '%s' "$v"
}
OWN_ZONE_DEPLOYER_KEY=$(load sworn-zone-deployer);   export OWN_ZONE_DEPLOYER_KEY
OWN_ZONE_SEQUENCER_KEY=$(load sworn-zone-sequencer); export OWN_ZONE_SEQUENCER_KEY
OWN_ZONE_USER_KEY=$(load sworn-zone-user);           export OWN_ZONE_USER_KEY
exec "$@"
