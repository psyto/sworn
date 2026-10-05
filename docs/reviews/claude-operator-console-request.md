# Review request for Claude Code — Sworn Operator Console

Please review the current working tree of `/Users/hiroyusai/src/sworn` as a **read-only final submission review**.
Do not edit files, make transactions, deploy contracts, or publish the site.

Sworn's new local Zone Operator Console consists of:

- `operator/server.mjs`: loopback-only local controller;
- `scripts/start-zone-operator.sh`: starts it;
- `site/src/ui/Zone.tsx`: optional UI client;
- `docs/operator-console.md`: operating and scope documentation.

It deliberately starts only the existing real `scripts/zone-prove.sh` workflow for the Tempo integration-test
fixture `deposit_and_withdrawal_blocks5-6` (one withdrawal, two user transactions, dev chain 1337). After
proving, it runs `scripts/zone-attest.sh` **without** `--send`, for read-only on-chain checks. It does not
use a ZonePortal, protect withdrawals, accept arbitrary Zone inputs, or send a transaction.

Please report only concrete findings, ranked by severity:

1. Any claim in code, page, README, demo/pitch, or docs that would overstate this implementation.
2. Any security/safety issue in the local worker, especially accidentally exposing it, accepting arbitrary
   input, sending a transaction, or mishandling a prover failure.
3. Any UX issue that makes a public static page look like it can start a local or hosted job.
4. Any inconsistency with the current built Zone proof: a test fixture on dev chain 1337, not a Moderato
   Zone batch; independent `SwornZoneVerifier`; no current ZonePortal integration.
5. Missing high-impact submission work that can be completed before the CWF deadline.

For each finding, cite exact file and line(s), explain its impact briefly, and propose the smallest truthful
fix. If there are no blockers, state that explicitly and list residual product limitations separately.
