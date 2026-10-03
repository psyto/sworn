// Sworn answering server (spec 002 §1, §2).
//
//   POST /preflight   behind an MPP `tempo` charge (mppx/server). Body (after the 402 round-trip):
//                     { from, token, receiver, amount, memo?, feeToken, client, gasLimit? }
//                     → runs `sworn-answer` (with `--lie receiverAfter` in dishonest-demo mode),
//                     → sends reserve(q, a, client, coverage) from SWORN_SERVER_KEY,
//                     → returns the §2 JSON.
//   GET  /info        server address, contract, mode, price (free).
//
// Env (keys ONLY from env):
//   SWORN_SERVER_KEY   server's private key (reserves from its bond; receives the MPP charge)
//   SWORN_ADDRESS      Sworn contract
//   SWORN_RPC_URL      Tempo RPC (chain id must be 42431)
//   MPP_SECRET_KEY     mppx challenge-binding secret
//   SWORN_MODE         honest | dishonest-demo   (default honest)
//   PORT               default 8787
//   SWORN_PRICE        MPP charge amount in PRICE currency units (default "0.01")
//   SWORN_PRICE_CURRENCY  TIP-20 for the MPP charge (default pathUSD)
//   SWORN_MAX_COVERAGE coverage cap in bond-token base units (default 1000e6); coverage = min(amount, cap)
//   SWORN_ANSWER_BIN   default <repo>/target/release/sworn-answer
import { createServer, type IncomingMessage } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWalletClient, decodeEventLog, getAddress, http, isAddress, isHex, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { Mppx, tempo } from 'mppx/server'
import {
  GUEST_VERSION, PATH_USD, publicClientFor, runJson, swornAbi, swornChain, toAnswer, toQuestion,
  type AnswerJson, type PreflightResponse, type QuestionJson,
} from '../../sdk/src/index.ts'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const env = (k: string, d?: string) => {
  const v = process.env[k] ?? d
  if (v === undefined) { console.error(`missing env ${k}`); process.exit(2) }
  return v
}
const RPC = env('SWORN_RPC_URL')
const SWORN = getAddress(env('SWORN_ADDRESS'))
const MODE = env('SWORN_MODE', 'honest') as 'honest' | 'dishonest-demo'
if (MODE !== 'honest' && MODE !== 'dishonest-demo') { console.error('SWORN_MODE must be honest|dishonest-demo'); process.exit(2) }
const PORT = Number(env('PORT', '8787'))
const PRICE = env('SWORN_PRICE', '0.01')
const PRICE_CURRENCY = env('SWORN_PRICE_CURRENCY', PATH_USD) as Address
const MAX_COVERAGE = BigInt(env('SWORN_MAX_COVERAGE', '1000000000'))
const ANSWER_BIN = env('SWORN_ANSWER_BIN', join(REPO, 'target/release/sworn-answer'))
const account = privateKeyToAccount(env('SWORN_SERVER_KEY') as Hex)
const chain = swornChain(RPC)
const pc = publicClientFor(RPC)
const wallet = createWalletClient({ account, chain, transport: http(RPC, { timeout: 20_000, retryCount: 3 }) })

const mppx = Mppx.create({
  secretKey: env('MPP_SECRET_KEY'),
  realm: `sworn-${MODE}`,
  methods: [tempo.charge({ testnet: true, getClient: () => pc as any })],
})

let guestVkey: Hex
async function init() {
  const cid = await pc.getChainId()
  if (cid !== 42431) throw new Error(`chain id ${cid} != 42431`)
  guestVkey = await pc.readContract({ address: SWORN, abi: swornAbi, functionName: 'GUEST_VKEY' })
  const gv = await pc.readContract({ address: SWORN, abi: swornAbi, functionName: 'GUEST_VERSION' })
  if (gv !== GUEST_VERSION) throw new Error(`contract GUEST_VERSION ${gv} != ${GUEST_VERSION}`)
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = []
    let n = 0
    req.on('data', (c: Buffer) => { n += c.length; if (n > 64 * 1024) { rej(new Error('body too large')); req.destroy() } else chunks.push(c) })
    req.on('end', () => res(Buffer.concat(chunks)))
    req.on('error', rej)
  })
}
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body, (_, v) => (typeof v === 'bigint' ? v.toString() : v)), { status, headers: { 'content-type': 'application/json', ...headers } })

// One reserve at a time: the server key's nonce is shared.
let queue: Promise<unknown> = Promise.resolve()
const serial = <T>(f: () => Promise<T>): Promise<T> => { const p = queue.then(f, f); queue = p.catch(() => {}); return p }

