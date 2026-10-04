// Sworn client SDK (spec 002 §1, §3).
//
//   preflight(serverUrl, params, opts)  pays the MPP `tempo` charge (mppx client), then
//                                       verifyResponse() (§3.1–3.4), then captureWitness() (§3.5).
//   verifyResponse(resp, expected, client)  throws SwornCheckError(code) on any failed check.
//   captureWitness(resp, opts)          runs `sworn-witness`; failure ⇒ the answer is UNPROTECTED.
//   challenge(resp, witnessPath, opts)  runs `sworn-challenge` (local SP1 Groth16 proof + tx signed
//                                       with SWORN_CHALLENGER_KEY from the environment).
//
// No key is ever read from or written to a file by this SDK; the caller passes a viem account.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  createPublicClient, decodeEventLog, decodeFunctionData, encodeFunctionData, getAddress, hashTypedData, http, keccak256,
  type Address, type Hex, type LocalAccount, type PublicClient,
} from 'viem'
import { tempoModerato } from 'viem/chains'
import { Mppx, tempo } from 'mppx/client'
import {
  CHAIN_ID, DEFAULT_GAS_LIMIT, eip712Types, swornAbi, tip20Abi, toAnswer, toQuestion,
  type AnswerJson, type PreflightParams, type PreflightResponse, type QuestionJson,
} from './abi.ts'

export * from './abi.ts'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
/** Pinned by this SDK release: the guest it trusts (contracts/src/Sworn.sol GUEST_VKEY). */
export const GUEST_VKEY: Hex = '0x00727936ca684413200b13362eeb1c4a173a847466026678438ccca724ea7fa9'
export const GUEST_VERSION: Hex = '0x51e24160ef5467ba88166fd247c9bfb07b88e76ee08e430346c1353fda5e233d'
export const MAX_AGE = 32n

export function swornChain(rpcUrl: string) {
  return { ...tempoModerato, rpcUrls: { default: { http: [rpcUrl] } } } as unknown as typeof tempoModerato
}
export function publicClientFor(rpcUrl: string): PublicClient {
  return createPublicClient({ chain: swornChain(rpcUrl), transport: http(rpcUrl, { timeout: 20_000, retryCount: 3 }) }) as PublicClient
}

export type CheckCode =
  | 'QUESTION_MISMATCH' | 'RULE_R33' | 'WRONG_CONTRACT' | 'CODEHASH' | 'VKEY' | 'NO_RESERVATION'
  | 'WRONG_CLIENT' | 'DIGEST_MISMATCH' | 'COVERAGE_MISMATCH' | 'SERVER_MISMATCH' | 'BLOCK_MISMATCH'
export class SwornCheckError extends Error {
  code: CheckCode
  constructor(code: CheckCode, message: string) {
    super(`${code}: ${message}`)
    this.code = code
  }
}
const fail = (code: CheckCode, msg: string): never => { throw new SwornCheckError(code, msg) }

// ------------------------------------------------------------------------------------------------
// R3.3 (mirrors core/src/lib.rs check_question and Sworn._checkGuestWouldAnswer)
// ------------------------------------------------------------------------------------------------

export function isTip20(a: Address): boolean {
  return a.toLowerCase().startsWith('0x20c000000000000000000000')
}
export function isVirtual(a: Address): boolean {
  return a.toLowerCase().slice(2 + 8, 2 + 28) === 'fd'.repeat(10)
}
export function encodeTransfer(p: { receiver: Address; amount: string | bigint; memo?: Hex | null }): Hex {
  return p.memo
    ? encodeFunctionData({ abi: tip20Abi, functionName: 'transferWithMemo', args: [p.receiver, BigInt(p.amount), p.memo] })
    : encodeFunctionData({ abi: tip20Abi, functionName: 'transfer', args: [p.receiver, BigInt(p.amount)] })
}
/** Returns the decoded receiver or throws RULE_R33. */
export function checkR33(q: QuestionJson): Address {
  if (BigInt(q.chainId) !== BigInt(CHAIN_ID)) fail('RULE_R33', `chainId ${q.chainId}`)
  if (!isTip20(q.token)) fail('RULE_R33', `token ${q.token} is not a TIP-20 address`)
  let receiver: Address
  try {
    const d = decodeFunctionData({ abi: tip20Abi, data: q.data })
    if (d.functionName !== 'transfer' && d.functionName !== 'transferWithMemo') throw new Error('selector')
    receiver = d.args[0] as Address
    const re = d.functionName === 'transfer'
      ? encodeFunctionData({ abi: tip20Abi, functionName: 'transfer', args: [receiver, d.args[1] as bigint] })
      : encodeFunctionData({ abi: tip20Abi, functionName: 'transferWithMemo', args: [receiver, d.args[1] as bigint, d.args[2] as Hex] })
    if (re.toLowerCase() !== q.data.toLowerCase()) throw new Error('non-canonical calldata')
  } catch (e) {
    return fail('RULE_R33', `data is not canonical transfer/transferWithMemo (${(e as Error).message})`)
  }
  if (isVirtual(receiver)) fail('RULE_R33', `receiver ${receiver} is a virtual address`)
  if (getAddress(receiver) === getAddress(q.from)) fail('RULE_R33', 'receiver == from')
  return receiver
}

