BLOCKER: None.

MAJOR — `operator/server.mjs:102-119`: The cross-site/DNS-rebinding fix works for a remote web page, but it is not authorization against another local process—or any page served from `http://localhost:*`. A process can supply the accepted `Host`, omit/spoof `Origin`, and set the public constant `X-Sworn-Operator: 1`, then start a costly job. CORS/preflight does not constrain non-browser clients. The endpoint does not accept arbitrary proof inputs (it ignores a body and pins the fixture at lines 21–28), and cannot send a transaction (`zone-attest.sh` is invoked without `--send`, lines 70–74). Smallest resolution: either document this as a cross-site-only boundary, or add actual operator/OS-level authorization; a fixed header is not it.

MINOR — `site/src/ui/Zone.tsx:102-104`: A valid server rejection, including the expected 409 for an already-running job, is shown as “Local worker not connected.” Polling corrects it shortly, but that is not honest failure reporting. Only mark offline for network failures; retain server errors as start errors.

MINOR — `site/src/ui/Zone.tsx:143`: “Batch 006” remains in the downloaded filename (`sworn-batch-006-evidence.json`). Rename it to the Zone-blocks label.

MINOR — `site/src/ui/Zone.tsx:150-154`, `video/demo.html:89,97,103,109,115`: Audit exports/Settings were removed, but the remaining `<nav>` is still inert static text. Thus the non-functional-nav fix is only partial. Remove the nav semantics/items or label them as static context.

All other stated fixes landed correctly. The frames visibly show “Example operator · illustration,” generic “Example Zone,” fixture/dev-chain scope, “Zone blocks 5–6,” and explicit no-portal/no-withdrawal-protection/settlement-not-built disclosures. The narration/subtitles no longer call a settlement counterparty; they use an auditor. The pre-T13 comparison consistently says “equivalent malformed batch,” not the same input. I found no remaining claim of a real customer, hosted service, active settlement integration, protected withdrawals, or a Moderato Zone batch.

Worker execution failure is otherwise honest: failed subprocesses set `failed`, retain an error/log, and only dual successful steps show “Nothing was sent” (`operator/server.mjs:64-80`, `Zone.tsx:359-364`).

The founder narration is substantively ready; resolve the local-trigger boundary if that protection is intended, plus the small UI residues.

VERDICT: CHANGES