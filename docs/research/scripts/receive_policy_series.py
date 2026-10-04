"""Series of accounts with a receive policy, from the ReceivePolicyUpdated rows saved by
scan_guard_policy.py. "restrictive" = the account's latest setting as of that date is not
(senderPolicyId=1 ALLOW_ALL, tokenFilterId=1 ALLOW_ALL). usage: receive_policy_series.py <guard.json>"""
import sys, json, datetime as dt
d = json.load(open(sys.argv[1]))
rows = sorted((r for r in d["rawReceivePolicyUpdated"] if not r["ours"]), key=lambda r: r["block"])
cut = []
x = dt.date(2026, 6, 1)
while x <= dt.date(2026, 10, 4):
    cut.append(x); x += dt.timedelta(days=7)
cut.append(dt.date(2026, 10, 4))
out, state, i = [], {}, 0
for c in cut:
    while i < len(rows) and dt.date.fromisoformat(rows[i]["day"]) < c:
        state[rows[i]["account"]] = (rows[i]["senderPolicyId"], rows[i]["tokenFilterId"]); i += 1
    restr = sum(1 for v in state.values() if v != (1, 1))
    out.append({"beforeUTC": c.isoformat(), "accountsEverSet": len(state), "restrictiveNow": restr})
print(json.dumps(out, indent=0))
