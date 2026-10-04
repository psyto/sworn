"""Random-block sample of txs: how many TIP-20 transfer/transferWithMemo txs revert, and why.
usage: sample_reverts.py <net> <fromBlock> <toBlock> <nBlocks> <out.json> [deployments.json] [seed]

Read-only: eth_getBlockByNumber(full), eth_getBlockReceipts, debug_traceTransaction(callTracer).
Revert selectors are decoded against every `error` declared in
tempo/crates/contracts/src/precompiles/*.rs (selectors computed here from the source).
"""
import sys, json, re, glob, os, random, collections, time
from eth_hash.auto import keccak
from tempo_rpc import (RPC, RPCS, TIP20_PREFIX, SEL_TRANSFER, SEL_TRANSFER_WITH_MEMO, SEL_TRANSFER_FROM,
                       load_exclusions)

net, frm, to, nb, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
excl_addrs, excl_hashes = load_exclusions(sys.argv[6] if len(sys.argv) > 6 else None)
seed = int(sys.argv[7]) if len(sys.argv) > 7 else 20261004
rpc = RPC(RPCS[net])

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "../../../tempo/crates/contracts/src/precompiles/*.rs")
ERR = {"0x08c379a0": "Error(string)", "0x4e487b71": "Panic(uint256)"}
for f in glob.glob(SRC):
    mod = os.path.basename(f)[:-3]
    for name, args in re.findall(r"error\s+(\w+)\s*\(([^)]*)\)\s*;", open(f).read()):
        types = ",".join(a.strip().split()[0] for a in args.split(",") if a.strip())
        sig = f"{name}({types})"
        sel = "0x" + keccak(sig.encode()).hex()[:8]
        ERR.setdefault(sel, f"{mod}:{sig}")

def classify_to(a):
    a = (a or "").lower()
    if a.startswith(TIP20_PREFIX): return "tip20"
    for p, n in (("0xfeec", "feeManager"), ("0xdec0", "dex"), ("0x403c", "tip403"), ("0xb10c", "guard"),
                 ("0x20fc", "tip20Factory")):
        if a.startswith(p): return n
    return "other" if a else "create"

def calls_of(tx):
    if tx["type"] == "0x76":
        return [(c.get("to"), (c.get("input") or c.get("data") or "0x")) for c in tx.get("calls") or []]
    return [(tx.get("to"), tx.get("input") or "0x")]

random.seed(seed)
blocks = sorted(random.sample(range(frm, to + 1), nb))
stats = collections.Counter()
by_target = collections.defaultdict(collections.Counter)
transfer_rev = []
other_rev_reasons = collections.Counter()
t0 = time.time()
for i in range(0, len(blocks), 5):
    chunk = blocks[i:i + 5]
    reqs = []
    for b in chunk:
        reqs += [("eth_getBlockByNumber", [hex(b), True]), ("eth_getBlockReceipts", [hex(b)])]
    res = rpc.batch(reqs)
    for j, b in enumerate(chunk):
        blk, rcs = res[2 * j], res[2 * j + 1]
        if not blk or "__error__" in blk or not isinstance(rcs, list):
            stats["blockFetchErrors"] += 1; continue
        rmap = {r["transactionHash"]: r for r in rcs}
        stats["blocks"] += 1
        for tx in blk["transactions"]:
            h = tx["hash"].lower(); r = rmap.get(tx["hash"])
            if r is None: stats["missingReceipt"] += 1; continue
            frm_a = tx["from"].lower()
            cs = calls_of(tx)
            if h in excl_hashes or frm_a in excl_addrs or any((c[0] or "").lower() in excl_addrs for c in cs):
                stats["oursExcluded"] += 1; continue
            ok = r["status"] == "0x1"
            stats["txs"] += 1; stats["txsReverted"] += (not ok)
            tgt = classify_to(cs[0][0]) if cs else "none"
            by_target[tgt]["txs"] += 1; by_target[tgt]["reverted"] += (not ok)
            kinds = set()
            for cto, cin in cs:
                if classify_to(cto) == "tip20":
                    sel = cin[:10]
                    if sel == SEL_TRANSFER: kinds.add("transfer")
                    elif sel == SEL_TRANSFER_WITH_MEMO: kinds.add("transferWithMemo")
                    elif sel == SEL_TRANSFER_FROM: kinds.add("transferFrom")
            is_tr = bool(kinds & {"transfer", "transferWithMemo"})
            if is_tr:
                stats["transferTxs"] += 1; stats["transferTxsReverted"] += (not ok)
                stats["transferTxType_" + tx["type"]] += 1
                for k in kinds: stats["transferTxsWith_" + k] += 1
            if "transferFrom" in kinds:
                stats["transferFromTxs"] += 1; stats["transferFromTxsReverted"] += (not ok)
            if not ok:
                try:
                    tr = rpc.call("debug_traceTransaction", [tx["hash"], {"tracer": "callTracer"}])
                except Exception as e:
                    tr = {"error": f"trace failed: {e}"}
                # deepest frame with an error/output
                def deepest(fr):
                    for c in fr.get("calls") or []:
                        if c.get("error"):
                            return deepest(c)
                    return fr
                d = deepest(tr) if isinstance(tr, dict) else {}
                outp = (d.get("output") or "0x")
                sel = outp[:10]
                reason = ERR.get(sel, sel if len(outp) >= 10 else (d.get("error") or "no-data"))
                if sel == "0x08c379a0":
                    try:
                        ln = int(outp[10 + 64:10 + 128], 16)
                        reason += ": " + bytes.fromhex(outp[10 + 128:10 + 128 + 2 * ln]).decode(errors="replace")
                    except Exception: pass
                if is_tr:
                    transfer_rev.append({"block": int(blk["number"], 16), "tx": h, "from": frm_a, "type": tx["type"],
                                         "token": cs[0][0], "reason": reason, "error": d.get("error"),
                                         "gas": int(tx["gas"], 16), "gasUsed": int(r["gasUsed"], 16),
                                         "nCalls": len(cs)})
                else:
                    other_rev_reasons[f"{tgt}:{(cs[0][1] or '0x')[:10] if tgt == 'tip20' else ''}:{reason}"] += 1
    if (i // 5) % 60 == 0:
        print(f"[{net}] {i+len(chunk)}/{nb} blocks txs={stats['txs']} transferTxs={stats['transferTxs']} "
              f"rev={stats['transferTxsReverted']} calls={rpc.calls} {time.time()-t0:.0f}s", flush=True)

trc = collections.Counter(r["reason"] for r in transfer_rev)
trs = collections.Counter(r["from"] for r in transfer_rev)
res = {"net": net, "fromBlock": frm, "toBlock": to, "sampledBlocks": nb, "seed": seed,
       "stats": dict(stats), "byFirstCallTarget": {k: dict(v) for k, v in by_target.items()},
       "transferRevertRatio": (stats["transferTxsReverted"] / stats["transferTxs"]) if stats["transferTxs"] else None,
       "transferRevertReasons": trc.most_common(), "transferRevertSenders": trs.most_common(10),
       "distinctTransferRevertSenders": len(trs),
       "otherRevertReasons": other_rev_reasons.most_common(30),
       "transferReverts": transfer_rev, "rpcCalls": rpc.calls, "elapsedSec": round(time.time() - t0)}
json.dump(res, open(out, "w"), indent=1)
print(json.dumps({k: v for k, v in res.items() if k != "transferReverts"}, indent=1)[:5000])
