"""Full scan of TIP-20 Transfer events over a block range (read-only).
usage: scan_transfers.py <net> <fromBlock> <toBlock> <out.json> [deployments.json]

Every Transfer log from a 0x20c0… token is put in exactly one category:
  ours       tx hash or from/to listed in deployments/<net>.json (excluded from all other counts)
  fee_in     to   = FeeManager 0xfeec… (fee collection; emitted even by reverted txs)
  fee_out    from = FeeManager (refund / distribution)
  dex        from/to = Stablecoin DEX 0xdec0…
  mint       from = 0x0
  burn       to   = 0x0
  to_guard   to   = ReceivePolicyGuard 0xb10c… (receive-policy diversion)
  from_guard from = ReceivePolicyGuard (claims)
  payment    everything else = account-to-account value transfer
"""
import sys, json, time, collections, os
from tempo_rpc import (RPC, RPCS, TRANSFER, GUARD, FEE_MANAGER, DEX, ZERO, TIP20_PREFIX,
                       get_logs_adaptive, topic_addr, load_exclusions)

net, frm, to, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
excl_addrs, excl_hashes = load_exclusions(sys.argv[5] if len(sys.argv) > 5 else None)
rpc = RPC(RPCS[net])

cat = collections.Counter()
cat_by_token = collections.defaultdict(collections.Counter)
senders = collections.Counter()
receivers = collections.Counter()
pay_txs = set()
non_tip20 = 0
guard_rows = []
t0 = time.time(); n = 0; last = t0
for a, b, logs in get_logs_adaptive(rpc, {"topics": [TRANSFER]}, frm, to, start_range=2500):
    for l in logs:
        tok = l["address"].lower()
        if not tok.startswith(TIP20_PREFIX):
            non_tip20 += 1
            continue
        f, t = topic_addr(l["topics"][1]), topic_addr(l["topics"][2])
        h = l["transactionHash"].lower()
        if h in excl_hashes or f in excl_addrs or t in excl_addrs:
            c = "ours"
        elif t == FEE_MANAGER: c = "fee_in"
        elif f == FEE_MANAGER: c = "fee_out"
        elif f == DEX or t == DEX: c = "dex"
        elif f == ZERO: c = "mint"
        elif t == ZERO: c = "burn"
        elif t == GUARD:
            c = "to_guard"
            guard_rows.append({"block": int(l["blockNumber"], 16), "tx": h, "token": tok, "from": f,
                               "amount": int(l["data"], 16)})
        elif f == GUARD: c = "from_guard"
        else:
            c = "payment"
            senders[f] += 1; receivers[t] += 1; pay_txs.add(h)
        cat[c] += 1
        cat_by_token[tok][c] += 1
    n += len(logs)
    if time.time() - last > 30:
        last = time.time()
        pct = (b - frm + 1) / (to - frm + 1) * 100
        print(f"[{net}] {b} {pct:5.1f}% logs={n} calls={rpc.calls} retries={rpc.retries} {time.time()-t0:.0f}s", flush=True)

top = senders.most_common(25)
pay = cat["payment"]
res = {
    "net": net, "fromBlock": frm, "toBlock": to, "elapsedSec": round(time.time() - t0),
    "rpcCalls": rpc.calls, "rpcRetries": rpc.retries,
    "tip20TransferLogs": sum(cat.values()), "nonTip20TransferLogs": non_tip20,
    "byCategory": dict(cat),
    "byToken": {k: dict(v) for k, v in sorted(cat_by_token.items(), key=lambda kv: -sum(kv[1].values()))},
    "payment": {
        "events": pay, "txs": len(pay_txs), "distinctSenders": len(senders),
        "distinctReceivers": len(receivers),
        "top25Senders": [{"addr": a, "events": c, "share": round(c / pay, 4)} for a, c in top],
        "top1Share": round(top[0][1] / pay, 4) if top else None,
        "top10Share": round(sum(c for _, c in top[:10]) / pay, 4) if top else None,
        "sendersWith1Event": sum(1 for c in senders.values() if c == 1),
        "sendersWithOver1000Events": sum(1 for c in senders.values() if c > 1000),
    },
    "toGuardTransfers": guard_rows,
}
json.dump(res, open(out, "w"), indent=1)
print(json.dumps({k: v for k, v in res.items() if k not in ("byToken", "toGuardTransfers")}, indent=1)[:3000])
