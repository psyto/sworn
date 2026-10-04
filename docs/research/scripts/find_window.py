"""Find the block range for a UTC window. usage: find_window.py <net> <start ISO> <end ISO>"""
import sys, json, datetime as dt
from tempo_rpc import RPC, RPCS, block_at_or_after, block_ts
net, a, b = sys.argv[1:4]
rpc = RPC(RPCS[net])
ta = int(dt.datetime.fromisoformat(a).replace(tzinfo=dt.timezone.utc).timestamp())
tb = int(dt.datetime.fromisoformat(b).replace(tzinfo=dt.timezone.utc).timestamp())
s = block_at_or_after(rpc, ta)
e = block_at_or_after(rpc, tb) - 1
out = {"net": net, "chainId": int(rpc.call("eth_chainId", []), 16), "fromBlock": s, "toBlock": e,
       "fromTs": block_ts(rpc, s), "toTs": block_ts(rpc, e), "startUTC": a, "endUTC": b}
for k in ("fromTs", "toTs"):
    out[k + "UTC"] = dt.datetime.fromtimestamp(out[k], dt.timezone.utc).isoformat()
print(json.dumps(out))
