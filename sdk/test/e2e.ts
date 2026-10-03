// End-to-end for spec 002 S-1..S-4. Two targets (SWORN_E2E_TARGET):
//   local    (default) the Sworn local chain (scripts/localnet.sh: Tempo's own node at the vendored
//            commit, Moderato genesis config, real SP1VerifierGroth16 etched at genesis); deploys a
//            fresh Sworn. Run by scripts/e2e.sh.
//   moderato the deployed Sworn in deployments/moderato.json on https://rpc.moderato.tempo.xyz.
//            Bond/policy only if missing (read from chain first). SWORN_E2E_DRY_RUN=1 = reads only,
//            prints the plan, sends nothing. Run by scripts/moderato-run.sh (under with-keys.sh).
// Every result is printed as `CHECK <id> PASS|FAIL <detail>`; scripts/check-e2e.sh asserts the set.
// Every transaction is printed as `TX <label> <hash> <explorer link>` on Moderato.
//
// Keys come ONLY from env, never printed:
//   local:    SWORN_DEPLOYER_KEY SWORN_SERVER_KEY SWORN_DISHONEST_SERVER_KEY SWORN_CLIENT_KEY
//             SWORN_CHALLENGER_KEY SWORN_BLOCKING_RECEIVER_KEY (dev accounts of the local chain)
//   moderato: SWORN_DEPLOYER_KEY (also R', the receiver whose policy blocks the client)
//             SWORN_CHALLENGER_KEY SWORN_HONEST_KEY SWORN_DISHONEST_KEY DEMO_CLIENT_KEY
// Other env: SWORN_RPC_URL (default http://127.0.0.1:8546), SWORN_E2E_STAGES (default S-1,S-3,S-2,S-4),
//   SWORN_DRIFT_RPC_URL (S-4 drifted chain), SWORN_E2E_INJECT (fault injection to prove the gate fails).
import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWalletClient, getAddress, http, keccak256, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  DEFAULT_GAS_LIMIT, GUEST_VKEY, PATH_USD, RECEIVE_POLICY_GUARD, SwornCheckError, TIP403_REGISTRY, challenge, encodeTransfer, preflight, publicClientFor, runJson,
  swornAbi, swornChain, tip20Abi, tip403Abi, verifyResponse, type PreflightParams, type PreflightResponse,
} from '../src/index.ts'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const TARGET = (process.env.SWORN_E2E_TARGET ?? 'local') as 'local' | 'moderato'
if (TARGET !== 'local' && TARGET !== 'moderato') { console.error('SWORN_E2E_TARGET must be local|moderato'); process.exit(2) }
const MOD = TARGET === 'moderato'
const DRY = MOD && !!process.env.SWORN_E2E_DRY_RUN
const RPC = process.env.SWORN_RPC_URL ?? (MOD ? 'https://rpc.moderato.tempo.xyz' : 'http://127.0.0.1:8546')
const EXPLORER = 'https://explore.testnet.tempo.xyz/tx/'
const STAGES = (process.env.SWORN_E2E_STAGES ?? 'S-1,S-3,S-2,S-4').split(',')
const PORTS = (process.env.SWORN_E2E_PORTS ?? '8787,8788').split(',').map(Number)
const HONEST_URL = `http://127.0.0.1:${PORTS[0]}`, DISHONEST_URL = `http://127.0.0.1:${PORTS[1]}`
const INJECT = process.env.SWORN_E2E_INJECT ?? ''
const WORK = process.env.SWORN_E2E_DIR ?? join('/tmp', `sworn-e2e-${Date.now()}`)
mkdirSync(WORK, { recursive: true })
const key = (k: string) => { const v = process.env[k]; if (!v) { console.error(`missing env ${k}`); process.exit(2) } return v as Hex }
const acct = (k: string) => privateKeyToAccount(key(k))
// env var holding each role's key, per target
const KEYVAR = MOD
  ? { deployer: 'SWORN_DEPLOYER_KEY', honest: 'SWORN_HONEST_KEY', dishonest: 'SWORN_DISHONEST_KEY', client: 'DEMO_CLIENT_KEY', challenger: 'SWORN_CHALLENGER_KEY', blocking: 'SWORN_DEPLOYER_KEY' }
  : { deployer: 'SWORN_DEPLOYER_KEY', honest: 'SWORN_SERVER_KEY', dishonest: 'SWORN_DISHONEST_SERVER_KEY', client: 'SWORN_CLIENT_KEY', challenger: 'SWORN_CHALLENGER_KEY', blocking: 'SWORN_BLOCKING_RECEIVER_KEY' }
