#!/usr/bin/env bash
# Count every CWF form field in _submission/cwf-form.md against the limit on its heading (≤N),
# and refuse while any field still carries a [FILL …] / [FOUNDER …] / [TO …] marker.
#   scripts/cwf-form.sh            # counts; markers are listed as pending
#   scripts/cwf-form.sh --final    # also fails on any pending marker
set -euo pipefail
cd "$(dirname "$0")/.."
FINAL=${1:-}
python3 - "$FINAL" <<'PY'
import re, sys, pathlib
final = sys.argv[1] == "--final"
t = pathlib.Path("_submission/cwf-form.md").read_text(encoding="utf-8")
secs = re.findall(r"^## ([^\n]+)\n\n```\n(.*?)\n```", t, re.S | re.M)
EXPECTED = 28
heads = re.findall(r"^## ", t, re.M)
if len(secs) != EXPECTED or len(heads) != EXPECTED:
    print("  %d fields with a block / %d headings, expected %d — a code fence is broken or a field was added" % (len(secs), len(heads), EXPECTED)); sys.exit(1)
bad = pending = 0
for head, body in secs:
    name = head.split(" ·")[0]; b = body.strip()
    m = re.search(r"≤(\d+)(?!\s*min)", head)
    lim = int(m.group(1)) if m else None
    mark = re.search(r"\[(FILL|FOUNDER|TO )[^\]]*", b)
    over = lim is not None and len(b) > lim
    if over: bad += 1
    if mark: pending += 1
    print("  %s %-60s %5d / %s%s" % ("✗" if over else ("…" if mark else "✓"), name[:60], len(b), lim or "-", "   PENDING" if mark else ""))
print("fields %d · over limit %d · pending %d" % (len(secs), bad, pending))
sys.exit(1 if bad or (final and pending) else 0)
PY
