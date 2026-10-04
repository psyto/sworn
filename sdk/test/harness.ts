// Shared by e2e.ts and harness-selftest.ts: how a challenger run becomes a CHECK line.
// A challenger that died, timed out, or lost its output is a HARNESS-FAILURE — it says nothing about
// Sworn — and is printed as `CHECK <id> HARNESS-FAILURE <reason>`; scripts/check-e2e.sh fails the run on
// it with its own message and exit code 3, distinct from a contract outcome (`CHECK <id> FAIL`).
import type { ChallengeResult } from '../src/index.ts'

export type CheckLine = { id: string; status: 'PASS' | 'FAIL' | 'HARNESS-FAILURE'; detail: string }

export const formatCheck = (c: CheckLine) => `CHECK ${c.id} ${c.status} ${c.detail}`

/** S-2.honestReverts from a dry-run challenge of the honest answer. */
export function honestRevertsCheck(hc: ChallengeResult): CheckLine {
  const id = 'S-2.honestReverts'
  if (hc.harnessFailure) return { id, status: 'HARNESS-FAILURE', detail: `honest challenge produced no outcome — ${hc.harnessFailure}; nothing sent; re-run (this is not "did not revert")` }
  const d = hc.result?.dryRun
  return {
    id, status: d?.reverted === true && d?.error === 'AnswerCorrect' ? 'PASS' : 'FAIL',
    detail: `honest challenge with a real Groth16 proof (${(hc.result?.proveWallSecs ?? 0).toFixed?.(0)} s): simulation ${d?.reverted ? 'reverted ' + d?.error : 'did NOT revert'}; nothing sent`,
  }
}
