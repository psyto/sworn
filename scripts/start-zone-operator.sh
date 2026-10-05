#!/usr/bin/env bash
# Start Sworn's local-only proof-job controller. It never holds keys and never sends a transaction.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$root/operator/server.mjs"
