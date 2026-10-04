"""Whole-history scan of ReceivePolicyGuard + TIP-403 registry events, and of Transfer(*, guard).
usage: scan_guard_policy.py <net> <fromBlock> <toBlock> <out.json> [deployments.json]

Read-only (eth_getLogs, eth_getTransactionByHash). Sources of the ABIs:
  tempo/crates/contracts/src/precompiles/receive_policy_guard.rs  (IReceivePolicyGuard)
  tempo/crates/contracts/src/precompiles/tip403_registry.rs       (ITIP403Registry)
"""
import sys, json, time, collections, datetime as dt
from tempo_rpc import RPC, RPCS, TRANSFER, GUARD, get_logs_adaptive, topic_addr, load_exclusions

REGISTRY = "0x403c000000000000000000000000000000000000"
EV = {
 "0x361d86e46fd139dc3eac4148f16b53597f0f8ddd9aba772aae0034bda5531b1c": "TransferBlocked",
 "0xdfa88f3774430fdb1d282219332a663236ccc8035ba8b9e0df856b374a5db085": "ReceiptClaimed",
 "0x61d14663748cd685c80a8434fc260ea4f4b27e213768b94375aa33b3985bf952": "ReceiptBurned",
 "0x98925cfb1bc09c5b43dd0dd56d3d95aa04fb3300927580cc588c3f5dd58c15e1": "PolicyAdminUpdated",
 "0x718d87917f0c4cfd1263707ef0e77c656ed8d8bfaca06152bdb0b8094142ec27": "PolicyCreated",
 "0xb15f514df899cf1b4ef0dc78f930c10d98883756fa3a1a8853a98132e7f4c5a6": "WhitelistUpdated",
 "0x94c23f8f319426f2da63b46b024acbc55fe44a5c59dc4c00d11b792515083c54": "BlacklistUpdated",
 "0x6e054cdd4e9405e97868ec27e55ca41ee66a481d8cbab2f0283a87a6727a9ab6": "CompoundPolicyCreated",
 "0xf0d46e7e04f2bf4cc56ea683299f4145c2650ef690e276e069bc2b806d68b2ea": "ReceivePolicyUpdated",
}
REASON = {0: "NONE", 1: "TOKEN_FILTER", 2: "RECEIVE_POLICY"}

net, frm, to, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
excl_addrs, excl_hashes = load_exclusions(sys.argv[5] if len(sys.argv) > 5 else None)
rpc = RPC(RPCS[net])

def words(data):
    d = data[2:]
    return [d[i:i + 64] for i in range(0, len(d), 64)]

def day(l):
    ts = int(l.get("blockTimestamp") or "0x0", 16)
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%d") if ts else None

events = []
t0 = time.time()
# Only the events this study needs (the mainnet run on 2026-10-04 used the unfiltered version;
# its counts for these event types are identical by construction) (Moderato's registry emits millions of Whitelist/Blacklist updates).
WANT = [k for k, v in EV.items() if v in ("TransferBlocked", "ReceiptClaimed", "ReceiptBurned",
                                          "ReceivePolicyUpdated")]
# PolicyCreated is dropped (too many on Moderato); policy growth comes from policy_growth.py instead.
for a, b, logs in get_logs_adaptive(rpc, {"address": [GUARD, REGISTRY], "topics": [WANT]}, frm, to):
    for l in logs:
        name = EV.get(l["topics"][0], l["topics"][0])
        row = {"event": name, "address": l["address"].lower(), "block": int(l["blockNumber"], 16),
               "day": day(l), "tx": l["transactionHash"].lower()}
        w = words(l["data"])
        if name == "TransferBlocked":
            row.update(token=topic_addr(l["topics"][1]), receiver=topic_addr(l["topics"][2]),
                       blockedNonce=int(l["topics"][3], 16), amount=int(w[0], 16), receiptVersion=int(w[1], 16))
            # bytes receipt = abi.encode(ClaimReceiptV1): version, token, recoveryAuthority, originator,
            # recipient, blockedAt, blockedNonce, blockedReason, kind, memo
            off = int(w[2], 16) // 32
            r = w[off + 1:]
            if len(r) >= 10:
                row.update(recoveryAuthority="0x" + r[2][-40:], originator="0x" + r[3][-40:],
                           recipient="0x" + r[4][-40:], blockedReason=REASON.get(int(r[7], 16), int(r[7], 16)),
                           kind=["TRANSFER", "MINT"][int(r[8], 16)] if int(r[8], 16) < 2 else int(r[8], 16))
        elif name == "ReceivePolicyUpdated":
            row.update(account=topic_addr(l["topics"][1]), senderPolicyId=int(w[0], 16),
                       tokenFilterId=int(w[1], 16), recoveryAuthority="0x" + w[2][-40:])
        elif name == "PolicyCreated":
            row.update(policyId=int(l["topics"][1], 16), updater=topic_addr(l["topics"][2]), policyType=int(w[0], 16))
        elif name in ("WhitelistUpdated", "BlacklistUpdated"):
            row.update(policyId=int(l["topics"][1], 16), updater=topic_addr(l["topics"][2]),
                       account=topic_addr(l["topics"][3]))
        events.append(row)
    if rpc.calls % 25 == 0:
        print(f"[{net}] registry/guard {b} events={len(events)} calls={rpc.calls} {time.time()-t0:.0f}s", flush=True)

