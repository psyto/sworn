// release / beginUnbond / withdraw on the DEPLOYED Sworn (deployments/moderato.json). Driven by
// scripts/moderato-release-withdraw.sh — see its header for usage. Without SWORN_RW_SEND=1 this only
// reads: chain state, the exact calls, and an eth_call simulation of each. With it, it sends and then
// verifies each step read-only: receipt, the Sworn event, servers() accounting, token balances.
//
// Contract rules (contracts/src/Sworn.sol):
//   release(server, digest)  permissionless; status Active and block.timestamp > expiry (=reserve
//                            time + CHALLENGE_PERIOD 24 h). Moves locked → free; moves NO tokens.
//   beginUnbond()            msg.sender's whole bond, no amount; PERMANENT: that server can never
//                            reserve again (unbondStart is never cleared). withdrawableAt = now + 25 h.
//   withdraw()               after unbondStart + UNBOND_DELAY (25 h); sends ALL free bond to msg.sender.
// Because beginUnbond retires a server for good, the unbond exercise defaults to a throwaway server
// entry for the CLIENT key (bond a small amount to itself first), not the honest demo server.
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWalletClient, decodeEventLog, encodeFunctionData, getAddress, http, keccak256, parseAbi, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { PATH_USD, publicClientFor, swornAbi, swornChain, tip20Abi, tip403Abi } from '../src/index.ts'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const D = JSON.parse(readFileSync(join(REPO, 'deployments/moderato.json'), 'utf8'))
const RPC = process.env.SWORN_RPC_URL ?? 'https://rpc.moderato.tempo.xyz'
const SWORN = getAddress(D.Sworn.address) as Address
const BOND_TOKEN = getAddress(D.Sworn.BOND_TOKEN) as Address
const EXPLORER = 'https://explore.testnet.tempo.xyz/tx/'
const FEE_MANAGER = '0xfeec000000000000000000000000000000000000'
const STEP = process.env.SWORN_RW_STEP ?? 'status'
const SEND = process.env.SWORN_RW_SEND === '1'
const ACTOR_ROLE = (process.env.SWORN_RW_ACTOR ?? 'client') as 'client' | 'honest'
const RETIRE_HONEST = process.env.SWORN_RW_RETIRE_HONEST === '1'
const UNBOND_AMOUNT = BigInt(process.env.SWORN_RW_AMOUNT ?? '1000000') // 1 pathUSD (6 decimals)
const ONLY_SERVER = process.env.SWORN_RW_SERVER // optional: release only this server's reservations
const MAX_RELEASES = Number(process.env.SWORN_RW_MAX ?? '2')

const ROLES = {
  honest: getAddress(D.roles.honest_server) as Address,
  dishonest: getAddress(D.roles.dishonest_demo_server) as Address,
  deployer: getAddress(D.roles.deployer_and_challenger) as Address,
  client: getAddress(D.roles.client) as Address,
}
const KEYVAR = { deployer: 'SWORN_DEPLOYER_KEY', honest: 'SWORN_HONEST_KEY', client: 'DEMO_CLIENT_KEY' } as const
const eventsAbi = parseAbi([
  'event Reserved(address indexed server, bytes32 indexed digest, address indexed client, uint256 coverage, uint64 blockNumber, bytes32 blockHash, uint64 expiry)',
  'event Released(address indexed server, bytes32 indexed digest, uint256 coverage)',
  'event Bonded(address indexed server, address indexed funder, uint256 amount)',
  'event UnbondBegun(address indexed server, uint64 withdrawableAt)',
  'event Withdrawn(address indexed server, uint256 amount)',
  'event Transfer(address indexed from, address indexed to, uint256 amount)',
  'function release(address server, bytes32 digest)',
  'function beginUnbond()',
  'function withdraw()',
  'function CHALLENGE_PERIOD() view returns (uint256)',
  'function UNBOND_DELAY() view returns (uint256)',
])
const pc = publicClientFor(RPC)
const STATUS = ['None', 'Active', 'Slashed', 'Released']
const iso = (t: bigint | number) => new Date(Number(t) * 1000).toISOString().replace('.000Z', 'Z')
const jst = (t: bigint | number) => new Date(Number(t) * 1000 + 9 * 3600_000).toISOString().replace('T', ' ').replace('.000Z', ' JST')
let bad = 0
const verify = (id: string, ok: boolean, detail: string) => { console.log(`VERIFY ${id} ${ok ? 'OK' : 'FAIL'} ${detail}`); if (!ok) bad++ }

