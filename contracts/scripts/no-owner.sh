#!/usr/bin/env bash
# no-owner.sh — fails (exit 1) if Sworn gains any privileged or escape-hatch surface (spec §3.3, AC-9):
# owner/admin/roles, pause, upgrade/proxy/initializer, setters, a constructor (parameters must be
# constants), selfdestruct, delegatecall/callcode, or ANY fallback/receive (Sworn needs neither, so
# none is allowed — stricter than "one that moves funds").
#
#   scripts/no-owner.sh                 # checks src/Sworn.sol: source scan + compiled-ABI scan
#   scripts/no-owner.sh path/to/X.sol   # source scan of another file (used by no-owner-selftest.sh)
#
#   scripts/no-owner.sh --zone-verifier [--code 0x<runtime bytecode>]
#       Spec 003: SwornZoneVerifier. Same source and ABI scans, except that ONE constructor is allowed
#       because the spec makes its parameters immutables; in exchange the RUNTIME BYTECODE (compiled, or
#       the deployed code passed with --code, e.g. from `cast code`) must contain no SSTORE, SLOAD,
#       TSTORE, TLOAD, CALL, CALLCODE, DELEGATECALL, CREATE, CREATE2 or SELFDESTRUCT: no mutable state
#       at all, so the constructor can only have set immutables, and the only outbound call is the
#       STATICCALL to the SP1 verifier.
set -euo pipefail
cd "$(dirname "$0")/.."
zone=0; code_hex=""
if [ "${1:-}" = "--zone-verifier" ]; then
  zone=1; shift
  if [ "${1:-}" = "--code" ]; then code_hex="${2:?--code needs 0x<hex>}"; shift 2; fi
  set -- src/SwornZoneVerifier.sol
  contract=SwornZoneVerifier
else
  contract=Sworn
fi
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
if [ "$zone" -eq 1 ]; then
  n=$(printf '%s\n' "$code" | grep -cE '\bconstructor[[:space:]]*\(' || true)
  [ "$n" -le 1 ] || { echo "no-owner: FORBIDDEN more than one constructor in $target"; fail=1; }
else
  check "constructor"             '\bconstructor[[:space:]]*\('
fi
check "selfdestruct"            '\b(selfdestruct|suicide)\b'
check "delegatecall/callcode"   '\b(delegatecall|callcode)\b'
check "fallback/receive"        '(\bfallback[[:space:]]*\(|\breceive[[:space:]]*\(|function[[:space:]]*\()'
check "inline assembly"         '\bassembly\b'

# Compiled-ABI scan (only for the real contract): no fallback/receive entry, no suspicious names.
if [ -z "${1:-}" ] || [ "$zone" -eq 1 ]; then
  abi=$(forge inspect "$contract" abi --json 2>/dev/null || forge inspect "$contract" abi)
  if printf '%s' "$abi" | python3 -c '
import json, re, sys
abi = json.load(sys.stdin)
bad = [e for e in abi if e.get("type") in ("fallback", "receive")]
bad += [e for e in abi if e.get("type") == "function" and re.search(r"(?i)owner|admin|pause|upgrade|initiali|^set[A-Z_]|role|kill|destruct|rescue|sweep", e["name"])]
for e in bad: print("no-owner: FORBIDDEN ABI entry:", e.get("type"), e.get("name", ""))
sys.exit(1 if bad else 0)'; then :; else fail=1; fi
fi

# Runtime-bytecode opcode scan (zone verifier only).
if [ "$zone" -eq 1 ]; then
  if [ -z "$code_hex" ]; then code_hex=$(forge inspect "$contract" deployedBytecode); src_label="compiled"; else src_label="given"; fi
  if python3 - "$code_hex" "$src_label" <<'PY'; then :; else fail=1; fi
import sys
h, label = sys.argv[1], sys.argv[2]
code = bytes.fromhex(h[2:] if h.startswith("0x") else h)
if len(code) < 2:
    print("no-owner: no runtime bytecode"); sys.exit(1)
meta = int.from_bytes(code[-2:], "big") + 2          # strip the CBOR metadata trailer
if meta < len(code): code = code[:-meta]
bad = {0x55: "SSTORE", 0x54: "SLOAD", 0x5d: "TSTORE", 0x5c: "TLOAD", 0xf1: "CALL", 0xf2: "CALLCODE",
       0xf4: "DELEGATECALL", 0xf0: "CREATE", 0xf5: "CREATE2", 0xff: "SELFDESTRUCT"}
hits, i, seen_static = [], 0, 0
while i < len(code):
    op = code[i]
    if op in bad: hits.append((i, bad[op]))
    if op == 0xfa: seen_static += 1
    i += 1 + (op - 0x5f if 0x60 <= op <= 0x7f else 0)   # skip PUSH1..PUSH32 data
for off, name in hits: print(f"no-owner: FORBIDDEN opcode {name} at runtime offset {off}")
print(f"no-owner: {label} runtime bytecode {len(code)} bytes (sans metadata), STATICCALL x{seen_static}, forbidden opcodes {len(hits)}")
sys.exit(1 if hits else 0)
PY
fi

if [ "$fail" -ne 0 ]; then echo "no-owner: FAIL ($target)"; exit 1; fi
echo "no-owner: OK ($target)"
