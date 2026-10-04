"""For each sampled out-of-gas TIP-20 transfer revert: was the receiver's token balance zero just
before (i.e. would the transfer have written a fresh storage slot, ~254k gas on Tempo)?
usage: check_oog_receivers.py <net> <reverts-sample.json> <out.json>   (read-only: eth_getTransactionByHash, eth_call)"""
import sys, json, collections
from tempo_rpc import RPC, RPCS, SEL_TRANSFER, SEL_TRANSFER_WITH_MEMO
net, inp, out = sys.argv[1:4]
rpc = RPC(RPCS[net]); d = json.load(open(inp)); rows = []
for r in d["transferReverts"]:
    tx = rpc.call("eth_getTransactionByHash", [r["tx"]])
    calls = tx.get("calls") or [{"to": tx["to"], "input": tx["input"]}]
    for c in calls:
        inp_ = c.get("input") or c.get("data") or "0x"
        if inp_[:10] in (SEL_TRANSFER, SEL_TRANSFER_WITH_MEMO):
            rcv = "0x" + inp_[10 + 24:10 + 64]
            bal = int(rpc.call("eth_call", [{"to": c["to"], "data": "0x70a08231" + "0" * 24 + rcv[2:]},
                                            hex(r["block"] - 1)]), 16)
            rows.append({**r, "receiver": rcv, "receiverBalanceBefore": bal})
            break
c = collections.Counter((x["reason"], x["receiverBalanceBefore"] == 0) for x in rows)
res = {"net": net, "n": len(rows), "byReasonAndReceiverWasEmpty": [[list(k), v] for k, v in c.items()],
       "gasLimitRange": [min(x["gas"] for x in rows), max(x["gas"] for x in rows)] if rows else None, "rows": rows}
json.dump(res, open(out, "w"), indent=1); print(json.dumps({k: v for k, v in res.items() if k != "rows"}))