async function servers(a: Address) {
  const [free, locked, unbondStart] = await pc.readContract({ address: SWORN, abi: swornAbi, functionName: 'servers', args: [a] })
  return { free, locked, unbondStart }
}
const bal = (who: Address, blockNumber?: bigint) => pc.readContract({ address: BOND_TOKEN, abi: tip20Abi, functionName: 'balanceOf', args: [who], ...(blockNumber !== undefined ? { blockNumber } : {}) })

async function reservationsOnChain() {
  const head = await pc.getBlockNumber()
  const evt = eventsAbi[0]
  const out: { server: Address; digest: Hex; client: Address; coverage: bigint; expiry: bigint; status: number; tx: Hex; block: bigint }[] = []
  for (let f = BigInt(D.Sworn.block); f <= head; f += 90_000n) {
    const t = f + 89_999n > head ? head : f + 89_999n
    for (const l of await pc.getLogs({ address: SWORN, event: evt, fromBlock: f, toBlock: t })) {
      const a = l.args as any
      const key = await pc.readContract({ address: SWORN, abi: swornAbi, functionName: 'reservationKey', args: [a.server, a.digest] })
      const r = await pc.readContract({ address: SWORN, abi: swornAbi, functionName: 'reservations', args: [key] })
      out.push({ server: getAddress(a.server), digest: a.digest, client: a.client, coverage: a.coverage, expiry: r[1], status: r[2], tx: l.transactionHash!, block: l.blockNumber! })
    }
  }
  return out
}

/** eth_call from `from`; returns 'ok' or the revert reason. */
async function simulate(from: Address, data: Hex, to: Address = SWORN): Promise<string> {
  try { await pc.request({ method: 'eth_call', params: [{ from, to, data }, 'latest'] } as any); return 'ok' } catch (e: any) {
    const m = String(e?.shortMessage ?? e?.message ?? e)
    let d: any = e
    while (d && typeof d.data !== 'string' && d.cause) d = d.cause
    const sel = (typeof d?.data === 'string' ? d.data : (m.match(/0x[0-9a-f]{8}/i) ?? [''])[0]).slice(0, 10)
    const names: Record<string, string> = {}
    for (const n of ['NoReservation', 'NotExpired', 'NoBond', 'AlreadyUnbonding', 'NotUnbonding', 'UnbondDelayNotOver', 'NothingToWithdraw', 'Unbonding', 'ZeroAmount', 'TokenTransferFailed'])
      names[keccak256(new TextEncoder().encode(`${n}()`)).slice(0, 10)] = n
    return `reverts ${names[sel.toLowerCase()] ?? m.slice(0, 160)}`
  }
}

function account(role: keyof typeof KEYVAR) {
  const v = process.env[KEYVAR[role]]
  if (!v) { console.error(`missing env ${KEYVAR[role]} — --send must run under scripts/with-keys.sh`); process.exit(2) }
  const a = privateKeyToAccount(v as Hex)
  if (getAddress(a.address) !== (ROLES as any)[role]) { console.error(`${KEYVAR[role]} is not roles.${role} in deployments/moderato.json`); process.exit(2) }
  return a
}
async function send(role: keyof typeof KEYVAR, to: Address, data: Hex, label: string) {
  const a = account(role)
  const wc = createWalletClient({ account: a, chain: swornChain(RPC), transport: http(RPC, { timeout: 20_000, retryCount: 3 }) })
  const h = await wc.sendTransaction({ to, data } as any)
  console.log(`TX ${label} ${h} ${EXPLORER}${h}`)
  const r = await pc.waitForTransactionReceipt({ hash: h, timeout: 90_000 })
  verify(`${label}.receipt`, r.status === 'success', `status ${r.status} block ${r.blockNumber} gasUsed ${r.gasUsed}`)
  return r
}
function events(r: { logs: { address: string; topics: Hex[]; data: Hex }[] }, from: Address) {
  return r.logs.filter((l) => getAddress(l.address) === getAddress(from)).flatMap((l) => {
    try { return [decodeEventLog({ abi: eventsAbi, data: l.data, topics: l.topics as any }) as any] } catch { return [] }
  })
}
/** Net fee paid by `who` in BOND_TOKEN in this receipt (TIP-20 Transfers who → FeeManager minus refunds). */
function feeIn(r: { logs: { address: string; topics: Hex[]; data: Hex }[] }, who: Address): bigint {
  const t = events(r, BOND_TOKEN).filter((e) => e.eventName === 'Transfer')
  const sum = (f: (e: any) => boolean): bigint => t.filter(f).reduce((s: bigint, e: any) => s + (e.args.amount as bigint), 0n)
  return sum((e) => getAddress(e.args.from) === who && getAddress(e.args.to) === getAddress(FEE_MANAGER)) -
    sum((e) => getAddress(e.args.from) === getAddress(FEE_MANAGER) && getAddress(e.args.to) === who)
}

