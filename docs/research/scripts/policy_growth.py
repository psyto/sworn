"""TIP-403 policy count over time: ITIP403Registry.policyIdCounter() read at historical blocks.
usage: policy_growth.py <net> <out.json>   (read-only eth_call against archive state)
policyIdCounter counts every policy ever created (ids 0/1 are the built-in reject/allow-all)."""
import sys, json, datetime as dt
from eth_hash.auto import keccak
from tempo_rpc import RPC, RPCS, block_at_or_after, block_ts
net, out = sys.argv[1:3]
rpc = RPC(RPCS[net])
SEL = "0x" + keccak(b"policyIdCounter()").hex()[:8]
g = dt.datetime.fromtimestamp(block_ts(rpc, 1), dt.timezone.utc)
dates = []
d = dt.datetime(g.year, g.month, 1, tzinfo=dt.timezone.utc)
end = dt.datetime(2026, 10, 4, tzinfo=dt.timezone.utc)
while d <= end:
    for day in (1, 15):
        x = d.replace(day=day)
        if g < x <= end: dates.append(x)
    d = (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
for x in (dt.datetime(2026, 9, 27, tzinfo=dt.timezone.utc), end):
    if x not in dates: dates.append(x)
rows = []
for x in sorted(dates):
    b = block_at_or_after(rpc, int(x.timestamp())) - 1
    c = int(rpc.call("eth_call", [{"to": "0x403c000000000000000000000000000000000000", "data": SEL}, hex(b)]), 16)
    rows.append({"dateUTC": x.date().isoformat(), "block": b, "policyIdCounter": c})
    print(rows[-1], flush=True)
json.dump({"net": net, "genesisUTC": g.isoformat(), "rows": rows}, open(out, "w"), indent=1)
