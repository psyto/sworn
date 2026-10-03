// Measures the gas of an ordinary and a receive-policy-blocked (diverted) TIP-20 transfer on the
// Sworn local chain: eth_estimateGas, a real receipt, and the guest's fees-on gasUsed (sworn-answer
// at a generous limit). Used to choose DEFAULT_GAS_LIMIT (sdk/src/abi.ts).
// Keys from env only: SWORN_CLIENT_KEY (sender), SWORN_BLOCKING_RECEIVER_KEY (gets REJECT_ALL policy).
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWalletClient, http, encodeFunctionData, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { PATH_USD, TIP403_REGISTRY, publicClientFor, runJson, swornChain, tip20Abi, tip403Abi, RECEIVE_POLICY_GUARD } from '../src/index.ts'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const RPC = process.env.SWORN_RPC_URL ?? 'http://127.0.0.1:8546'
const ALPHA: Address = '0x20c0000000000000000000000000000000000001'
const client = privateKeyToAccount(process.env.SWORN_CLIENT_KEY as Hex)
const blocking = privateKeyToAccount(process.env.SWORN_BLOCKING_RECEIVER_KEY as Hex)
const plain: Address = '0x976EA74026E726554dB657fA54763abd0C3a0aa9'
const pc = publicClientFor(RPC)
const wc = (a: typeof client) => createWalletClient({ account: a, chain: swornChain(RPC), transport: http(RPC) })
const AMOUNT = 500_000_000n

const pol = await pc.readContract({ address: TIP403_REGISTRY, abi: tip403Abi, functionName: 'validateReceivePolicy', args: [ALPHA, client.address, blocking.address] })
if (pol[0]) {
  const h = await wc(blocking).writeContract({ address: TIP403_REGISTRY, abi: tip403Abi, functionName: 'setReceivePolicy', args: [0n, 1n, '0x0000000000000000000000000000000000000000'] })
  await pc.waitForTransactionReceipt({ hash: h })
}
for (const [name, to] of [['ordinary', plain], ['diverted', blocking.address]] as const) {
  // guest/answerer view (fees on, generous limit) BEFORE the real tx
  const ans = await runJson(join(REPO, 'target/release/sworn-answer'), [], {
    stdin: JSON.stringify({ from: client.address, token: ALPHA, receiver: to, amount: AMOUNT.toString(), feeToken: PATH_USD, gasLimit: '5000000' }),
    timeoutMs: 60_000, env: { ...process.env, SWORN_RPC_URL: RPC },
  })
  const data = encodeFunctionData({ abi: tip20Abi, functionName: 'transfer', args: [to, AMOUNT] })
  const est = await pc.estimateGas({ account: client.address, to: ALPHA, data })
  const gBefore = await pc.readContract({ address: ALPHA, abi: tip20Abi, functionName: 'balanceOf', args: [RECEIVE_POLICY_GUARD] })
  const h = await wc(client).sendTransaction({ to: ALPHA, data, gas: 5_000_000n })
  const r = await pc.waitForTransactionReceipt({ hash: h })
  const gAfter = await pc.readContract({ address: ALPHA, abi: tip20Abi, functionName: 'balanceOf', args: [RECEIVE_POLICY_GUARD], blockNumber: r.blockNumber })
  console.log(JSON.stringify({ case: name, answererGasUsed: ans.json?.answer?.gasUsed, answererSuccess: ans.json?.answer?.success,
    answererReceiverDelta: ans.json?.answer ? (BigInt(ans.json.answer.receiverAfter) - BigInt(ans.json.answer.receiverBefore)).toString() : null,
    estimateGas: est.toString(), receiptGasUsed: r.gasUsed.toString(), receiptStatus: r.status, tx: h, guardDelta: (gAfter - gBefore).toString() }))
}
