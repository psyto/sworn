#!/usr/bin/env bash
# Print the SP1 program vkey of the zone guest ELF, without proving: execute hardfork_t13_recovery in the
# zkVM (public values must equal the native host's) and run setup. ~20 s. The vkey does not depend on the
# verifier address, so a fixed placeholder address is used for the input.
#   spikes/zone-spf/elf-vkey.sh [elf]      -> stdout last two lines: "elf_sha256 <hex>" and "vkey <0x…>"
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
elf="${1:-$here/guest/target/elf-compilation/riscv64im-succinct-zkvm-elf/release/zone-spf-guest}"
[ -f "$elf" ] || { echo "elf-vkey: no ELF at $elf (run spikes/zone-spf/build-guest.sh)" >&2; exit 1; }
(cd "$here/host" && cargo build --release --quiet 2>/dev/null)
runner="$root/runner/target/release/spike-runner"
[ -x "$runner" ] || (cd "$root/runner" && cargo build --release --quiet)
work="$here/zin/elf-vkey"; mkdir -p "$work"
"$here/host/target/release/sworn-zone-host" input "$here/witness/hardfork_t13_recovery.case.json" \
  "$here/genesis/hardfork_t13_recovery.genesis.json" 0x000000000000000000000000000000005a0e5a0e 42431 \
  "$work/input.bin" >/dev/null
out=$("$runner" "$elf" "$work/input.bin" execute 2>&1) || { printf '%s\n' "$out" | tail -5 >&2; exit 1; }
grep -q "publicValues match native host: PASS" <<<"$out" || { echo "elf-vkey: guest != native host" >&2; exit 1; }
echo "elf_sha256 $(shasum -a 256 "$elf" | cut -d' ' -f1)"
echo "vkey $(awk '/^vkey\(bytes32\):/{print $2}' <<<"$out")"