export function localDigest(sworn: Address, q: QuestionJson, a: AnswerJson): Hex {
  return hashTypedData({
    domain: { name: 'Sworn', version: '1', chainId: CHAIN_ID, verifyingContract: sworn },
    types: eip712Types,
    primaryType: 'SwornAnswer',
    message: { question: toQuestion(q), answer: toAnswer(a) },
  })
}

// ------------------------------------------------------------------------------------------------
// §3 checks
// ------------------------------------------------------------------------------------------------

export type Expected = {
  params: PreflightParams
  client: Address
  sworn: Address
  /** keccak256 of Sworn's runtime code (pin it once per deployment). */
  swornCodehash?: Hex
  guestVkey?: Hex
}

export type Verified = { digest: Hex; receiver: Address; reservedAtBlock: bigint; expiry: bigint; coverage: bigint }

export async function verifyResponse(resp: PreflightResponse, exp: Expected, pc: PublicClient): Promise<Verified> {
  const q = resp.question
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  // 1. the question is what we asked
  const asked = encodeTransfer(exp.params)
  if (!eq(q.from, exp.params.from)) fail('QUESTION_MISMATCH', `from ${q.from} != ${exp.params.from}`)
  if (!eq(q.token, exp.params.token)) fail('QUESTION_MISMATCH', `token ${q.token}`)
  if (!eq(q.feeToken, exp.params.feeToken)) fail('QUESTION_MISMATCH', `feeToken ${q.feeToken}`)
  if (!eq(q.data, asked)) fail('QUESTION_MISMATCH', 'data (receiver/amount/memo) differs from the request')
  if (exp.params.gasLimit && BigInt(q.gasLimit) !== BigInt(exp.params.gasLimit)) fail('QUESTION_MISMATCH', 'gasLimit')
  // 2. R3.3
  const receiver = checkR33(q)
  if (!eq(resp.answer.receiver, receiver)) fail('RULE_R33', `answer.receiver ${resp.answer.receiver} != decoded ${receiver}`)
  // contract identity
  if (!eq(resp.sworn, exp.sworn)) fail('WRONG_CONTRACT', `response names ${resp.sworn}, expected ${exp.sworn}`)
  if (exp.swornCodehash) {
    const code = await pc.getCode({ address: exp.sworn })
    if (!code || keccak256(code) !== exp.swornCodehash) fail('CODEHASH', `codehash of ${exp.sworn} is not the pinned one`)
  }
  // 4. guest vkey
  const vkey = await pc.readContract({ address: exp.sworn, abi: swornAbi, functionName: 'GUEST_VKEY' })
  const pinned = exp.guestVkey ?? GUEST_VKEY
  if (vkey !== pinned) fail('VKEY', `contract GUEST_VKEY ${vkey} != pinned ${pinned}`)
  if (!eq(resp.guestVkey, vkey)) fail('VKEY', `response guestVkey ${resp.guestVkey} != contract ${vkey}`)
  // 3. the Reserved event
  const rcpt = await pc.getTransactionReceipt({ hash: resp.reserveTx }).catch(() => null)
  if (!rcpt || rcpt.status !== 'success') fail('NO_RESERVATION', `reserveTx ${resp.reserveTx} has no successful receipt`)
  const ev = rcpt!.logs
    .filter((l) => eq(l.address, exp.sworn))
    .map((l) => { try { return decodeEventLog({ abi: swornAbi, data: l.data, topics: l.topics }) } catch { return null } })
    .find((d) => d?.eventName === 'Reserved')
  if (!ev || ev.eventName !== 'Reserved') return fail('NO_RESERVATION', `no Reserved event from ${exp.sworn} in ${resp.reserveTx}`)
  const r = ev.args
  if (!eq(r.server, resp.server)) fail('SERVER_MISMATCH', `Reserved.server ${r.server} != ${resp.server}`)
  if (!eq(r.client, exp.client)) fail('WRONG_CLIENT', `Reserved.client ${r.client} != self ${exp.client}`)
  const local = localDigest(exp.sworn, q, resp.answer)
  const onchain = await pc.readContract({ address: exp.sworn, abi: swornAbi, functionName: 'digestOf', args: [toQuestion(q), toAnswer(resp.answer)] })
  if (local !== onchain) fail('DIGEST_MISMATCH', `local EIP-712 ${local} != contract digestOf ${onchain}`)
  if (r.digest !== local) fail('DIGEST_MISMATCH', `Reserved.digest ${r.digest} != digest(q, a) ${local}`)
  if (!eq(resp.digest, local)) fail('DIGEST_MISMATCH', `response digest ${resp.digest} != ${local}`)
  if (r.coverage !== BigInt(resp.coverage)) fail('COVERAGE_MISMATCH', `Reserved.coverage ${r.coverage} != stated ${resp.coverage}`)
  if (r.blockNumber !== BigInt(q.blockNumber) || r.blockHash !== q.blockHash) fail('BLOCK_MISMATCH', 'Reserved block != question block')
  // the reservation is live now
  const key = await pc.readContract({ address: exp.sworn, abi: swornAbi, functionName: 'reservationKey', args: [r.server, r.digest] })
  const [client, expiry, status, coverage] = await pc.readContract({ address: exp.sworn, abi: swornAbi, functionName: 'reservations', args: [key] })
  if (status !== 1) fail('NO_RESERVATION', `reservation status ${status} (1 = Active)`)
  if (!eq(client, exp.client)) fail('WRONG_CLIENT', `stored client ${client}`)
  return { digest: local, receiver, reservedAtBlock: rcpt!.blockNumber, expiry, coverage }
}

