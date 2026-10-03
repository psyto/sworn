#!/usr/bin/env bash
# Fetch tempoxyz/tempo at the pinned commit and apply Sworn's patches (patches/tempo.patch).
# The patches are what let tempo-revm build for the SP1 zkVM target; each hunk is marked SPIKE-PATCH-n.
set -euo pipefail
cd "$(dirname "$0")/.."
TEMPO_COMMIT=61c979a524f9af5de9c540a0088c429a44741e4c
if [ ! -d tempo/.git ]; then
  git clone --quiet https://github.com/tempoxyz/tempo tempo
fi
git -C tempo fetch --quiet origin "$TEMPO_COMMIT" 2>/dev/null || true
git -C tempo checkout --quiet "$TEMPO_COMMIT"
git -C tempo apply --check ../patches/tempo.patch
git -C tempo apply ../patches/tempo.patch
echo "tempo @ $TEMPO_COMMIT with patches/tempo.patch applied"