const deployer = acct(KEYVAR.deployer), honest = acct(KEYVAR.honest), dishonest = acct(KEYVAR.dishonest)
const client = acct(KEYVAR.client), challenger = acct(KEYVAR.challenger), blocking = acct(KEYVAR.blocking)
// Honest question's receiver: any address without a blocking policy that is not the client.
const PLAIN_RECEIVER: Address = MOD ? dishonest.address : '0x976EA74026E726554dB657fA54763abd0C3a0aa9'
const ALPHA: Address = '0x20c0000000000000000000000000000000000001'
const chain = swornChain(RPC)
const pc = publicClientFor(RPC)
const wc = (a: ReturnType<typeof acct>) => createWalletClient({ account: a, chain, transport: http(RPC, { timeout: 20_000, retryCount: 3 }) })

let failures = 0
function check(id: string, ok: boolean, detail: string) {
  console.log(`CHECK ${id} ${ok ? 'PASS' : 'FAIL'} ${detail}`)
  if (!ok) failures++
}
const log = (s: string) => console.log(`  ${new Date().toISOString().slice(11, 19)} ${s}`)
const tx = (label: string, h: string | undefined) => { if (h) console.log(`TX ${label} ${h} ${MOD ? EXPLORER + h : '(local chain, no explorer)'}`) }
async function send(a: ReturnType<typeof acct>, req: any, label = req.functionName): Promise<Hex> {
  if (DRY) throw new Error(`dry run must not send (${label})`)
  const h = await wc(a).writeContract(req)
  tx(label, h)
  const r = await pc.waitForTransactionReceipt({ hash: h, timeout: 90_000 })
  if (r.status !== 'success') throw new Error(`tx ${h} reverted`)
  return h
}

// ---------------------------------------------------------------------------------------------
async function deploySworn(): Promise<{ address: Address; codehash: Hex }> {
  const art = JSON.parse(readFileSync(join(REPO, 'contracts/out/Sworn.sol/Sworn.json'), 'utf8'))
  const h = await wc(deployer).deployContract({ abi: art.abi, bytecode: art.bytecode.object })
  const r = await pc.waitForTransactionReceipt({ hash: h, timeout: 60_000 })
  if (r.status !== 'success' || !r.contractAddress) throw new Error(`deploy ${h} failed`)
  const code = await pc.getCode({ address: r.contractAddress })
  return { address: r.contractAddress, codehash: keccak256(code!) }
}

const VERIFIER_HASH_ABI = [{ type: 'function', name: 'VERIFIER_HASH', inputs: [], outputs: [{ type: 'bytes32' }], stateMutability: 'pure' }] as const