async function preflight(body: any): Promise<Response> {
  for (const k of ['from', 'token', 'receiver', 'feeToken', 'client']) if (!isAddress(body?.[k] ?? '')) return json(400, { error: `bad ${k}` })
  if (!/^[0-9]+$/.test(String(body.amount ?? ''))) return json(400, { error: 'amount must be a decimal integer string (base units)' })
  if (body.memo != null && !(isHex(body.memo) && body.memo.length === 66)) return json(400, { error: 'memo must be bytes32 hex' })
  const req = { from: body.from, token: body.token, receiver: body.receiver, amount: String(body.amount), memo: body.memo ?? null,
    feeToken: body.feeToken, gasLimit: body.gasLimit ? String(body.gasLimit) : undefined }
  const args = MODE === 'dishonest-demo' ? ['--lie', 'receiverAfter'] : []
  return serial(async () => {
    const r = await runJson(ANSWER_BIN, args, { stdin: JSON.stringify(req), timeoutMs: 90_000, env: { ...process.env, SWORN_RPC_URL: RPC } })
    if (r.code === 3) return json(422, { error: 'refused', reason: r.json.reason })
    if (r.code !== 0 || !r.json?.ok) return json(502, { error: 'answerer failed', detail: r.json?.error ?? r.stderr.slice(-500) })
    const q: QuestionJson = r.json.question
    const a: AnswerJson = r.json.answer
    const coverage = BigInt(req.amount) < MAX_COVERAGE ? BigInt(req.amount) : MAX_COVERAGE
    const client = getAddress(body.client)
    let hash: Hex
    try {
      hash = await wallet.writeContract({ address: SWORN, abi: swornAbi, functionName: 'reserve', args: [toQuestion(q), toAnswer(a), client, coverage] })
    } catch (e) {
      return json(502, { error: 'reserve failed', detail: String((e as any)?.shortMessage ?? e) })
    }
    const rcpt = await pc.waitForTransactionReceipt({ hash, timeout: 60_000 })
    if (rcpt.status !== 'success') return json(502, { error: 'reserve reverted', reserveTx: hash })
    const ev = rcpt.logs.map((l) => { try { return decodeEventLog({ abi: swornAbi, data: l.data, topics: l.topics }) } catch { return null } })
      .find((d) => d?.eventName === 'Reserved')
    if (!ev || ev.eventName !== 'Reserved') return json(502, { error: 'no Reserved event', reserveTx: hash })
    const out: PreflightResponse = {
      question: q, answer: a, server: account.address, sworn: SWORN, digest: ev.args.digest, reserveTx: hash,
      coverage: coverage.toString(), mode: MODE, guestVersion: GUEST_VERSION, guestVkey,
      asOf: `the first transaction executed on the state after block ${q.blockNumber}, with block ${q.blockNumber}'s environment`,
      reservedInBlock: rcpt.blockNumber.toString(),
      expiry: ev.args.expiry.toString(),
      ...(MODE === 'dishonest-demo' ? { lie: r.json.lie, warning: 'DISHONEST DEMO SERVER: this answer is deliberately wrong' } : {}),
    }
    return json(200, out)
  })
}

await init()
createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
    let out: Response
    if (req.method === 'GET' && url.pathname === '/info') {
      out = json(200, { server: account.address, sworn: SWORN, mode: MODE, price: PRICE, priceCurrency: PRICE_CURRENCY, guestVkey, guestVersion: GUEST_VERSION, maxCoverage: MAX_COVERAGE.toString() })
    } else if (req.method === 'POST' && url.pathname === '/preflight') {
      const raw = await readBody(req)
      const request = new Request(url, { method: 'POST', headers: req.headers as Record<string, string>, body: raw.length ? new Uint8Array(raw) : undefined })
      const paid = await mppx.charge({ amount: PRICE, currency: PRICE_CURRENCY, recipient: account.address, description: 'Sworn preflight answer' })(request)
      if (paid.status === 402) out = paid.challenge
      else {
        let body: any
        try { body = JSON.parse(raw.toString('utf8')) } catch { body = null }
        out = paid.withReceipt(await preflight(body))
      }
    } else out = json(404, { error: 'not found' })
    res.writeHead(out.status, Object.fromEntries(out.headers))
    res.end(Buffer.from(await out.arrayBuffer()))
  } catch (e) {
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: String(e) }))
  }
}).listen(PORT, '127.0.0.1', () => console.error(`sworn server (${MODE}) ${account.address} on :${PORT}, contract ${SWORN}`))
