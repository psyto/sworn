#!/usr/bin/env bash
# Build everything the own-zone run needs into $OWN_ZONE_BUILD (default: spikes/own-zone/build, not committed).
#   zones  = tempoxyz/zones ac49071f + spikes/zone-spf/patches/zones-{zkvm,witness-dump,withdrawal-dump}.patch
#            + patches/zones-own-zone.patch          -> tempo-zone, own-zone-genesis, tempo-xtask (release)
#   zspf   = copies of spikes/zone-spf/{attest,host,guest} + patches/attest-own-zone.patch, with tempo/vendor/riscv
#            symlinked from spikes/zone-spf           -> sworn-zone-host; the NEW guest ELF is shipped in guest-elf/
#   --dress  also builds the pinned Tempo L1 node (tempo 346c22eb) for a local dress rehearsal
# Never touches spikes/zone-spf (read-only source) or the existing guest/verifier deployments.
set -euo pipefail
spike="$(cd "$(dirname "$0")" && pwd)"; zspf_src="$(cd "$spike/../zone-spf" && pwd)"
B="${OWN_ZONE_BUILD:-$spike/build}"; mkdir -p "$B"; B="$(cd "$B" && pwd)"
EXPECT_VKEY=0x00ab5a9e697e8e1f81e1db06c7e41afd5dd046438f50b972a48c417d724a5c7b
log() { echo "[build $(date -u +%H:%M:%S)] $*"; }

# 1. zones
if [ ! -d "$B/zones/.git" ]; then
  if [ -d "$zspf_src/zones/.git" ]; then git clone -q --no-checkout "$zspf_src/zones" "$B/zones"
  else git clone -q --filter=blob:none https://github.com/tempoxyz/zones.git "$B/zones"; fi
  git -C "$B/zones" checkout -q ac49071f
  git -C "$B/zones" apply "$zspf_src/patches/zones-zkvm.patch" "$zspf_src/patches/zones-witness-dump.patch" \
    "$zspf_src/patches/zones-withdrawal-dump.patch" "$spike/patches/zones-own-zone.patch"
  log "zones ready (ac49071f + 3 zone-spf patches + own-zone patch)"
fi
(cd "$B/zones" && cargo build --release --bin tempo-zone --bin own-zone-genesis -p tempo-zone && cargo build --release -p tempo-xtask)
log "zones binaries: $(ls "$B/zones/target/release/" | grep -E '^(tempo-zone|own-zone-genesis|tempo-xtask)$' | tr '\n' ' ')"

# 2. host + guest (new guest; the spike-zone-spf guest is untouched)
mkdir -p "$B/zspf"
for d in attest host guest; do [ -d "$B/zspf/$d" ] || cp -R "$zspf_src/$d" "$B/zspf/$d"; done
for d in tempo vendor riscv; do [ -e "$B/zspf/$d" ] || ln -s "$zspf_src/$d" "$B/zspf/$d"; done
[ -e "$B/zspf/zones" ] || ln -s ../zones "$B/zspf/zones"
if ! grep -q OWN-ZONE "$B/zspf/attest/src/lib.rs"; then (cd "$B/zspf" && patch -p1 < "$spike/patches/attest-own-zone.patch"); fi
rm -rf "$B/zspf/host/target" 2>/dev/null || true
(cd "$B/zspf/host" && cargo build --release)
# The guest ELF is NOT rebuilt: it embeds absolute source paths, so a rebuild elsewhere changes the vkey.
# Use the shipped ELF (guest-elf/README.txt) and verify it.
ELF="$spike/guest-elf/zone-spf-guest-own"
[ "$(shasum -a 256 "$ELF" | cut -d' ' -f1)" = 6f6fb01e42cd46a2753b12637242fc4b4b4023f1cce3f24ef1e770b5f636d6e4 ] || { echo "guest ELF sha256 mismatch. STOP."; exit 1; }
RUNNER="$(cd "$spike/../.." && pwd)/runner/target/release/spike-runner"
[ -x "$RUNNER" ] || (cd "$spike/../../runner" && cargo build --release)
"$B/zspf/host/target/release/sworn-zone-host" input "$spike/rehearsal/zone4242-chain1424314242-blocks6-7.case.json" \
  "$spike/rehearsal/own-zone-blocks6-7.genesis.json" 0x000000000000000000000000000000005a0e5a0e 42431 "$B/vkey-check.bin" > /dev/null
vkey=$("$RUNNER" "$ELF" "$B/vkey-check.bin" execute 2>&1 | tee "$B/vkey-check.log" | awk '/vkey\(bytes32\)/{print $2}')
grep -q "publicValues match native host: PASS" "$B/vkey-check.log" || { echo "guest != native host"; exit 1; }
log "guest ELF sha256 6f6fb01e…d6e4  vkey $vkey"
[ "$vkey" = "$EXPECT_VKEY" ] || { echo "VKEY MISMATCH: got $vkey, the runbook/verifier expect $EXPECT_VKEY. STOP."; exit 1; }

# 3. contracts (forge build only; sending is done by scripts/own-zone.sh)
[ -d "$spike/contracts/lib/tempo-std" ] || "$spike/fetch-libs.sh"
(cd "$spike/contracts" && forge build --quiet)
log "contracts built"

# 4. optional: local L1 for the dress rehearsal
if [ "${1:-}" = "--dress" ]; then
  [ -d "$B/tempo-l1" ] || { git clone -q --filter=blob:none https://github.com/tempoxyz/tempo "$B/tempo-l1" && git -C "$B/tempo-l1" checkout -q 346c22eb4293ac1f5edd27d4afd1f99323bc527c; }
  (cd "$B/tempo-l1" && cargo build --release --bin tempo)
  log "dress L1: $B/tempo-l1/target/release/tempo"
fi
log "done. OWN_ZONE_BUILD=$B"
