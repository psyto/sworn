#!/usr/bin/env python3
"""Genesis for the Sworn local e2e chain (spec 002 S-1..S-4).

= Tempo's own dev genesis ALLOC (canonical TIP-20s, fee manager, dev accounts funded in token
  storage) + Moderato's genesis CONFIG verbatim (chainId 42431, Moderato's hardfork schedule,
  epochLength). The guest (core/) and Sworn.sol fix chainId 42431 and read the hardfork schedule from
  moderato.json's config, so a chain with exactly this config is what they can answer about.
  Genesis timestamp = now, so every Moderato fork already active today is active from block 0
  (no activation boundary inside the test run).

Why not `anvil --network tempo --fork-url moderato`: measured 2026-10-03 with anvil 1.7.1 — forked
blocks report stateRoot 0x00..00, `debug_getRawHeader` is -32601 "Method not found", and
eth_getProof of a TIP-20 precompile returns the empty code hash. The guest binds keccak(rawHeader)
to the block hash and MPT-verifies against stateRoot, so no proof is possible there.
"""
import json, sys, time, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / "tempo/crates/chainspec/src/genesis"
dev = json.loads((root / "dev.json").read_text())
mod = json.loads((root / "moderato.json").read_text())
g = dict(dev)
g["config"] = dict(mod["config"])
# S-4 only: SWORN_GENESIS_OVERRIDE='{"t12Time": 123}' makes a chain whose LIVE fork schedule differs
# from the guest's (the answerer must refuse it). Never used for S-1/S-2.
import os
ov = json.loads(os.environ.get("SWORN_GENESIS_OVERRIDE", "{}"))
g["config"].update(ov)
if ov:
    print(f"OVERRIDE (drifted chain for S-4): {ov}")
ts = int(sys.argv[2]) if len(sys.argv) > 2 else int(time.time())
# Never start inside MAX_AGE-ish distance of a fork activation (answerer would refuse, S-4).
acts = sorted(v for k, v in g["config"].items() if k.startswith("t") and k.endswith("Time"))
nxt = [a for a in acts if a > ts]
if nxt and nxt[0] - ts < 3600 and not ov:
    sys.exit(f"next Moderato activation {nxt[0]} is < 1h after genesis {ts}; refusing")
g["timestamp"] = hex(ts)
# Etch the REAL SP1 v6.1.0 Groth16 verifier (contracts/src/vendor, no immutables) at the address
# Sworn.sol has as its SP1_VERIFIER constant. A Tempo node has no anvil_setCode, so genesis is where
# code is etched; Sworn.sol itself is untouched and deployed by an ordinary transaction.
sworn_src = (root.parent.parent.parent.parent.parent / "contracts/src/Sworn.sol").read_text()
import re
verifier = re.search(r"SP1_VERIFIER\s*=\s*(0x[0-9a-fA-F]{40})", sworn_src).group(1).lower()
art = json.loads((root.parent.parent.parent.parent.parent / "contracts/out/SP1VerifierGroth16.sol/SP1Verifier.json").read_text())
assert not art["deployedBytecode"].get("immutableReferences"), "verifier has immutables"
g["alloc"][verifier] = {"balance": "0x0", "code": art["deployedBytecode"]["object"]}
out = pathlib.Path(sys.argv[1])
out.write_text(json.dumps(g))
print(f"etched SP1Verifier ({len(art['deployedBytecode']['object'])//2 - 1} bytes) at {verifier}")
print(f"wrote {out} chainId={g['config']['chainId']} timestamp={ts} next_activation={nxt[0] if nxt else None}")
