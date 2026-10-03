#!/usr/bin/env bash
# no-owner.sh — fails (exit 1) if Sworn gains any privileged or escape-hatch surface (spec §3.3, AC-9):
# owner/admin/roles, pause, upgrade/proxy/initializer, setters, a constructor (parameters must be
# constants), selfdestruct, delegatecall/callcode, or ANY fallback/receive (Sworn needs neither, so
# none is allowed — stricter than "one that moves funds").
#
#   scripts/no-owner.sh                 # checks src/Sworn.sol: source scan + compiled-ABI scan
#   scripts/no-owner.sh path/to/X.sol   # source scan of another file (used by no-owner-selftest.sh)
set -euo pipefail
cd "$(dirname "$0")/.."
target="${1:-src/Sworn.sol}"
[ -f "$target" ] || { echo "no-owner: $target not found" >&2; exit 2; }

# Strip comments and string literals so prose like "no owner" cannot trip (or hide) anything.
code=$(perl -0777 -pe 's{/\*.*?\*/}{}gs; s{//[^\n]*}{}g; s{"(?:\\.|[^"\\])*"}{""}g' "$target")

fail=0
check() { # name, extended regex
  local hits
  hits=$(printf '%s\n' "$code" | grep -nE "$2" || true)
  if [ -n "$hits" ]; then echo "no-owner: FORBIDDEN $1 in $target:"; printf '%s\n' "$hits" | sed 's/^/    /'; fail=1; fi
}
check "owner/admin/role"        '\b([A-Za-z_]*[Oo]wner[A-Za-z_]*|[A-Za-z_]*[Aa]dmin[A-Za-z_]*|AccessControl|[A-Za-z_]*[Rr]ole[A-Za-z_]*|onlyOwner|governance|guardian)\b'
check "pause"                   '\b[A-Za-z_]*([Pp]ause|[Pp]ausable)[A-Za-z_]*\b'
check "upgrade/proxy/init"      '\b([A-Za-z_]*[Uu]pgrade[A-Za-z_]*|UUPS[A-Za-z_]*|[A-Za-z_]*Proxy[A-Za-z_]*|initialize[A-Za-z_]*|implementation)\b'
check "setter"                  '\bfunction[[:space:]]+set[A-Z_][A-Za-z0-9_]*'
check "constructor"             '\bconstructor[[:space:]]*\('
check "selfdestruct"            '\b(selfdestruct|suicide)\b'
check "delegatecall/callcode"   '\b(delegatecall|callcode)\b'
check "fallback/receive"        '(\bfallback[[:space:]]*\(|\breceive[[:space:]]*\(|function[[:space:]]*\()'
check "inline assembly"         '\bassembly\b'

# Compiled-ABI scan (only for the real contract): no fallback/receive entry, no suspicious names.
if [ -z "${1:-}" ]; then
  abi=$(forge inspect Sworn abi --json 2>/dev/null || forge inspect Sworn abi)
  if printf '%s' "$abi" | python3 -c '
import json, re, sys
abi = json.load(sys.stdin)
bad = [e for e in abi if e.get("type") in ("fallback", "receive")]
bad += [e for e in abi if e.get("type") == "function" and re.search(r"(?i)owner|admin|pause|upgrade|initiali|^set[A-Z_]|role|kill|destruct|rescue|sweep", e["name"])]
for e in bad: print("no-owner: FORBIDDEN ABI entry:", e.get("type"), e.get("name", ""))
sys.exit(1 if bad else 0)'; then :; else fail=1; fi
fi

if [ "$fail" -ne 0 ]; then echo "no-owner: FAIL ($target)"; exit 1; fi
echo "no-owner: OK ($target)"