async function main() {
  const cid = await pc.getChainId()
  const code = await pc.getCode({ address: SWORN })
  const codehash = code ? keccak256(code) : '0x'
  if (cid !== 42431 || codehash !== D.Sworn.codehash) { console.error(`wrong chain ${cid} or Sworn codehash ${codehash}`); process.exit(2) }
  const blk = await pc.getBlock()
  const now = blk.timestamp
  const cp = await pc.readContract({ address: SWORN, abi: eventsAbi, functionName: 'CHALLENGE_PERIOD' })
  const ud = await pc.readContract({ address: SWORN, abi: eventsAbi, functionName: 'UNBOND_DELAY' })
  console.log(`Sworn ${SWORN} (codehash ok) chain ${cid} head ${blk.number} time ${iso(now)} / ${jst(now)}; CHALLENGE_PERIOD ${cp} s, UNBOND_DELAY ${ud} s; mode ${STEP}${SEND ? ' SEND' : ' (read-only: nothing is sent)'}`)

  const actorRole = ACTOR_ROLE
  const actor = ROLES[actorRole]

  if (STEP === 'status' || STEP === 'release') {
    const rs = await reservationsOnChain()
    console.log(`Reserved events on Sworn since block ${D.Sworn.block}: ${rs.length}`)
    for (const r of rs) {
      const who = Object.entries(ROLES).find(([, a]) => a === r.server)?.[0] ?? r.server
      const releasable = r.status === 1 && now > r.expiry
      console.log(`  ${STATUS[r.status].padEnd(8)} server ${who} digest ${r.digest} coverage ${r.coverage} expiry ${iso(r.expiry)} ${releasable ? 'RELEASABLE NOW' : r.status === 1 ? `releasable after ${iso(r.expiry)} / ${jst(r.expiry)}` : ''} (reserve tx ${r.tx})`)
    }
    for (const n of ['honest', 'dishonest', 'client'] as const) {
      const s = await servers(ROLES[n])
      console.log(`  servers(${n} ${ROLES[n]}) free ${s.free} locked ${s.locked} unbondStart ${s.unbondStart}${s.unbondStart ? ` → withdraw from ${iso(s.unbondStart + ud)} / ${jst(s.unbondStart + ud)}` : ''}; balance ${await bal(ROLES[n])}`)
    }
    console.log(`  Sworn ${BOND_TOKEN} balance ${await bal(SWORN)}`)
    let todo = rs.filter((r) => r.status === 1 && now > r.expiry && (!ONLY_SERVER || r.server === getAddress(ONLY_SERVER as Address)))
    todo = todo.filter((r) => r.server === ROLES.honest).concat(todo.filter((r) => r.server !== ROLES.honest)).slice(0, MAX_RELEASES)
    console.log(`PLAN release: ${todo.length} reservation(s), sent from roles.deployer ${ROLES.deployer} (release is permissionless)`)
    for (const r of todo) {
      const data = encodeFunctionData({ abi: eventsAbi, functionName: 'release', args: [r.server, r.digest] })
      console.log(`  cast send ${SWORN} "release(address,bytes32)" ${r.server} ${r.digest}   # calldata ${data}; simulate from deployer: ${await simulate(ROLES.deployer, data)}`)
    }
    for (const r of rs.filter((r) => r.status === 1 && now <= r.expiry)) {
      const data = encodeFunctionData({ abi: eventsAbi, functionName: 'release', args: [r.server, r.digest] })
      console.log(`  later: release(${r.server}, ${r.digest}) after ${iso(r.expiry)} / ${jst(r.expiry)}; simulate now: ${await simulate(ROLES.deployer, data)} (expected until then)`)
    }
    if (STEP === 'release' && SEND) {
      for (const r of todo) {
        const s0 = await servers(r.server), sw0 = await bal(SWORN)
        const data = encodeFunctionData({ abi: eventsAbi, functionName: 'release', args: [r.server, r.digest] })
        const rc = await send('deployer', SWORN, data, `release-${r.digest.slice(0, 10)}`)
        const ev = events(rc, SWORN).filter((e) => e.eventName === 'Released')
        verify('release.event', ev.length === 1 && getAddress(ev[0].args.server) === r.server && ev[0].args.digest === r.digest && ev[0].args.coverage === r.coverage,
          `Released(${ev[0]?.args.server}, ${ev[0]?.args.digest}, ${ev[0]?.args.coverage}) from Sworn`)
        const key = await pc.readContract({ address: SWORN, abi: swornAbi, functionName: 'reservationKey', args: [r.server, r.digest] })
        const st = (await pc.readContract({ address: SWORN, abi: swornAbi, functionName: 'reservations', args: [key], blockNumber: rc.blockNumber }))[2]
        verify('release.status', st === 3, `reservation status ${st} (3 = Released)`)
        const s1 = await pc.readContract({ address: SWORN, abi: swornAbi, functionName: 'servers', args: [r.server], blockNumber: rc.blockNumber })
        verify('release.accounting', s1[0] - s0.free === r.coverage && s0.locked - s1[1] === r.coverage,
          `free ${s0.free}→${s1[0]} (+${s1[0] - s0.free}), locked ${s0.locked}→${s1[1]} (−${s0.locked - s1[1]}), coverage ${r.coverage}`)
        const sw1 = await bal(SWORN, rc.blockNumber), swPrev = await bal(SWORN, rc.blockNumber - 1n)
        verify('release.noTokensMove', sw1 === swPrev, `Sworn balance ${swPrev}→${sw1} across the release block (release moves no tokens); before send ${sw0}`)
      }
    }
  }

  if (STEP === 'status' || STEP === 'unbond') {
    const s = await servers(actor)
    const policy = await pc.readContract({ address: '0x403c000000000000000000000000000000000000', abi: tip403Abi, functionName: 'validateReceivePolicy', args: [BOND_TOKEN, SWORN, actor] }).catch((e) => `unreadable: ${String(e).slice(0, 80)}`)
    console.log(`PLAN unbond: actor roles.${actorRole} ${actor}; servers() free ${s.free} locked ${s.locked} unbondStart ${s.unbondStart}; receive policy for Sworn→actor in ${BOND_TOKEN}: ${JSON.stringify(policy, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`)
    if (actorRole === 'honest') console.log(`  WARNING beginUnbond takes no amount and PERMANENTLY stops ${actor} from reserving (Sworn.sol beginUnbond/reserve: unbondStart != 0 → Unbonding); the honest demo server would be retired.`)
    const needBond = s.free === 0n && s.locked === 0n
    if (needBond) {
      console.log(`  cast send ${BOND_TOKEN} "approve(address,uint256)" ${SWORN} ${UNBOND_AMOUNT}   # from ${actor}`)
      console.log(`  cast send ${SWORN} "bond(address,uint256)" ${actor} ${UNBOND_AMOUNT}   # from ${actor}; bonds ${UNBOND_AMOUNT} (= ${Number(UNBOND_AMOUNT) / 1e6} pathUSD)`)
    }
    const bu = encodeFunctionData({ abi: eventsAbi, functionName: 'beginUnbond' })
    console.log(`  cast send ${SWORN} "beginUnbond()"   # from ${actor}; simulate now: ${needBond ? 'reverts NoBond until bonded (expected)' : await simulate(actor, bu)}`)
    console.log(`  withdraw becomes possible at (beginUnbond block time) + ${ud} s; if sent now: ${iso(now + ud)} / ${jst(now + ud)}`)
    if (STEP === 'unbond' && SEND) {
      if (actorRole === 'honest' && !RETIRE_HONEST) { console.error('refusing: --actor honest needs --retire-honest-server (beginUnbond is permanent)'); process.exit(2) }
      if (s.unbondStart !== 0n) { console.error(`actor already unbonding since ${iso(s.unbondStart)}; run the withdraw step`); process.exit(2) }
      const role = actorRole as keyof typeof KEYVAR
      if (needBond) {
        const r1 = await send(role, BOND_TOKEN, encodeFunctionData({ abi: tip20Abi, functionName: 'approve', args: [SWORN, UNBOND_AMOUNT] }), 'approve')
        const b0 = await bal(actor, r1.blockNumber - 1n), sw0 = await bal(SWORN, r1.blockNumber - 1n)
        const r2 = await send(role, SWORN, encodeFunctionData({ abi: swornAbi, functionName: 'bond', args: [actor, UNBOND_AMOUNT] }), 'bond')
        const ev = events(r2, SWORN).filter((e) => e.eventName === 'Bonded')
        verify('bond.event', ev.length === 1 && getAddress(ev[0].args.server) === actor && getAddress(ev[0].args.funder) === actor && ev[0].args.amount === UNBOND_AMOUNT, `Bonded(${ev[0]?.args.server}, ${ev[0]?.args.funder}, ${ev[0]?.args.amount})`)
        const s1 = await servers(actor)
        verify('bond.accounting', s1.free === UNBOND_AMOUNT && s1.locked === 0n, `servers(actor) free ${s1.free} locked ${s1.locked}`)
        const b1 = await bal(actor, r2.blockNumber), sw1 = await bal(SWORN, r2.blockNumber)
        const fees = feeIn(r1, actor) + feeIn(r2, actor)
        verify('bond.balances', sw1 - sw0 === UNBOND_AMOUNT && b0 - b1 === UNBOND_AMOUNT + fees, `Sworn +${sw1 - sw0}; actor −${b0 - b1} (= ${UNBOND_AMOUNT} bond + ${fees} fees in ${BOND_TOKEN})`)
      }
      const r3 = await send(role, SWORN, bu, 'beginUnbond')
      const t3 = (await pc.getBlock({ blockNumber: r3.blockNumber })).timestamp
      const ev = events(r3, SWORN).filter((e) => e.eventName === 'UnbondBegun')
      verify('unbond.event', ev.length === 1 && getAddress(ev[0].args.server) === actor && ev[0].args.withdrawableAt === t3 + ud, `UnbondBegun(${ev[0]?.args.server}, withdrawableAt ${ev[0]?.args.withdrawableAt} = block time ${t3} + ${ud})`)
      const s2 = await servers(actor)
      verify('unbond.accounting', s2.unbondStart === t3 && s2.free + s2.locked > 0n, `unbondStart ${s2.unbondStart}, free ${s2.free}, locked ${s2.locked}`)
      verify('unbond.withdrawNotYet', (await simulate(actor, encodeFunctionData({ abi: eventsAbi, functionName: 'withdraw' }))).includes('UnbondDelayNotOver'), 'withdraw() simulated now reverts UnbondDelayNotOver')
      console.log(`EARLIEST WITHDRAW ${iso(t3 + ud)} / ${jst(t3 + ud)} (block time ${t3} + ${ud} s). Then: scripts/with-keys.sh scripts/moderato-release-withdraw.sh withdraw --send${actorRole === 'honest' ? ' --actor honest' : ''}`)
    }
  }

  if (STEP === 'withdraw') {
    const s = await servers(actor)
    const wd = encodeFunctionData({ abi: eventsAbi, functionName: 'withdraw' })
    const at = s.unbondStart + ud
    console.log(`PLAN withdraw: actor roles.${actorRole} ${actor}; free ${s.free} locked ${s.locked} unbondStart ${s.unbondStart}${s.unbondStart ? ` → withdrawable from ${iso(at)} / ${jst(at)}` : ' (not unbonding: run the unbond step first)'}`)
    console.log(`  cast send ${SWORN} "withdraw()"   # from ${actor}; simulate now: ${await simulate(actor, wd)}`)
    if (SEND) {
      if (s.unbondStart === 0n || now < at) { console.error(`not yet: chain time ${iso(now)} < ${iso(at)}`); process.exit(2) }
      const r = await send(actorRole as keyof typeof KEYVAR, SWORN, wd, 'withdraw')
      const b0 = await bal(actor, r.blockNumber - 1n), sw0 = await bal(SWORN, r.blockNumber - 1n)
      const ev = events(r, SWORN).filter((e) => e.eventName === 'Withdrawn')
      verify('withdraw.event', ev.length === 1 && getAddress(ev[0].args.server) === actor && ev[0].args.amount === s.free, `Withdrawn(${ev[0]?.args.server}, ${ev[0]?.args.amount}) (free was ${s.free})`)
      const tr = events(r, BOND_TOKEN).filter((e) => e.eventName === 'Transfer' && getAddress(e.args.from) === SWORN)
      verify('withdraw.transfer', tr.length === 1 && getAddress(tr[0].args.to) === actor && tr[0].args.amount === s.free, `Transfer(Sworn → ${tr[0]?.args.to}, ${tr[0]?.args.amount}) (not diverted to ReceivePolicyGuard)`)
      const s1 = await servers(actor)
      verify('withdraw.accounting', s1.free === 0n && s1.locked === s.locked, `free ${s.free}→${s1.free}, locked ${s1.locked}`)
      const b1 = await bal(actor, r.blockNumber), sw1 = await bal(SWORN, r.blockNumber)
      const fee = feeIn(r, actor)
      verify('withdraw.balances', sw0 - sw1 === s.free && b1 - b0 === s.free - fee, `Sworn −${sw0 - sw1}; actor +${b1 - b0} (= ${s.free} − ${fee} fee)`)
    }
  }
  console.log(`DONE ${STEP}${SEND ? ' (sent)' : ' (read-only)'} verify-failures=${bad}`)
  process.exit(bad ? 1 : 0)
}
main().catch((e) => { console.log(`ERROR ${e?.stack ?? e}`); process.exit(1) })
