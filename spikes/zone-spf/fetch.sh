#!/usr/bin/env bash
# Reproduce the large, uncommitted trees of the zone-spf spike from pinned commits + ./patches.
#   zones  = tempoxyz/zones @ ac49071f  + patches/zones-zkvm.patch + patches/zones-witness-dump.patch
#   tempo  = tempoxyz/tempo @ 346c22eb  + patches/tempo-zkvm.patch
#   vendor = crates.io c-kzg 2.1.8, reth-primitives-traits 0.6.0 + their *-zkvm.patch
# Not fetched: the RISC-V C toolchain (./riscv, riscv64-unknown-elf-gcc 15.2.0) used by build-guest.sh
# for the C deps; point CC_riscv64im_succinct_zkvm_elf at any riscv64-unknown-elf-gcc instead.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; cd "$here"
clone() { # dir url commit
  [ -d "$1/.git" ] || git clone --filter=blob:none "$2" "$1"
  git -C "$1" checkout -q "$3"
}
clone zones https://github.com/tempoxyz/zones.git ac49071f
git -C zones apply ../patches/zones-zkvm.patch ../patches/zones-witness-dump.patch
clone tempo https://github.com/tempoxyz/tempo 346c22eb4293ac1f5edd27d4afd1f99323bc527c
git -C tempo apply ../patches/tempo-zkvm.patch
mkdir -p vendor
crate() { # name version dir patch
  [ -d "vendor/$3" ] && return
  curl -fsSL "https://static.crates.io/crates/$1/$1-$2.crate" | tar xz -C vendor
  mv "vendor/$1-$2" "vendor/$3"
  (cd "vendor/$3" && patch -p1 < "../../patches/$4")
}
crate c-kzg 2.1.8 c-kzg c-kzg-2.1.8-zkvm.patch
crate reth-primitives-traits 0.6.0 reth-primitives-traits reth-primitives-traits-0.6.0-zkvm.patch
echo "ok: zones, tempo, vendor ready. Next: ./build-guest.sh"