to_guard = []
for a, b, logs in get_logs_adaptive(rpc, {"topics": [TRANSFER, None, "0x" + "0" * 24 + GUARD[2:]]}, frm, to):
    for l in logs:
        to_guard.append({"block": int(l["blockNumber"], 16), "day": day(l), "tx": l["transactionHash"].lower(),
                         "token": l["address"].lower(), "from": topic_addr(l["topics"][1]),
                         "amount": int(l["data"], 16)})
print(f"[{net}] to_guard={len(to_guard)} {time.time()-t0:.0f}s", flush=True)

json.dump({"events": events, "to_guard": to_guard}, open(out + ".rawlogs.json", "w"))
# tx sender of every guard-related tx (for the "ours" filter and clustering). ReceivePolicyUpdated
# is emitted for msg.sender, so its `account` already identifies the setter; no lookup needed.
txs = sorted({e["tx"] for e in events if e["address"] == GUARD} | {e["tx"] for e in to_guard})
print(f"[{net}] looking up {len(txs)} tx senders", flush=True)
txfrom = {}
for i in range(0, len(txs), 10):
    chunk = txs[i:i + 10]
    res = rpc.batch([("eth_getTransactionByHash", [h]) for h in chunk])
    for h, r in zip(chunk, res):
        txfrom[h] = (r or {}).get("from", "").lower() if isinstance(r, dict) and "__error__" not in r else None

def is_ours(row):
    vals = {row.get(k) for k in ("from", "originator", "receiver", "recipient", "account", "updater")}
    vals.add(txfrom.get(row["tx"]))
    return row["tx"] in excl_hashes or bool(vals & excl_addrs)

for coll in (events, to_guard):
    for r in coll:
        r["txFrom"] = txfrom.get(r["tx"])
        r["ours"] = is_ours(r)

def summarize(rows, key_fields):
    rows = [r for r in rows if not r["ours"]]
    out = {"count": len(rows), "byDay": dict(sorted(collections.Counter(r["day"] for r in rows).items()))}
    for k in key_fields:
        c = collections.Counter(r.get(k) for r in rows)
        out["distinct_" + k] = len(c)
        out["top_" + k] = c.most_common(10)
    return out

tb = [e for e in events if e["event"] == "TransferBlocked"]
rpu = [e for e in events if e["event"] == "ReceivePolicyUpdated"]
# latest receive-policy setting per account (non-ours); "permissive" = sender ALLOW_ALL(1) and filter ALLOW_ALL(1)
latest = {}
for e in sorted(rpu, key=lambda e: e["block"]):
    if not e["ours"]:
        latest[e["account"]] = e
firstset = collections.Counter()
seen = set()
for e in sorted(rpu, key=lambda e: e["block"]):
    if not e["ours"] and e["account"] not in seen:
        seen.add(e["account"]); firstset[e["day"]] += 1
cum, acc = {}, 0
for d in sorted(firstset):
    acc += firstset[d]; cum[d] = acc

res = {
 "net": net, "fromBlock": frm, "toBlock": to, "rpcCalls": rpc.calls, "elapsedSec": round(time.time() - t0),
 "eventCountsAll": dict(collections.Counter(e["event"] for e in events)),
 "eventCountsExclOurs": dict(collections.Counter(e["event"] for e in events if not e["ours"])),
 "transferBlocked": summarize(tb, ["txFrom", "originator", "receiver", "token", "blockedReason", "kind"]),
 "transferBlockedOurs": sum(1 for e in tb if e["ours"]),
 "transferToGuard": summarize(to_guard, ["txFrom", "from", "token"]),
 "transferToGuardOurs": sum(1 for e in to_guard if e["ours"]),
 "receivePolicyUpdated": summarize(rpu, ["txFrom", "account", "senderPolicyId", "tokenFilterId"]),
 "receivePolicyAccounts": {
   "distinctAccountsEverSet": len(latest),
   "latestSettingNotAllowAll": sum(1 for e in latest.values() if not (e["senderPolicyId"] == 1 and e["tokenFilterId"] == 1)),
   "newAccountsByDay": dict(sorted(firstset.items())), "cumulativeAccountsByDay": cum,
 },
 "policyCreated": summarize([e for e in events if e["event"] == "PolicyCreated"], ["updater", "policyType"]),
 "examplesTransferBlockedNotOurs": [e for e in tb if not e["ours"]][:15],
 "rawTransferBlocked": tb, "rawReceivePolicyUpdated": rpu, "rawTransferToGuard": to_guard,
}
json.dump(res, open(out, "w"), indent=1, default=str)
print(json.dumps({k: v for k, v in res.items() if not k.startswith("raw")}, indent=1, default=str)[:6000])