// ------------------------------------------------------------------------------------------------
// Rust CLIs
// ------------------------------------------------------------------------------------------------

/** `code` null ⇒ the process died by `signal` (`timedOut` ⇒ we killed it at `timeoutMs`). `jsonMissing` ⇒
 *  its last stdout line was not JSON, so `json` is a synthesized `{ok:false,error}` and NOT the tool's output. */
export type RunResult = { code: number | null; signal: NodeJS.Signals | null; timedOut: boolean; jsonMissing: boolean; json: any; stderr: string; ms: number }
export function runJson(bin: string, args: string[], opts: { env?: NodeJS.ProcessEnv; stdin?: string; timeoutMs: number; onStderr?: (s: string) => void }): Promise<RunResult> {
  return new Promise((res) => {
    const t0 = Date.now()
    const p = spawn(bin, args, { env: opts.env ?? process.env, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = '', err = '', timedOut = false
    const timer = setTimeout(() => { timedOut = true; p.kill('SIGKILL') }, opts.timeoutMs)
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => { err += d; opts.onStderr?.(String(d)) })
    p.on('error', (e) => { err += String(e) })
    p.on('close', (code, signal) => {
      clearTimeout(timer)
      const line = out.trim().split('\n').filter(Boolean).pop() ?? ''
      let json: any = null, jsonMissing = false
      try { json = JSON.parse(line) } catch { jsonMissing = true }
      if (jsonMissing || json === null || typeof json !== 'object') {
        jsonMissing = true
        json = { ok: false, error: `no JSON output (exit ${code}${signal ? `, signal ${signal}` : ''}${timedOut ? `, killed at ${opts.timeoutMs} ms timeout` : ''}): ${err.slice(-500)}` }
      }
      res({ code, signal, timedOut, jsonMissing, json, stderr: err, ms: Date.now() - t0 })
    })
    p.stdin.end(opts.stdin ?? '')
  })
}

export type WitnessResult =
  | { protection: 'protected'; path: string; trueAnswer: AnswerJson; answerMatchesWitness: boolean; elapsedMs: number }
  | { protection: 'unprotected'; reason: string; elapsedMs: number }

export async function captureWitness(resp: PreflightResponse, opts: { rpcUrl: string; dir: string; bin?: string; deadlineSecs?: number }): Promise<WitnessResult> {
  mkdirSync(opts.dir, { recursive: true })
  const respPath = join(opts.dir, `${resp.digest}.response.json`)
  writeFileSync(respPath, JSON.stringify(resp, null, 2))
  const out = join(opts.dir, `${resp.digest}.witness.json`)
  const deadline = opts.deadlineSecs ?? 120
  const r = await runJson(opts.bin ?? join(REPO, 'target/release/sworn-witness'), ['--in', respPath, '--out', out, '--deadline-secs', String(deadline)], {
    env: { ...process.env, SWORN_RPC_URL: opts.rpcUrl }, timeoutMs: (deadline + 15) * 1000,
  })
  if (r.code !== 0 || !r.json?.ok) return { protection: 'unprotected', reason: r.json?.error ?? `exit ${r.code}`, elapsedMs: r.ms }
  const t: AnswerJson = r.json.trueAnswer
  const a = resp.answer
  const same = (Object.keys(a) as (keyof AnswerJson)[]).every((k) => String(t[k]).toLowerCase() === String(a[k]).toLowerCase())
  return { protection: 'protected', path: out, trueAnswer: t, answerMatchesWitness: same, elapsedMs: r.ms }
}

export type ChallengeEvent = { phase: 'witness' | 'proving' | 'submitting'; line?: string } | { phase: 'log'; line: string }
export type ChallengeCtx = {
  rpcUrl: string
  /** Witness captured by preflight(); looked up by digest when omitted. */
  witnessPath?: string
  witnessDir?: string
  bin?: string
  proofOut?: string
  /** Reuse an existing proof JSON (skips proving). */
  proof?: string
  /** eth_call only; nothing is sent (used to show an honest answer's challenge reverts). */
  dryRun?: boolean
  /** Kill the challenger after this long (default 30 min); a kill is a harness failure, not an outcome. */
  timeoutMs?: number
  onProgress?: (e: ChallengeEvent) => void
  [k: string]: unknown
}
/**
 * `harnessFailure` is set when the challenger PROCESS did not produce an outcome: it timed out, died by a
 * signal, printed no JSON, or exited for a reason that is not a contract result (e.g. the prover failed).
 * Then `result` says nothing about Sworn: a harness must report HARNESS-FAILURE, never "did not revert".
 */
export type ChallengeResult = { txHash?: Hex; ok: boolean; exitCode: number | null; result: any; harnessFailure?: string }

/** Thrown by a non-dry-run challenge() when the challenger process itself failed (see ChallengeResult). */
export class ChallengerHarnessError extends Error {
  result: ChallengeResult
  constructor(reason: string, result: ChallengeResult) { super(`HARNESS-FAILURE: ${reason}`); this.name = 'ChallengerHarnessError'; this.result = result }
}

/**
 * Classify one `sworn-challenge` run. Returns a reason when the run is a HARNESS failure, undefined when
 * its output is a contract outcome. The only contract outcomes are:
 *   dry run: exit 0 with dryRun.reverted=false, or exit 2 with dryRun.reverted=true and an error name;
 *   sent:    a txHash (mined, any status), or exit 2 (the send itself was refused, e.g. simulation revert).
 */
export function challengerHarnessFailure(r: RunResult, dryRun: boolean): string | undefined {
  const tail = (r.stderr.trim().split('\n').pop() ?? '').replace(/\x1b\[[0-9;]*m/g, '').slice(0, 200)
  if (r.timedOut) return `challenger killed at its timeout after ${(r.ms / 1000).toFixed(0)} s (no outcome); last stderr: ${tail}`
  if (r.code === null) return `challenger died by signal ${r.signal ?? '?'} after ${(r.ms / 1000).toFixed(0)} s (no outcome); last stderr: ${tail}`
  if (r.jsonMissing) return `challenger exited ${r.code} with no JSON on stdout (output lost); last stderr: ${tail}`
  const j = r.json
  if (dryRun) {
    const d = j?.dryRun
    if (!d || typeof d.reverted !== 'boolean') return `challenger exited ${r.code} without a dry-run result: ${String(j?.error ?? JSON.stringify(j)).slice(0, 300)}`
    if (d.reverted && (r.code !== 2 || typeof d.error !== 'string' || !d.error)) return `inconsistent dry-run output (exit ${r.code}, reverted, error ${d.error})`
    if (!d.reverted && r.code !== 0) return `inconsistent dry-run output (exit ${r.code}, not reverted)`
    return undefined
  }
  if (j?.txHash) return undefined
  if (r.code === 2) return undefined
  return `challenger exited ${r.code} before sending: ${String(j?.error ?? JSON.stringify(j)).slice(0, 300)}`
}

/** Witness paths captured by preflight() in this process, by digest. */
const witnessByDigest = new Map<string, string>()

/**
 * Prove locally (SP1 Groth16, ≈6.5 min) and send challenge(server, q, a, publicValues, proof) via
 * `sworn-challenge`. SWORN_CHALLENGER_KEY must be in this process's environment.
 * Throws unless a challenge transaction was mined successfully (dryRun: returns the simulation).
 * A challenger that dies, times out or loses its output throws ChallengerHarnessError (dryRun: returns
 * `harnessFailure` set) — never a contract outcome.
 */
export async function challenge(response: PreflightResponse, ctx: ChallengeCtx): Promise<ChallengeResult> {
  const on = ctx.onProgress ?? (() => {})
  let witnessPath = ctx.witnessPath ?? witnessByDigest.get(response.digest.toLowerCase())
  if (!witnessPath) {
    on({ phase: 'witness' })
    const w = await captureWitness(response, { rpcUrl: ctx.rpcUrl, dir: ctx.witnessDir ?? defaultWitnessDir() })
    if (w.protection !== 'protected') throw new Error(`no witness for block ${response.question.blockNumber}: ${w.reason}`)
    witnessPath = w.path
  }
  const respPath = witnessPath.replace(/\.witness\.json$/, '') + '.challenge-response.json'
  writeFileSync(respPath, JSON.stringify(response, null, 2))
  const args = ['--witness', witnessPath, '--response', respPath]
  if (ctx.proofOut) args.push('--proof-out', ctx.proofOut)
  if (ctx.proof) args.push('--proof', ctx.proof)
  if (ctx.dryRun) args.push('--dry-run')
  on({ phase: 'proving' })
  let submitted = false
  const r = await runJson(ctx.bin ?? join(REPO, 'target/release/sworn-challenge'), args, {
    env: { ...process.env, SWORN_RPC_URL: ctx.rpcUrl }, timeoutMs: ctx.timeoutMs ?? 30 * 60_000,
    onStderr: (chunk) => {
      for (const line of chunk.split('\n').filter(Boolean)) {
        if (!submitted && line.includes('[sworn-challenge] submitting')) { submitted = true; on({ phase: 'submitting', line }) }
        else on({ phase: 'log', line })
      }
    },
  })
  const harnessFailure = challengerHarnessFailure(r, !!ctx.dryRun)
  const out: ChallengeResult = { txHash: r.json?.txHash, ok: !harnessFailure && r.code === 0 && (ctx.dryRun ? true : r.json?.ok === true), exitCode: r.code, result: r.json,
    ...(harnessFailure ? { harnessFailure } : {}) }
  if (ctx.dryRun) return out
  if (harnessFailure) throw new ChallengerHarnessError(harnessFailure, out)
  if (!out.ok || !out.txHash) throw new Error(`challenge failed (exit ${r.code}): ${r.json?.error ?? JSON.stringify(r.json)}`)
  return out
}

// ------------------------------------------------------------------------------------------------
// preflight
// ------------------------------------------------------------------------------------------------

export type PreflightOpts = {
  account: LocalAccount
  rpcUrl: string
  sworn: Address
  swornCodehash?: Hex
  guestVkey?: Hex
  /** default: $TMPDIR/sworn-witness */
  witnessDir?: string
  witnessBin?: string
  /** Override the payment-aware fetch (default: mppx client with a `tempo` charge paid by `account`). */
  fetch?: typeof globalThis.fetch
  [k: string]: unknown
}
export type PreflightResult = {
  response: PreflightResponse
  verified: Verified
  witness: WitnessResult
  /** false ⇒ UNPROTECTED: no witness was captured inside the proof window (§3.5). */
  protected: boolean
  note: string
  /** The MPP charge paid for this answer (from the server's Payment-Receipt and /info). */
  payment: { txHash?: Hex; amount?: string; currency?: Address; receipt?: unknown }
}

export function defaultWitnessDir(): string {
  return join(tmpdir(), 'sworn-witness')
}

export function paidFetch(account: LocalAccount, rpcUrl: string): typeof globalThis.fetch {
  const getClient = () => publicClientFor(rpcUrl) as any
  const m = Mppx.create({ polyfill: false, methods: [tempo.charge({ account, getClient })] })
  return m.fetch as unknown as typeof globalThis.fetch
}

function decodeReceipt(h: string | null): any {
  if (!h) return null
  try { return JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) } catch { return null }
}

/**
 * Buy a preflight answer and decide whether the client may rely on it.
 * `params.client`, if given, must be the paying account. Throws SwornCheckError when any §3 check
 * fails; returns protected=false (never throws) when only the witness capture failed.
 */
export async function preflight(serverUrl: string, params: PreflightParams & { client?: Address }, opts: PreflightOpts): Promise<PreflightResult> {
  const self = opts.account.address
  if (params.client && getAddress(params.client) !== getAddress(self)) throw new Error(`params.client ${params.client} is not the paying account ${self}`)
  const ask: PreflightParams = { from: params.from, token: params.token, receiver: params.receiver, amount: String(params.amount),
    memo: params.memo ?? null, feeToken: params.feeToken, gasLimit: String(params.gasLimit ?? DEFAULT_GAS_LIMIT) }
  // Refuse locally before paying for a question the guest could never answer (R3.3).
  checkR33({ chainId: String(CHAIN_ID), blockNumber: '0', blockHash: `0x${'00'.repeat(32)}`, from: ask.from, token: ask.token,
    data: encodeTransfer(ask), feeToken: ask.feeToken, gasLimit: ask.gasLimit! })
  const base = serverUrl.replace(/\/$/, '')
  const info = await fetch(base + '/info').then((r) => r.json()).catch(() => null)
  const f = opts.fetch ?? paidFetch(opts.account, opts.rpcUrl)
  const res = await f(base + '/preflight', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...ask, client: self }),
  })
  const body = await res.json().catch(() => null)
  if (res.status !== 200) throw new Error(`preflight HTTP ${res.status}: ${JSON.stringify(body)}`)
  const receipt = decodeReceipt(res.headers.get('payment-receipt'))
  const response = body as PreflightResponse
  const pc = publicClientFor(opts.rpcUrl)
  const verified = await verifyResponse(response, {
    params: ask, client: self, sworn: opts.sworn, swornCodehash: opts.swornCodehash, guestVkey: opts.guestVkey,
  }, pc)
  // §3.5: our own witness for N, now (the RPC's proof window is ~150 s).
  const witness = await captureWitness(response, { rpcUrl: opts.rpcUrl, dir: opts.witnessDir ?? defaultWitnessDir(), bin: opts.witnessBin })
  if (witness.protection === 'protected') witnessByDigest.set(response.digest.toLowerCase(), witness.path)
  const note = witness.protection === 'protected'
    ? (witness.answerMatchesWitness ? 'reservation verified; own witness captured; the answer matches it' :
      'reservation verified; own witness captured; THE ANSWER DISAGREES WITH THE WITNESS — challengeable')
    : `UNPROTECTED: witness capture failed (${witness.reason}); a wrong answer could not be proven`
  return {
    response, verified, witness, protected: witness.protection === 'protected', note,
    payment: { txHash: receipt?.reference, amount: info?.price, currency: info?.priceCurrency, receipt },
  }
}