/** Moderato: use the deployed contract; bond / set the policy only when chain state lacks them. */
async function setupModerato() {
  const d = JSON.parse(readFileSync(join(REPO, 'deployments/moderato.json'), 'utf8'))
  const sworn = getAddress(d.Sworn.address)
  const cid = await pc.getChainId()
  check('SETUP.chain', cid === 42431, `chain id ${cid} at ${RPC}`)
  const code = await pc.getCode({ address: sworn })
  const codehash = code ? keccak256(code) : '0x'
  check('SETUP.codehash', codehash === d.Sworn.codehash, `Sworn ${sworn} codehash ${codehash} (recorded ${d.Sworn.codehash})`)
  const verifier = await pc.readContract({ address: sworn, abi: swornAbi, functionName: 'SP1_VERIFIER' })
  const vhash = await pc.readContract({ address: verifier, abi: VERIFIER_HASH_ABI, functionName: 'VERIFIER_HASH' })
  check('SETUP.verifier', getAddress(verifier) === getAddress(d.SP1VerifierGroth16.address) && vhash === d.SP1VerifierGroth16.VERIFIER_HASH,
    `Sworn.SP1_VERIFIER=${verifier}, VERIFIER_HASH=${vhash} (SP1 v6.1.0 Groth16)`)
  const vkey = await pc.readContract({ address: sworn, abi: swornAbi, functionName: 'GUEST_VKEY' })
  check('SETUP.vkey', vkey === GUEST_VKEY, `Sworn.GUEST_VKEY=${vkey}`)
  const roles: [string, Address][] = [['deployer/challenger/R\'', deployer.address], ['honest', honest.address], ['dishonest', dishonest.address], ['client', client.address]]
  for (const [n, a] of roles) {
    const [pu, al] = await Promise.all([PATH_USD, ALPHA].map((t) => pc.readContract({ address: t, abi: tip20Abi, functionName: 'balanceOf', args: [a] })))
    log(`balance ${n} ${a}: pathUSD ${pu}, AlphaUSD ${al}`)
  }
  const clientAlpha = await pc.readContract({ address: ALPHA, abi: tip20Abi, functionName: 'balanceOf', args: [client.address] })
  check('SETUP.clientFunded', clientAlpha >= 1_000_000_000n, `client AlphaUSD ${clientAlpha} (needs ≥ 1000000000 for two 500 questions and one real payment)`)
  const BOND = 2_000_000_000n // 2,000 of the bond token (pathUSD)
  for (const [n, s] of [['honest', honest], ['dishonest', dishonest]] as const) {
    const free = (await pc.readContract({ address: sworn, abi: swornAbi, functionName: 'servers', args: [s.address] }))[0]
    if (free >= BOND) { log(`bond ${n}: free ${free} >= ${BOND}, skip`); continue }
    const add = BOND - free
    if (DRY) { console.log(`PLAN approve(${sworn}, ${add}) + bond(${s.address}, ${add}) from ${n} ${s.address}`); continue }
    await send(s, { address: PATH_USD, abi: tip20Abi, functionName: 'approve', args: [sworn, add] }, `approve-${n}`)
    await send(s, { address: sworn, abi: swornAbi, functionName: 'bond', args: [s.address, add] }, `bond-${n}`)
  }
  let [authorized] = await pc.readContract({ address: TIP403_REGISTRY, abi: tip403Abi, functionName: 'validateReceivePolicy', args: [ALPHA, client.address, blocking.address] })
  if (!authorized) log(`receive policy of R' ${blocking.address} already blocks the client, skip`)
  else if (DRY) console.log(`PLAN setReceivePolicy(0 REJECT_ALL, 1 ALLOW_ALL, self) from R' ${blocking.address}`)
  else await send(blocking, { address: TIP403_REGISTRY, abi: tip403Abi, functionName: 'setReceivePolicy', args: [0n, 1n, '0x0000000000000000000000000000000000000000'] }, 'setReceivePolicy')
  if (!DRY) {
    const [a2, reason] = await pc.readContract({ address: TIP403_REGISTRY, abi: tip403Abi, functionName: 'validateReceivePolicy', args: [ALPHA, client.address, blocking.address] })
    check('SETUP.receivePolicy', a2 === false && reason === 2, `validateReceivePolicy(AlphaUSD, client, R'=${blocking.address})=(${a2}, reason ${reason}=RECEIVE_POLICY)`)
    const free = (await pc.readContract({ address: sworn, abi: swornAbi, functionName: 'servers', args: [honest.address] }))[0]
    const free2 = (await pc.readContract({ address: sworn, abi: swornAbi, functionName: 'servers', args: [dishonest.address] }))[0]
    check('SETUP.bond', free >= 500_000_000n && free2 >= 500_000_000n, `free bond honest ${free}, dishonest ${free2} (each needs ≥ coverage 500000000)`)
  }
  // "other contract" = a different real contract (the verifier); "missing reservation" = Sworn's deploy tx.
  const dep = { rpc: RPC, sworn, swornCodehash: codehash as Hex, otherSworn: getAddress(verifier), verifier, honestServer: honest.address,
    dishonestServer: dishonest.address, client: client.address, challenger: challenger.address, blockingReceiver: blocking.address,
    plainReceiver: PLAIN_RECEIVER, nonReserveTx: d.Sworn.tx as Hex }
  writeFileSync(join(WORK, 'deployment.json'), JSON.stringify(dep, null, 2))
  log(`deployment: ${JSON.stringify(dep)}`)
  return dep
}

