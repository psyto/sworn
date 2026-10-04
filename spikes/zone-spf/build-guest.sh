#!/usr/bin/env bash
# Build the zone SP1 guest (spec 003 §4). The C deps (c-kzg, blst, secp256k1, zstd) need a RISC-V C
# compiler for the zkVM target; the spike uses the riscv-gnu toolchain unpacked in ./riscv.
#   spikes/zone-spf/build-guest.sh            -> guest/target/elf-compilation/riscv64im-succinct-zkvm-elf/release/zone-spf-guest
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
export CC_riscv64im_succinct_zkvm_elf="$here/riscv/bin/riscv64-unknown-elf-gcc"
export AR_riscv64im_succinct_zkvm_elf="$here/riscv/bin/riscv64-unknown-elf-ar"
cd "$here/guest"
"${CARGO_PROVE:-$HOME/.sp1/bin/cargo-prove}" prove build --ignore-rust-version
echo "ELF: $here/guest/target/elf-compilation/riscv64im-succinct-zkvm-elf/release/zone-spf-guest"
