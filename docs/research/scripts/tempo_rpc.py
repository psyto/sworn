"""Read-only JSON-RPC helpers for the exception-frequency measurement (2026-10-04).

Only read methods are ever called (eth_getLogs, eth_getBlockByNumber, eth_getBlockReceipts,
debug_traceTransaction, eth_chainId). No keys, no signing, no eth_sendRawTransaction.
"""
import json, os, re, sys, time, random
import requests

RPCS = {
    "moderato": "https://rpc.moderato.tempo.xyz",   # chain 42431
    "mainnet": "https://rpc.tempo.xyz",             # chain 4217, per tempo.xyz/developers/docs/quickstart/connection-details
}

TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
TRANSFER_WITH_MEMO = "0x57bc7354aa85aed339e000bccffabbc529466af35f0772c8f8ee1145927de7f0"
# IReceivePolicyGuard.TransferBlocked(address indexed token, address indexed receiver,
#   uint64 indexed blockedNonce, uint256 amount, uint8 receiptVersion, bytes receipt)
TRANSFER_BLOCKED = "0x361d86e46fd139dc3eac4148f16b53597f0f8ddd9aba772aae0034bda5531b1c"

GUARD = "0xb10c000000000000000000000000000000000000"     # sdk/src/abi.ts RECEIVE_POLICY_GUARD
FEE_MANAGER = "0xfeec000000000000000000000000000000000000"
DEX = "0xdec0000000000000000000000000000000000000"
ZERO = "0x" + "0" * 40
TIP20_PREFIX = "0x20c0"

SEL_TRANSFER = "0xa9059cbb"
SEL_TRANSFER_WITH_MEMO = "0x95777d59"   # transferWithMemo(address,uint256,bytes32)
SEL_TRANSFER_FROM = "0x23b872dd"


class RPC:
    def __init__(self, url, min_interval=0.05):
        self.url = url
        self.s = requests.Session()
        self.min_interval = min_interval
        self.last = 0.0
        self.calls = 0
        self.retries = 0

    def _post(self, payload, timeout=180, attempts=12):
        delay = 1.0
        for attempt in range(attempts):
            wait = self.min_interval - (time.time() - self.last)
            if wait > 0:
                time.sleep(wait)
            self.last = time.time()
            try:
                r = self.s.post(self.url, json=payload, timeout=timeout)
                self.calls += 1
                if r.status_code == 429 or r.status_code >= 500:
                    raise RuntimeError(f"http {r.status_code}")
                return r.json()
            except Exception as e:  # network / 429 / 5xx -> backoff
                self.retries += 1
                time.sleep(delay + random.random())
                delay = min(delay * 2, 60)
        raise RuntimeError(f"giving up after retries: {payload if isinstance(payload, dict) else 'batch'}")

    def call(self, method, params, attempts=12):
        j = self._post({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, attempts=attempts)
        if "error" in j:
            raise RPCError(j["error"])
        return j["result"]

    def batch(self, reqs):
        """reqs: list of (method, params). Returns results in order (None + error on failure)."""
        payload = [{"jsonrpc": "2.0", "id": i, "method": m, "params": p} for i, (m, p) in enumerate(reqs)]
        out = self._post(payload)
        if not isinstance(out, list):
            raise RPCError(out.get("error", out))
        by_id = {o["id"]: o for o in out}
        res = []
        for i in range(len(reqs)):
            o = by_id.get(i, {})
            res.append(o.get("result") if "error" not in o else {"__error__": o["error"]})
        return res


class RPCError(Exception):
    pass


def get_logs_adaptive(rpc, flt, frm, to, max_range=100000, start_range=None, on_chunk=None):
    """Walk [frm, to] with eth_getLogs, shrinking the range when the node says
    'query exceeds max results 20000, retry with the range A-B'. Yields lists of logs."""
    rng = start_range or max_range
    cur = frm
    while cur <= to:
        end = min(cur + rng - 1, to)
        try:
            logs = rpc.call("eth_getLogs", [dict(flt, fromBlock=hex(cur), toBlock=hex(end))],
                            attempts=4 if rng > 1 else 12)
        except RuntimeError as e:  # repeated 5xx/timeouts on a big range (gateway 502) -> halve it
            if rng <= 1:
                raise
            rng = max(1, rng // 4)
            continue
        except RPCError as e:
            msg = str(e)
            m = re.search(r"retry with the range (\d+)-(\d+)", msg)
            if m:
                rng = max(1, int(m.group(2)) - int(m.group(1)) + 1)
                rng = max(1, int(rng * 0.95))
                continue
            if "max block range" in msg:
                rng = max(1, rng // 2)
                continue
            raise
        if on_chunk:
            on_chunk(cur, end, logs)
        yield cur, end, logs
        cur = end + 1
        # grow back slowly
        rng = min(max_range, int(rng * 1.15) + 1)


def block_ts(rpc, n):
    return int(rpc.call("eth_getBlockByNumber", [hex(n), False])["timestamp"], 16)


def block_at_or_after(rpc, ts):
    lo, hi = 1, int(rpc.call("eth_blockNumber", []), 16)
    while lo < hi:
        mid = (lo + hi) // 2
        if block_ts(rpc, mid) < ts:
            lo = mid + 1
        else:
            hi = mid
    return lo


def topic_addr(t):
    return "0x" + t[-40:].lower()


def load_exclusions(path):
    """Every 20-byte address and 32-byte hash in deployments/<net>.json, minus protocol
    precompiles (0x20c0… tokens etc. must stay in the counts)."""
    if not path or not os.path.exists(path):
        return set(), set()
    txt = open(path).read()
    hashes = {h.lower() for h in re.findall(r"0x[0-9a-fA-F]{64}\b", txt)}
    addrs = set()
    for a in re.findall(r"0x[0-9a-fA-F]{40}\b", txt):
        a = a.lower()
        if a.startswith(("0x20c0", "0xfeec", "0xdec0", "0xb10c", "0x403c")):
            continue
        addrs.add(a)
    return addrs, hashes
