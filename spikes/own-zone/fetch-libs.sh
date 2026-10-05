#!/usr/bin/env bash
# Populate contracts/lib (not committed): tempo-std at zones ac49071f's pin, forge-std v1.16.2.
set -euo pipefail
cd "$(dirname "$0")/contracts"; mkdir -p lib; rm -f lib/tempo-std lib/forge-std
git clone -q https://github.com/tempoxyz/tempo-std.git lib/tempo-std && git -C lib/tempo-std checkout -q 96f882963ce3b0e0abc7ec2b41d03d42457877bb
git clone -q --depth 1 --branch v1.16.2 https://github.com/foundry-rs/forge-std.git lib/forge-std
echo "ok. Build with Foundry >= 1.8.4 (1.7.1's Tempo precompiles lack tokenTransferPolicyId): forge build"
