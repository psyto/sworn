"""Count FeeManager (0xfeec…) events by type over a block range (read-only).
usage: scan_feemanager.py <net> <fromBlock> <toBlock> <out.json>
ABI: tempo/crates/contracts/src/precompiles/tip_fee_manager.rs. None of these events records a
*failed* fee payment: a tx whose fee cannot be paid is invalid and never included in a block."""
import sys, json, collections, time
from eth_hash.auto import keccak
from tempo_rpc import RPC, RPCS, FEE_MANAGER, get_logs_adaptive, topic_addr
SIGS = ["UserTokenSet(address,address)", "ValidatorTokenSet(address,address)",
        "FeesDistributed(address,address,uint256)",
        "Mint(address,address,address,address,uint256,uint256)",
        "Burn(address,address,address,uint256,uint256,uint256,address)",
        "RebalanceSwap(address,address,address,uint256,uint256)"]
NAME = {"0x" + keccak(s.encode()).hex(): s.split("(")[0] for s in SIGS}
net, frm, to, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
rpc = RPC(RPCS[net]); c = collections.Counter(); emitters = collections.defaultdict(collections.Counter)
t0 = time.time()
for a, b, logs in get_logs_adaptive(rpc, {"address": FEE_MANAGER}, frm, to, start_range=20000):
    for l in logs:
        n = NAME.get(l["topics"][0], l["topics"][0]); c[n] += 1
        if n in ("UserTokenSet", "RebalanceSwap") and len(l["topics"]) > 1:
            emitters[n][topic_addr(l["topics"][-1] if n == "RebalanceSwap" else l["topics"][1])] += 1
res = {"net": net, "fromBlock": frm, "toBlock": to, "counts": dict(c),
       "distinctUserTokenSetUsers": len(emitters["UserTokenSet"]),
       "distinctRebalanceSwappers": len(emitters["RebalanceSwap"]),
       "elapsedSec": round(time.time() - t0), "rpcCalls": rpc.calls}
json.dump(res, open(out, "w"), indent=1); print(json.dumps(res, indent=1))