async function setup() {
  if (MOD) return setupModerato()
  const sworn = await deploySworn()
  const other = await deploySworn() // same code, different address: the "other contract" case
  const verifier = await pc.readContract({ address: sworn.address, abi: swornAbi, functionName: 'SP1_VERIFIER' })
  const vcode = await pc.getCode({ address: verifier })
  const vhash = await pc.readContract({ address: verifier, abi: [{ type: 'function', name: 'VERIFIER_HASH', inputs: [], outputs: [{ type: 'bytes32' }], stateMutability: 'pure' }] as const, functionName: 'VERIFIER_HASH' })
  const vkey = await pc.readContract({ address: sworn.address, abi: swornAbi, functionName: 'GUEST_VKEY' })
  check('SETUP.verifier', !!vcode && vcode.length > 2 && vhash === '0x4388a21c687fdd5f218d7e3d13190cac4c5355818d3605fd5fb811df468ee696',
    `Sworn.SP1_VERIFIER=${verifier} has ${(vcode!.length - 2) / 2} bytes, VERIFIER_HASH=${vhash} (SP1 v6.1.0 Groth16)`)
  check('SETUP.vkey', vkey === GUEST_VKEY, `Sworn.GUEST_VKEY=${vkey}`)
  const BOND = 10_000_000_000n // 10,000 pathUSD
  for (const s of [honest, dishonest]) {
    await send(s, { address: PATH_USD, abi: tip20Abi, functionName: 'approve', args: [sworn.address, BOND] })
    await send(s, { address: sworn.address, abi: swornAbi, functionName: 'bond', args: [s.address, BOND] })
  }
  const bondTx = await send(honest, { address: PATH_USD, abi: tip20Abi, functionName: 'approve', args: [other.address, 1n] })
  // R' blocks every sender: senderPolicyId 0 = REJECT_ALL, tokenFilterId 1 = ALLOW_ALL, recovery = self.
  await send(blocking, { address: TIP403_REGISTRY, abi: tip403Abi, functionName: 'setReceivePolicy', args: [0n, 1n, '0x0000000000000000000000000000000000000000'] })
  const [authorized, reason] = await pc.readContract({ address: TIP403_REGISTRY, abi: tip403Abi, functionName: 'validateReceivePolicy', args: [ALPHA, client.address, blocking.address] })
  check('SETUP.receivePolicy', authorized === false && reason === 2, `validateReceivePolicy(AlphaUSD, client, R')=(${authorized}, reason ${reason}=RECEIVE_POLICY)`)
  const free = (await pc.readContract({ address: sworn.address, abi: swornAbi, functionName: 'servers', args: [honest.address] }))[0]
  check('SETUP.bond', free === BOND, `honest server free bond ${free}`)
  const dep = { rpc: RPC, sworn: sworn.address, swornCodehash: sworn.codehash, otherSworn: other.address, verifier, honestServer: honest.address,
    dishonestServer: dishonest.address, client: client.address, challenger: challenger.address, blockingReceiver: blocking.address, plainReceiver: PLAIN_RECEIVER, nonReserveTx: bondTx }
  writeFileSync(join(WORK, 'deployment.json'), JSON.stringify(dep, null, 2))
  log(`deployment: ${JSON.stringify(dep)}`)
  return dep
}

