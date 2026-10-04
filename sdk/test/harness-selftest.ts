// Selftest: a challenger that dies mid-proof is a HARNESS-FAILURE, not "did not revert".
// No chain, no keys, nothing sent. Runs the SDK's real challenge() against fake `sworn-challenge`
// executables (shell scripts) and checks each run's classification and the S-2.honestReverts CHECK line;
// then feeds a dead-challenger log through scripts/check-e2e.sh and expects exit 3 / HARNESS-FAILURE.
//   node sdk/test/harness-selftest.ts        (exit 0 = all cases as expected)
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ChallengerHarnessError, challenge, type PreflightResponse } from '../src/index.ts'
import { formatCheck, honestRevertsCheck } from './harness.ts'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const dir = mkdtempSync(join(tmpdir(), 'sworn-harness-selftest-'))
const witness = join(dir, 'x.witness.json')
writeFileSync(witness, '{}')
const resp = { digest: '0x' + '00'.repeat(32), question: { blockNumber: '1' } } as unknown as PreflightResponse

const fake = (name: string, body: string) => {
  const p = join(dir, name)
  writeFileSync(p, `#!/bin/sh\n${body}\n`)
  chmodSync(p, 0o755)
  return p
}
const PROVING = `echo "[sworn-challenge] proving Groth16 locally" >&2`
const fakes = {
  exitNonZeroSilent: fake('exit1-silent', `${PROVING}\nexit 1`),
  crashSignal: fake('crash-sigkill', `${PROVING}\nkill -9 $$`),
  hangsPastTimeout: fake('hang', `${PROVING}\nexec sleep 30`),
  garbageStdout: fake('garbage', `${PROVING}\necho "WRN ignoring uninitialized slice"\nexit 0`),
  proverFailed: fake('prover-failed', `${PROVING}\necho '{"ok":false,"error":"prover failed: signal: 9 (SIGKILL)"}'\nexit 1`),
  revertsAnswerCorrect: fake('reverts', `echo '{"dryRun":{"reverted":true,"error":"AnswerCorrect"},"proveWallSecs":1}'\nexit 2`),
  doesNotRevert: fake('no-revert', `echo '{"dryRun":{"reverted":false},"proveWallSecs":1}'\nexit 0`),
  sentSlashed: fake('sent', `echo '{"ok":true,"txHash":"0x${'ab'.repeat(32)}","status":"0x1","slashedEvent":true}'\nexit 0`),
}

let bad = 0
const expect = (name: string, ok: boolean, detail: string) => { console.log(`${ok ? 'ok  ' : 'BAD '} ${name}: ${detail}`); if (!ok) bad++ }

// dry run (S-2.honestReverts): [fake, expected CHECK status]
const dry: [keyof typeof fakes, 'PASS' | 'FAIL' | 'HARNESS-FAILURE'][] = [
  ['exitNonZeroSilent', 'HARNESS-FAILURE'], ['crashSignal', 'HARNESS-FAILURE'], ['hangsPastTimeout', 'HARNESS-FAILURE'],
  ['garbageStdout', 'HARNESS-FAILURE'], ['proverFailed', 'HARNESS-FAILURE'],
  ['revertsAnswerCorrect', 'PASS'], ['doesNotRevert', 'FAIL'],
]
let deadLine = ''
for (const [name, want] of dry) {
  const hc = await challenge(resp, { rpcUrl: 'http://127.0.0.1:1', witnessPath: witness, bin: fakes[name], dryRun: true, timeoutMs: 1_500 })
  const c = honestRevertsCheck(hc)
  expect(`dry/${name}`, c.status === want, `${formatCheck(c).slice(0, 220)}`)
  if (name === 'crashSignal') deadLine = formatCheck(c)
}

// sent (S-2.challengePays): dead challenger throws ChallengerHarnessError; a mined tx does not
for (const name of ['exitNonZeroSilent', 'crashSignal', 'proverFailed'] as const) {
  const e = await challenge(resp, { rpcUrl: 'http://127.0.0.1:1', witnessPath: witness, bin: fakes[name], timeoutMs: 1_500 }).then(() => null, (e) => e)
  expect(`send/${name}`, e instanceof ChallengerHarnessError && !!e.result.harnessFailure, String(e).slice(0, 200))
}
{
  const r = await challenge(resp, { rpcUrl: 'http://127.0.0.1:1', witnessPath: witness, bin: fakes.sentSlashed, timeoutMs: 5_000 })
  expect('send/sentSlashed', r.ok && !r.harnessFailure && !!r.txHash, `ok ${r.ok} tx ${r.txHash}`)
}

// The gate: take the recorded passing local log, replace its honestReverts PASS line by a dead
// challenger's line, and gate it. Expect exit 3 and HARNESS-FAILURE (not FAIL / "did not revert").
{
  const src = readFileSync(join(REPO, 'out/e2e/localnet-full-gate.log'), 'utf8')
  const log = src.replace(/^CHECK S-2\.honestReverts PASS .*$/m, deadLine)
  const p = join(dir, 'dead-challenger.log')
  writeFileSync(p, log)
  const g = spawnSync(join(REPO, 'scripts/check-e2e.sh'), ['--log', p], { encoding: 'utf8' })
  const out = g.stdout + g.stderr
  expect('gate/deadChallenger', log !== src && g.status === 3 && /^HARNESS-FAILURE S-2\.honestReverts$/m.test(out) && /verdict: HARNESS-FAILURE/.test(out) && !/a check FAILED/.test(out),
    `check-e2e.sh exit ${g.status}; ${out.split('\n').filter((l) => /HARNESS|verdict/.test(l)).join(' | ').slice(0, 300)}`)
  const g0 = spawnSync(join(REPO, 'scripts/check-e2e.sh'), ['--log', join(REPO, 'out/e2e/localnet-full-gate.log')], { encoding: 'utf8' })
  expect('gate/controlUnchanged', g0.status === 0 && /verdict: PASS/.test(g0.stdout), `recorded local log still exit ${g0.status}`)
}
console.log(`HARNESS SELFTEST ${bad ? 'FAIL' : 'PASS'} (${bad} unexpected) dir ${dir}`)
process.exit(bad ? 1 : 0)
