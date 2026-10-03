#!/usr/bin/env python3
"""Read-only witness fetcher for the Tempo Moderato kill-gate spike.
Usage: fetch.py <block_hex> <from> <to_contract> <calldata> <out.json> [extra addr:slot ...]
Only issues read RPCs (debug_getRawHeader, eth_getBlockByNumber, eth_call,
debug_traceCall/prestateTracer, eth_getProof, eth_getCode)."""
import json, sys, time, urllib.request
RPC = "https://rpc.moderato.tempo.xyz"
_id = 0
def rpc(method, params):
    global _id; _id += 1
    body = json.dumps({"jsonrpc":"2.0","id":_id,"method":method,"params":params}).encode()
    for attempt in range(6):
        try:
            req = urllib.request.Request(RPC, body, {"content-type":"application/json","user-agent":"curl/8.7.1"})
            r = json.load(urllib.request.urlopen(req, timeout=60))
            if "error" in r:
                if method == "eth_call" and "data" in r["error"]: return {"revert": r["error"]}
                raise RuntimeError(f"{method}: {r['error']}")
            time.sleep(0.15)
            return r["result"]
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(2**attempt); continue
            raise
    raise RuntimeError("rate limited")

blk, frm, to, data, out = sys.argv[1:6]
extra = sys.argv[6:]
call = {"from": frm, "to": to, "data": data}
raw_header = rpc("debug_getRawHeader", [blk])
block = rpc("eth_getBlockByNumber", [blk, False])
call_result = rpc("eth_call", [call, blk])
pre = rpc("debug_traceCall", [call, blk, {"tracer": "prestateTracer"}])
touched = {a.lower(): set(k.lower() for k in v.get("storage", {}).keys()) for a, v in pre.items()}
for e in extra:
    a, s = e.split(":") if ":" in e else (e, None)
    touched.setdefault(a.lower(), set())
    if s: touched[a.lower()].add("0x" + s[2:].rjust(64, "0"))
accounts = []
for addr, slots in sorted(touched.items()):
    p = rpc("eth_getProof", [addr, sorted(slots), blk])
    code = rpc("eth_getCode", [addr, blk])
    accounts.append({"address": addr, "code": code, "proof": p})
json.dump({"block": blk, "block_hash": block["hash"], "raw_header": raw_header, "header_json": block,
           "call": call, "rpc_eth_call_result": call_result, "prestate": pre, "accounts": accounts},
          open(out, "w"), indent=1)
nslots = sum(len(a["proof"]["storageProof"]) for a in accounts)
print(f"accounts={len(accounts)} slots={nslots} eth_call={call_result}")