function startServer(mode: 'honest' | 'dishonest-demo', port: number, keyVar: string, sworn: Address): Promise<ChildProcess> {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, [join(REPO, 'server/src/server.ts')], {
      env: { ...process.env, SWORN_SERVER_KEY: key(keyVar), SWORN_ADDRESS: sworn, SWORN_RPC_URL: RPC, SWORN_MODE: mode,
        PORT: String(port), MPP_SECRET_KEY: process.env.MPP_SECRET_KEY ?? randomBytes(32).toString('hex'), NODE_NO_WARNINGS: '1' },
      stdio: ['ignore', 'inherit', 'pipe'],
    })
    let buf = ''
    const t = setTimeout(() => rej(new Error(`server ${mode} did not start: ${buf}`)), 30_000)
    p.stderr!.on('data', (d) => { buf += d; process.stderr.write(`[server ${mode}] ${d}`); if (buf.includes(' on :')) { clearTimeout(t); res(p) } })
    p.on('exit', (c) => { clearTimeout(t); rej(new Error(`server ${mode} exited ${c}: ${buf}`)) })
  })
}

// ---------------------------------------------------------------------------------------------
async function main() {
  console.log(`TARGET ${TARGET}${DRY ? ' (DRY RUN: reads only, nothing is sent)' : ''} rpc ${RPC}`)
  const dep = await setup()
  if (DRY) {
    console.log(`PLAN start honest server (${honest.address}) on :${PORTS[0]} and dishonest-demo server (${dishonest.address}) on :${PORTS[1]}`)
    console.log(`PLAN S-1 honest preflight: client ${client.address} → ${PLAIN_RECEIVER}, 500 AlphaUSD, gasLimit ${DEFAULT_GAS_LIMIT}; MPP charge + reserve tx; SDK verify; own witness`)
    console.log(`PLAN S-3 nine SDK rejection cases (reads only) + control`)
    console.log(`PLAN S-2 dishonest preflight: client → R' ${blocking.address}; reserve; witness; REAL payment client→R' (diverted to ReceivePolicyGuard ${RECEIVE_POLICY_GUARD}); local Groth16 (~6 min); challenge tx from ${challenger.address}; honest challenge by simulation (second local proof, ~6 min, nothing sent)`)
    console.log(`PLAN S-4 answerer against the live schedule (reads only)`)
    console.log(`DRY RUN DONE failures=${failures}`)
    process.exit(failures ? 1 : 0)
  }
  const servers = [await startServer('honest', PORTS[0], KEYVAR.honest, dep.sworn), await startServer('dishonest-demo', PORTS[1], KEYVAR.dishonest, dep.sworn)]
  const ctx = { account: client, rpcUrl: RPC, sworn: dep.sworn, swornCodehash: dep.swornCodehash, witnessDir: join(WORK, 'witness'),
    ...(INJECT === 'wrong-pinned-vkey' ? { guestVkey: `0x${'11'.repeat(32)}` as Hex } : {}) }
  const honestParams: PreflightParams = { from: client.address, token: ALPHA, receiver: PLAIN_RECEIVER, amount: '500000000', feeToken: PATH_USD, gasLimit: DEFAULT_GAS_LIMIT }
  let honestResp: PreflightResponse | undefined, honestWitness: string | undefined
  try {
    // ======================= S-1 =======================
    if (STAGES.includes('S-1') || STAGES.includes('S-3') || STAGES.includes('S-2')) {
      try {
        const t0 = Date.now()
        const r = await preflight(HONEST_URL, { ...honestParams, client: client.address }, ctx)
        honestResp = r.response
        if (r.witness.protection === 'protected') honestWitness = r.witness.path
        log(`honest response: ${JSON.stringify({ question: r.response.question, answer: r.response.answer, digest: r.response.digest, reserveTx: r.response.reserveTx, coverage: r.response.coverage, mode: r.response.mode })}`)
        log(`MPP payment: ${JSON.stringify(r.payment)}`)
        tx('S-1-mpp-charge', r.payment.txHash); tx('S-1-reserve', r.response.reserveTx)
        check('S-1.mpp', !!r.payment.txHash && /^0x[0-9a-f]{64}$/i.test(String(r.payment.txHash)), `MPP tempo charge paid, tx ${r.payment.txHash} (${r.payment.amount} of ${r.payment.currency})`)
        check('S-1.reserved', r.response.mode === 'honest' && r.verified.coverage === 500_000_000n, `reserveTx ${r.response.reserveTx} digest ${r.verified.digest} coverage ${r.verified.coverage}`)
        check('S-1.sdkVerify', true, `§3.1–3.4 passed: question=asked, R3.3, Reserved by ${r.response.server} for client=self, digest local==digestOf==event, GUEST_VKEY pinned, reservation Active`)
        check('S-1.witness', r.protected && r.witness.protection === 'protected' && r.witness.answerMatchesWitness,
          `witness ${r.witness.protection} in ${r.witness.elapsedMs} ms; answer matches own witness: ${(r.witness as any).answerMatchesWitness}; receiver +${BigInt(r.response.answer.receiverAfter) - BigInt(r.response.answer.receiverBefore)}`)
        const gu = BigInt(r.response.answer.gasUsed), gl = BigInt(r.response.question.gasLimit)
        check('S-1.honestNotOutOfGas', r.response.answer.success && 2n * gu <= gl && gl === BigInt(DEFAULT_GAS_LIMIT),
          `success ${r.response.answer.success}, gasUsed ${gu} < gasLimit ${gl} with ≥2× headroom (DEFAULT_GAS_LIMIT ${DEFAULT_GAS_LIMIT}, ${(Number(gu) / Number(gl) * 100).toFixed(1)}% used)`)
        log(`S-1 total ${Date.now() - t0} ms`)
      } catch (e) {
        check('S-1.sdkVerify', false, String(e))
      }
    }
    // ======================= S-3 =======================
    if (STAGES.includes('S-3') && honestResp) {
      const base = honestResp
      const expect = { params: honestParams, client: client.address, sworn: dep.sworn, swornCodehash: dep.swornCodehash }
      const cases: [string, string, () => Promise<unknown>][] = [
        ['S-3.wrongClient', 'WRONG_CLIENT', () => verifyResponse(base, { ...expect, client: challenger.address }, pc)],
        ['S-3.digestMismatch', 'DIGEST_MISMATCH', () => verifyResponse({ ...base, answer: { ...base.answer, gasUsed: String(BigInt(base.answer.gasUsed) + 1n) } }, expect, pc)],
        ['S-3.otherContract', 'WRONG_CONTRACT', () => verifyResponse({ ...base, sworn: dep.otherSworn }, expect, pc)],
        ['S-3.unknownVkey', 'VKEY', () => verifyResponse({ ...base, guestVkey: `0x${'22'.repeat(32)}` }, expect, pc)],
        ['S-3.unknownVkeyPinned', 'VKEY', () => verifyResponse(base, { ...expect, guestVkey: `0x${'33'.repeat(32)}` }, pc)],
        ['S-3.missingReservation', 'NO_RESERVATION', () => verifyResponse({ ...base, reserveTx: dep.nonReserveTx }, expect, pc)],
        ['S-3.r33ReceiverIsSender', 'RULE_R33', () => {
          const p = { ...honestParams, receiver: client.address }
          return verifyResponse({ ...base, question: { ...base.question, data: encodeTransfer(p) }, answer: { ...base.answer, receiver: client.address } }, { ...expect, params: p }, pc)
        }],
        ['S-3.r33RefusedBeforePaying', 'RULE_R33', () => preflight(HONEST_URL, { ...honestParams, receiver: client.address }, ctx)],
        ['S-3.r33NotTip20', 'RULE_R33', () => {
          const p = { ...honestParams, token: '0x1111111111111111111111111111111111111111' as Address }
          return verifyResponse({ ...base, question: { ...base.question, token: p.token } }, { ...expect, params: p }, pc)
        }],
      ]
      if (INJECT === 'sdk-accepts-wrong-client') cases[0] = ['S-3.wrongClient', 'WRONG_CLIENT', () => verifyResponse(base, expect, pc)]
      for (const [id, code, f] of cases) {
        try {
          await f()
          check(id, false, `accepted — expected ${code}`)
        } catch (e) {
          const got = e instanceof SwornCheckError ? e.code : `non-check error: ${e}`
          check(id, got === code, `rejected with ${e instanceof Error ? e.message.slice(0, 160) : e}`)
        }
      }
      // the original still verifies (the cases above fail for their reason, not a broken fixture)
      try { await verifyResponse(base, expect, pc); check('S-3.controlAccepts', true, 'unmodified response verifies') } catch (e) { check('S-3.controlAccepts', false, String(e)) }
    }
    // ======================= S-2 =======================
    if (STAGES.includes('S-2')) {
      // INJECT=break-diversion reproduces the old bug (300k limit: the blocked transfer runs out of gas).
      const p: PreflightParams = { from: client.address, token: ALPHA, receiver: blocking.address, amount: '500000000', feeToken: PATH_USD,
        gasLimit: INJECT === 'break-diversion' ? '300000' : DEFAULT_GAS_LIMIT }
      const r = await preflight(DISHONEST_URL, { ...p, client: client.address }, ctx)
      log(`dishonest response: ${JSON.stringify({ answer: r.response.answer, lie: r.response.lie, digest: r.response.digest, reserveTx: r.response.reserveTx })}`)
      tx('S-2-mpp-charge', r.payment.txHash); tx('S-2-reserve', r.response.reserveTx)
      check('S-2.dishonestReserved', r.response.mode === 'dishonest-demo' && r.verified.coverage === 500_000_000n, `dishonest-demo reserve ${r.response.reserveTx}, claims receiverAfter ${r.response.answer.receiverAfter}`)
      const wit = r.witness
      check('S-2.witness', wit.protection === 'protected' && !wit.answerMatchesWitness && wit.elapsedMs < 150_000,
        `witness ${wit.protection} in ${wit.elapsedMs} ms; true receiverAfter ${(wit as any).trueAnswer?.receiverAfter} vs claimed ${r.response.answer.receiverAfter}`)
      if (wit.protection !== 'protected') throw new Error('no witness')
      // The TRUE answer must be the diversion: the transfer succeeds, R' is credited nothing, and the
      // real payment (sent now, same calldata and gasLimit) lands in ReceivePolicyGuard — read from chain.
      {
        const t = wit.trueAnswer
        const pay = await wc(client).sendTransaction({ to: ALPHA, data: encodeTransfer(p), gas: BigInt(p.gasLimit!) })
        tx('S-2-real-payment', pay)
        const pr = await pc.waitForTransactionReceipt({ hash: pay, timeout: 90_000 })
        const at = (b: bigint, who: Address) => pc.readContract({ address: ALPHA, abi: tip20Abi, functionName: 'balanceOf', args: [who], blockNumber: b })
        const gPre = await at(pr.blockNumber - 1n, RECEIVE_POLICY_GUARD), gPost = await at(pr.blockNumber, RECEIVE_POLICY_GUARD)
        const rPre = await at(pr.blockNumber - 1n, blocking.address), rPost = await at(pr.blockNumber, blocking.address)
        log(`real payment ${pay} status ${pr.status} gasUsed ${pr.gasUsed} block ${pr.blockNumber}; guard ${gPre}->${gPost}; R' ${rPre}->${rPost}`)
        check('S-2.trueAnswerIsDiversion',
          t.success === true && t.receiverAfter === t.receiverBefore && 2n * BigInt(t.gasUsed) <= BigInt(p.gasLimit!) &&
          pr.status === 'success' && gPost - gPre === BigInt(p.amount) && rPost === rPre,
          `true answer success=${t.success} gasUsed ${t.gasUsed}/${p.gasLimit} (headroom ${(Number(p.gasLimit) / Number(t.gasUsed)).toFixed(2)}×, need ≥2×) receiverAfter==receiverBefore: ${t.receiverAfter === t.receiverBefore}; ` +
          `real payment ${pay} (${pr.status}, gasUsed ${pr.gasUsed}) at block ${pr.blockNumber}: ReceivePolicyGuard +${gPost - gPre}, R' +${rPost - rPre}`)
      }
      if (process.env.SWORN_E2E_SKIP_PROVE) throw new Error('SWORN_E2E_SKIP_PROVE set: challenge checks skipped (gate will report them missing)')
      const before = await pc.readContract({ address: PATH_USD, abi: tip20Abi, functionName: 'balanceOf', args: [client.address] })
      const t0 = Date.now()
      let phases: string[] = []
      const ch = await challenge(r.response, { rpcUrl: RPC, witnessPath: wit.path, proofOut: join(WORK, 'dishonest.proof.json'),
        onProgress: (e) => { if (e.phase !== 'log') { phases.push(e.phase); log(`phase ${e.phase}`) } else if (/PROVE|verify ok|pv match|fields that differ|submitting/.test(e.line)) log(e.line) } })
        .catch((e) => ({ ok: false, txHash: undefined, exitCode: -1, result: { error: String(e) } }))
      const after = await pc.readContract({ address: PATH_USD, abi: tip20Abi, functionName: 'balanceOf', args: [client.address] })
      log(`challenge result: ${JSON.stringify(ch.result)}`)
      tx('S-2-challenge', ch.txHash)
      check('S-2.challengePays', ch.ok && ch.result?.slashedEvent === true && after - before === 500_000_000n,
        `challenge tx ${ch.txHash} status ${ch.result?.status}, Slashed event ${ch.result?.slashedEvent}, client pathUSD +${after - before} (coverage 500000000), proving ${(ch.result?.proveWallSecs ?? 0).toFixed?.(0)} s, total ${((Date.now() - t0) / 1000).toFixed(0)} s, phases ${phases.join('>')}`)
      const key = await pc.readContract({ address: dep.sworn, abi: swornAbi, functionName: 'reservationKey', args: [r.response.server, r.response.digest] })
      const st = (await pc.readContract({ address: dep.sworn, abi: swornAbi, functionName: 'reservations', args: [key] }))[2]
      check('S-2.slashedState', st === 2, `reservation status ${st} (2 = Slashed)`)
      // honest answer: a real proof of the honest question; challenge simulation must revert AnswerCorrect
      if (!honestResp || !honestWitness) check('S-2.honestReverts', false, 'no honest response/witness from S-1')
      else {
        const hc = await challenge(honestResp, { rpcUrl: RPC, witnessPath: honestWitness, dryRun: true, proofOut: join(WORK, 'honest.proof.json'),
          onProgress: (e) => { if (e.phase === 'log' && /PROVE|dry-run|fields that differ/.test(e.line)) log(e.line) } })
        log(`honest challenge result: ${JSON.stringify(hc.result)}`)
        check('S-2.honestReverts', hc.result?.dryRun?.reverted === true && hc.result?.dryRun?.error === 'AnswerCorrect',
          `honest challenge with a real Groth16 proof (${(hc.result?.proveWallSecs ?? 0).toFixed?.(0)} s): simulation ${hc.result?.dryRun?.reverted ? 'reverted ' + hc.result?.dryRun?.error : 'did NOT revert'}; nothing sent`)
      }
    }
    // ======================= S-4 =======================
    if (STAGES.includes('S-4')) {
      const bin = join(REPO, 'target/release/sworn-answer')
      const req = JSON.stringify({ ...honestParams })
      const ok = await runJson(bin, [], { stdin: req, timeoutMs: 90_000, env: { ...process.env, SWORN_RPC_URL: RPC } })
      check('S-4.matchingScheduleAnswers', ok.code === 0 && ok.json?.ok === true, `same schedule as the guest → answers (checked ${ok.json?.forkSchedule?.checked} forks)`)
      const drift = process.env.SWORN_DRIFT_RPC_URL
      if (MOD) log('S-4 live drift is a local-only check (a drifted chain cannot be made on Moderato); its unit tests run in the gate')
      else if (!drift) check('S-4.liveDriftRefused', false, 'SWORN_DRIFT_RPC_URL not set (scripts/e2e.sh starts the drifted chain)')
      else {
        const r = await runJson(bin, [], { stdin: req, timeoutMs: 90_000, env: { ...process.env, SWORN_RPC_URL: drift } })
        check('S-4.liveDriftRefused', r.code === 3 && /fork schedule mismatch/.test(r.json?.reason ?? ''), `exit ${r.code}: ${r.json?.reason}`)
      }
    }
  } finally {
    for (const s of servers) s.kill()
  }
  console.log(`E2E DONE failures=${failures} work=${WORK}`)
  process.exit(failures ? 1 : 0)
}
main().catch((e) => { console.log(`CHECK E2E.crash FAIL ${e?.stack ?? e}`); process.exit(1) })
