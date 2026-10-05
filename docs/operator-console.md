# Local Zone Operator Console

This is a **local demonstrator of a real proving job**, not a hosted proof API. It lets an operator start
the existing Groth16 proving pipeline for the withdrawal fixture, follow its output, and then runs the
existing read-only on-chain checks. It does not send an `attest` transaction and it cannot interact with a
ZonePortal.

## Run it

In one terminal, start the local worker:

```sh
scripts/start-zone-operator.sh
```

In another, serve the site locally:

```sh
cd site
npm run dev
```

Open the local site and use **Start local proof job** in the Zone Operations Console. The worker listens
only on `127.0.0.1:4317`; a deployed GitHub Pages page cannot start a job.

## What it proves

The only accepted job is `deposit_and_withdrawal_blocks5-6`, Tempo Zones' integration-test fixture on
development chain 1337. It contains one withdrawal and two user transactions. The worker runs:

1. `scripts/zone-prove.sh` against the deployed withdrawal-batch verifier;
2. `scripts/zone-attest.sh` without `--send`, which checks the new proof with `eth_call`, checks a mutation
   fails, and prints—but does not broadcast—the `attest` calldata.

The job usually takes about 15 minutes and requires roughly 20 GB RAM. Output is written under
`out/operator-zone-jobs/`, which is intentionally untracked.

## Boundary

A real Zone operator must provide its own private witness, genesis artifact, and version-compatible guest.
This local controller deliberately does not accept arbitrary files or select arbitrary Zones: that would
need authenticated operator access, input isolation, resource quotas, a job queue, and a Zone-specific
deployment. ZonePortal settlement remains a Tempo-side change described in spec 004.
