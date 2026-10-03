// Sworn ABI subset and the R3.1/R3.7 types, shared by the SDK, the server and the e2e test.
// Source of truth: contracts/src/Sworn.sol (struct field order is ABI and EIP-712 order).
import { parseAbi, type Address, type Hex } from 'viem'

export const QUESTION_T = '(uint64 chainId, uint64 blockNumber, bytes32 blockHash, address from, address token, bytes data, address feeToken, uint64 gasLimit)'
export const ANSWER_T = '(bool success, bytes32 returnDataHash, uint64 gasUsed, uint256 feeCharged, address receiver, uint256 receiverBefore, uint256 receiverAfter)'

export const swornAbi = parseAbi([
  `function reserve(${QUESTION_T} q, ${ANSWER_T} a, address client, uint256 coverage) returns (bytes32 digest)`,
  `function challenge(address server, ${QUESTION_T} q, ${ANSWER_T} a, bytes publicValues, bytes proof)`,
  `function digestOf(${QUESTION_T} q, ${ANSWER_T} a) view returns (bytes32)`,
  'function reservationKey(address server, bytes32 digest) pure returns (bytes32)',
  'function reservations(bytes32 key) view returns (address client, uint64 expiry, uint8 status, uint256 coverage)',
  'function servers(address server) view returns (uint128 free, uint128 locked, uint64 unbondStart)',
  'function bond(address server, uint256 amount)',
  'function GUEST_VKEY() view returns (bytes32)',
  'function GUEST_VERSION() view returns (bytes32)',
  'function SP1_VERIFIER() view returns (address)',
  'function BOND_TOKEN() view returns (address)',
  'function CHAIN_ID() view returns (uint64)',
  'event Reserved(address indexed server, bytes32 indexed digest, address indexed client, uint256 coverage, uint64 blockNumber, bytes32 blockHash, uint64 expiry)',
  'event Slashed(address indexed server, bytes32 indexed digest, address indexed client, uint256 coverage)',
  'error AnswerCorrect()',
  'error NoReservation()',
  'error DigestUsed()',
  'error BlockOutOfWindow()',
  'error BlockHashMismatch()',
])

export const tip20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferWithMemo(address to, uint256 amount, bytes32 memo)',
])

export const tip403Abi = parseAbi([
  'function setReceivePolicy(uint64 senderPolicyId, uint64 tokenFilterId, address recoveryAuthority)',
  'function validateReceivePolicy(address token, address sender, address receiver) view returns (bool authorized, uint8 blockedReason)',
])
export const TIP403_REGISTRY: Address = '0x403c000000000000000000000000000000000000'
export const PATH_USD: Address = '0x20c0000000000000000000000000000000000000'
export const CHAIN_ID = 42431

/** §2 wire format: integers as decimal strings. */
export type QuestionJson = {
  chainId: string; blockNumber: string; blockHash: Hex; from: Address; token: Address; data: Hex; feeToken: Address; gasLimit: string
}
export type AnswerJson = {
  success: boolean; returnDataHash: Hex; gasUsed: string; feeCharged: string; receiver: Address; receiverBefore: string; receiverAfter: string
}
/** `POST /preflight` 200 body (spec 002 §2). */
export type PreflightResponse = {
  question: QuestionJson
  answer: AnswerJson
  server: Address
  sworn: Address
  digest: Hex
  reserveTx: Hex
  coverage: string
  mode: 'honest' | 'dishonest-demo'
  guestVersion: Hex
  guestVkey: Hex
  [k: string]: unknown
}
export type PreflightParams = {
  from: Address; token: Address; receiver: Address; amount: string; memo?: Hex | null; feeToken: Address; gasLimit?: string
}

export function toQuestion(q: QuestionJson) {
  return {
    chainId: BigInt(q.chainId), blockNumber: BigInt(q.blockNumber), blockHash: q.blockHash, from: q.from, token: q.token,
    data: q.data, feeToken: q.feeToken, gasLimit: BigInt(q.gasLimit),
  }
}
export function toAnswer(a: AnswerJson) {
  return {
    success: a.success, returnDataHash: a.returnDataHash, gasUsed: BigInt(a.gasUsed), feeCharged: BigInt(a.feeCharged),
    receiver: a.receiver, receiverBefore: BigInt(a.receiverBefore), receiverAfter: BigInt(a.receiverAfter),
  }
}

export const eip712Types = {
  SwornAnswer: [{ name: 'question', type: 'Question' }, { name: 'answer', type: 'Answer' }],
  Question: [
    { name: 'chainId', type: 'uint64' }, { name: 'blockNumber', type: 'uint64' }, { name: 'blockHash', type: 'bytes32' },
    { name: 'from', type: 'address' }, { name: 'token', type: 'address' }, { name: 'data', type: 'bytes' },
    { name: 'feeToken', type: 'address' }, { name: 'gasLimit', type: 'uint64' },
  ],
  Answer: [
    { name: 'success', type: 'bool' }, { name: 'returnDataHash', type: 'bytes32' }, { name: 'gasUsed', type: 'uint64' },
    { name: 'feeCharged', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'receiverBefore', type: 'uint256' },
    { name: 'receiverAfter', type: 'uint256' },
  ],
} as const

/** ReceivePolicyGuard precompile (tempo/crates/contracts/src/precompiles/mod.rs): blocked inbound
 *  transfers land here (spec 001 §2.2). */
export const RECEIVE_POLICY_GUARD: Address = '0xb10c000000000000000000000000000000000000'

/** gasLimit of every preflight Question unless the caller sets one. Measured on the Sworn local
 *  chain (2026-10-03, fees on; sdk/test/measure-gas.ts and the e2e log):
 *    ordinary AlphaUSD transfer                         292,042  (eth_estimateGas 293,511)
 *    receive-policy-blocked, DIVERTED to ReceivePolicyGuard
 *      guard already holds the token                    803,491  (eth_estimateGas 809,019)
 *      FIRST diversion (guard balance slot is new)    1,053,491  (real receipt 1,042,691)
 *  The guard writes a receipt and Tempo prices a cold SSTORE at ~254k. 3,000,000 = 2.85× the worst
 *  measured case, 10× under Tempo's 30,000,000 per-tx cap (TEMPO_T1_TX_GAS_LIMIT_CAP).
 *  The old 300,000 made the diverted case run OUT OF GAS (success=false, gasUsed=300,000). */
export const DEFAULT_GAS_LIMIT = '3000000'
