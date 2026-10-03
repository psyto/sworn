#!/usr/bin/env bash
# Run one command with Sworn's Moderato keys loaded into that command's environment only.
#
#   scripts/with-keys.sh <command> [args…]
#
# Keys live in Foundry's encrypted keystores (~/.foundry/keystores/sworn-{deployer,honest,
# dishonest,client}); the keystore password lives in ~/.config/sworn/keystore.pw (chmod 600). Both
# are created by the founder by hand. Nothing here prints a key: decrypted values only ever exist in
# this process's environment, are checked for shape, and die with it.
set -euo pipefail
PW_FILE=${SWORN_PW_FILE:-$HOME/.config/sworn/keystore.pw}
[ -f "$PW_FILE" ] || { echo "with-keys: missing $PW_FILE" >&2; exit 1; }
case "$(stat -f %Lp "$PW_FILE" 2>/dev/null || stat -c %a "$PW_FILE")" in
  600|400) ;;
  *) echo "with-keys: $PW_FILE must be chmod 600" >&2; exit 1 ;;
esac

load() {
  local v
  v=$(CAST_UNSAFE_PASSWORD="$(cat "$PW_FILE")" cast wallet decrypt-keystore "$1" 2>/dev/null | awk '{print $NF}') || true
  [[ "$v" =~ ^0x[0-9a-fA-F]{64}$ ]] || { echo "with-keys: could not decrypt keystore '$1'" >&2; exit 1; }
  printf '%s' "$v"
}

SWORN_DEPLOYER_KEY=$(load sworn-deployer);   export SWORN_DEPLOYER_KEY
SWORN_CHALLENGER_KEY=$SWORN_DEPLOYER_KEY;    export SWORN_CHALLENGER_KEY
SWORN_HONEST_KEY=$(load sworn-honest);       export SWORN_HONEST_KEY
SWORN_DISHONEST_KEY=$(load sworn-dishonest); export SWORN_DISHONEST_KEY
DEMO_CLIENT_KEY=$(load sworn-client);        export DEMO_CLIENT_KEY

exec "$@"
