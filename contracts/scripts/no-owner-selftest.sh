#!/usr/bin/env bash
# AC-9: show no-owner.sh PASSES on src/Sworn.sol and FAILS on three planted variants.
# Each variant = the current src/Sworn.sol plus one planted backdoor, written to test/no-owner/
# with a .sol.planted extension so forge never compiles it and it never lives in src/.
set -uo pipefail
cd "$(dirname "$0")/.."
dir=test/no-owner
mkdir -p "$dir"

plant() { # name, snippet inserted before the contract's final closing brace
  python3 - "$1" "$2" <<'PY'
import sys
name, snippet = sys.argv[1], sys.argv[2]
src = open("src/Sworn.sol").read()
i = src.rstrip().rfind("}")
open(f"test/no-owner/{name}.sol.planted", "w").write(src[:i] + snippet + "\n" + src[i:])
PY
}

plant planted-owner '
    address public owner = msg.sender;
    function sweep(address to, uint256 amount) external {
        require(msg.sender == owner);
        _call(abi.encodeWithSelector(0xa9059cbb, to, amount));
    }'
plant planted-delegatecall '
    function execute(address target, bytes calldata data) external {
        (bool ok,) = target.delegatecall(data);
        require(ok);
    }'
plant planted-fallback '
    fallback() external {
        _call(abi.encodeWithSelector(0xa9059cbb, msg.sender, servers[msg.sender].locked));
    }'

status=0
if scripts/no-owner.sh >/dev/null; then echo "PASS (as required): src/Sworn.sol"; else echo "UNEXPECTED FAIL: src/Sworn.sol"; status=1; fi
for v in planted-owner planted-delegatecall planted-fallback; do
  out=$(scripts/no-owner.sh "$dir/$v.sol.planted" 2>&1); rc=$?
  if [ $rc -eq 1 ]; then echo "FAIL (as required): $v -> $(printf '%s\n' "$out" | grep FORBIDDEN | head -3 | sed 's/.*FORBIDDEN //; s/ in .*//' | paste -sd, -)"
  else echo "NOT CAUGHT: $v (rc=$rc)"; status=1; fi
done
# Spec 003 zone mode: SwornZoneVerifier passes; a runtime with storage writes and CALL (Sworn's own
# bytecode, passed as if it were the zone verifier's deployed code) is caught by the opcode scan.
if scripts/no-owner.sh --zone-verifier >/dev/null; then echo "PASS (as required): --zone-verifier src/SwornZoneVerifier.sol"; else echo "UNEXPECTED FAIL: --zone-verifier"; status=1; fi
out=$(scripts/no-owner.sh --zone-verifier --code "$(forge inspect Sworn deployedBytecode)" 2>&1); rc=$?
if [ $rc -eq 1 ] && printf '%s' "$out" | grep -q "FORBIDDEN opcode SSTORE"; then echo "FAIL (as required): --zone-verifier --code <runtime with SSTORE/CALL>"
else echo "NOT CAUGHT: zone bytecode scan (rc=$rc)"; status=1; fi
exit $status
