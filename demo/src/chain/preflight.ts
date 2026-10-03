import {
  decodeEventLog,
  encodeAbiParameters,
  getAddress,
  hashTypedData,
  isAddress,
  isHex,
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { swornAbi, tip20Abi } from "./abis.ts";
import type { ChainConfig } from "./config.ts";
import { DataError, asDataError } from "./errors.ts";

// ---------------------------------------------------------------------------------------------
// 002 §2 — the server's JSON. Integers may arrive as decimal or 0x strings (or JSON numbers).
// ---------------------------------------------------------------------------------------------

export interface Question {
  chainId: bigint;
  blockNumber: bigint;
  blockHash: Hex;
  from: Address;
  token: Address;
  data: Hex;
  feeToken: Address;
  gasLimit: bigint;
}

export interface Answer {
  success: boolean;
  returnDataHash: Hex;
  gasUsed: bigint;
  feeCharged: bigint;
  receiver: Address;
  receiverBefore: bigint;
  receiverAfter: bigint;
}

export interface PreflightResponse {
  question: Question;
  answer: Answer;
  server: Address;
  sworn: Address;
  digest: Hex;
  reserveTx: Hex;
  coverage: bigint;
  mode: "honest" | "dishonest-demo";
  guestVersion: Hex;
  guestVkey: Hex;
}

type Json = Record<string, unknown>;

function bad(field: string, v: unknown): never {
  throw new DataError("bad-response", `server response: ${field} is invalid (${JSON.stringify(v)})`);
}
function int(o: Json, k: string, path: string): bigint {
  const v = o[k];
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return BigInt(v);
  if (typeof v === "string" && /^(0x[0-9a-fA-F]+|[0-9]+)$/.test(v)) return BigInt(v);
  return bad(path + k, v);
}
function address(o: Json, k: string, path: string): Address {
  const v = o[k];
  return typeof v === "string" && isAddress(v) ? getAddress(v) : bad(path + k, v);
}
function hex(o: Json, k: string, path: string, bytes?: number): Hex {
  const v = o[k];
  if (typeof v !== "string" || !isHex(v)) return bad(path + k, v);
  if (bytes !== undefined && v.length !== 2 + bytes * 2) return bad(path + k, v);
  return v.toLowerCase() as Hex;
}
function obj(o: Json, k: string): Json {
  const v = o[k];
  return v && typeof v === "object" ? (v as Json) : bad(k, v);
}

export function parsePreflightResponse(raw: unknown): PreflightResponse {
  if (!raw || typeof raw !== "object") return bad("body", raw);
  const r = raw as Json;
  const q = obj(r, "question");
  const a = obj(r, "answer");
  const mode = r.mode;
  if (mode !== "honest" && mode !== "dishonest-demo") bad("mode", mode);
  if (typeof a.success !== "boolean") bad("answer.success", a.success);
  return {
    question: {
      chainId: int(q, "chainId", "question."),
      blockNumber: int(q, "blockNumber", "question."),
      blockHash: hex(q, "blockHash", "question.", 32),
      from: address(q, "from", "question."),
      token: address(q, "token", "question."),
      data: hex(q, "data", "question."),
      feeToken: address(q, "feeToken", "question."),
      gasLimit: int(q, "gasLimit", "question."),
    },
    answer: {
      success: a.success as boolean,
      returnDataHash: hex(a, "returnDataHash", "answer.", 32),
      gasUsed: int(a, "gasUsed", "answer."),
      feeCharged: int(a, "feeCharged", "answer."),
      receiver: address(a, "receiver", "answer."),
      receiverBefore: int(a, "receiverBefore", "answer."),
      receiverAfter: int(a, "receiverAfter", "answer."),
    },
    server: address(r, "server", ""),
    sworn: address(r, "sworn", ""),
    digest: hex(r, "digest", "", 32),
    reserveTx: hex(r, "reserveTx", "", 32),
    coverage: int(r, "coverage", ""),
    mode: mode as PreflightResponse["mode"],
    guestVersion: hex(r, "guestVersion", "", 32),
    guestVkey: hex(r, "guestVkey", "", 32),
  };
}

// ---------------------------------------------------------------------------------------------
// EIP-712 digest, exactly as Sworn.digestOf (R3.4).
// ---------------------------------------------------------------------------------------------

const types = {
  SwornAnswer: [
    { name: "question", type: "Question" },
    { name: "answer", type: "Answer" },
  ],
  Question: [
    { name: "chainId", type: "uint64" },
    { name: "blockNumber", type: "uint64" },
    { name: "blockHash", type: "bytes32" },
    { name: "from", type: "address" },
    { name: "token", type: "address" },
    { name: "data", type: "bytes" },
    { name: "feeToken", type: "address" },
    { name: "gasLimit", type: "uint64" },
  ],
  Answer: [
    { name: "success", type: "bool" },
    { name: "returnDataHash", type: "bytes32" },
    { name: "gasUsed", type: "uint64" },
    { name: "feeCharged", type: "uint256" },
    { name: "receiver", type: "address" },
    { name: "receiverBefore", type: "uint256" },
    { name: "receiverAfter", type: "uint256" },
  ],
} as const;

export function digestOf(chainId: number, sworn: Address, q: Question, a: Answer): Hex {
  return hashTypedData({
    domain: { name: "Sworn", version: "1", chainId, verifyingContract: sworn },
    types,
    primaryType: "SwornAnswer",
    message: { question: q, answer: a },
  });
}

export function reservationKey(server: Address, digest: Hex): Hex {
  return keccak256(encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [server, digest]));
}

// ---------------------------------------------------------------------------------------------
// Verification — every number the UI shows about an answer comes out of this, or not at all.
// ---------------------------------------------------------------------------------------------

export type ReservationStatus = "Active" | "Slashed" | "Released";
const STATUS: Record<number, ReservationStatus | undefined> = { 1: "Active", 2: "Slashed", 3: "Released" };

export interface VerifiedAnswer {
  response: PreflightResponse;
  /** Read from the Reserved event in reserveTx. */
  reserved: { blockNumber: bigint; coverage: bigint; client: Address; expiry: bigint; txBlock: bigint };
  /** Read from Sworn.reservations(key) now. */
  status: ReservationStatus;
  token: { decimals: number; symbol: string };
  /** answer.receiverAfter − answer.receiverBefore (the answer is bound on chain by its digest). */
  receiverDelta: bigint;
}

export interface Expected {
  client: Address;
  from: Address;
  token: Address;
  receiver: Address;
  amount: bigint;
  feeToken: Address;
}

const TRANSFER = "0xa9059cbb";
const TRANSFER_WITH_MEMO = "0x95777d59";

/** Receiver and amount encoded in `transfer` / `transferWithMemo` calldata (R3.3 shape). */
export function decodeTransferData(data: Hex): { receiver: Address; amount: bigint } {
  const sel = data.slice(0, 10).toLowerCase();
  const len = (data.length - 2) / 2;
  if (!((sel === TRANSFER && len === 68) || (sel === TRANSFER_WITH_MEMO && len === 100))) {
    throw new DataError("question-mismatch", "question.data is not transfer / transferWithMemo");
  }
  const word = BigInt("0x" + data.slice(10, 74));
  if (word >> 160n !== 0n) throw new DataError("question-mismatch", "question.data receiver word is dirty");
  return { receiver: getAddress("0x" + data.slice(34, 74)), amount: BigInt("0x" + data.slice(74, 138)) };
}

export async function verifyPreflight(
  client: PublicClient,
  cfg: ChainConfig,
  resp: PreflightResponse,
  expected: Expected,
): Promise<VerifiedAnswer> {
  try {
    return await verifyInner(client, cfg, resp, expected);
  } catch (e) {
    throw asDataError(e);
  }
}

async function verifyInner(
  client: PublicClient,
  cfg: ChainConfig,
  resp: PreflightResponse,
  expected: Expected,
): Promise<VerifiedAnswer> {
  const { question: q, answer: a } = resp;

  // (1) the question is the one we asked
  if (resp.sworn !== cfg.sworn) throw new DataError("wrong-contract", `answer is reserved on ${resp.sworn}, not ${cfg.sworn}`);
  if (Number(q.chainId) !== cfg.chainId) throw new DataError("question-mismatch", `question.chainId ${q.chainId} ≠ ${cfg.chainId}`);
  const sent = decodeTransferData(q.data);
  if (q.from !== expected.from) throw new DataError("question-mismatch", "question.from is not the agent");
  if (q.token !== expected.token) throw new DataError("question-mismatch", "question.token differs from the payment's token");
  if (q.feeToken !== expected.feeToken) throw new DataError("question-mismatch", "question.feeToken differs");
  if (sent.receiver !== expected.receiver || a.receiver !== expected.receiver) {
    throw new DataError("question-mismatch", "question receiver differs from the payment's receiver");
  }
  if (sent.amount !== expected.amount) throw new DataError("question-mismatch", "question amount differs from the payment");

  // (2) the reservation is on chain, in the contract we trust
  if (cfg.swornCodehash) {
    const code = await client.getCode({ address: cfg.sworn });
    if (!code || keccak256(code) !== cfg.swornCodehash.toLowerCase()) {
      throw new DataError("codehash-mismatch", "Sworn's code on chain does not match the pinned codehash");
    }
  }
  const receipt = await client.getTransactionReceipt({ hash: resp.reserveTx }).catch((e: unknown) => {
    const name = (e as { name?: string }).name;
    if (name === "TransactionReceiptNotFoundError") {
      throw new DataError("tx-not-found", `reserve tx ${resp.reserveTx} is not on chain`);
    }
    throw e;
  });
  if (receipt.status !== "success") throw new DataError("tx-reverted", "reserve tx reverted");

  let reserved: VerifiedAnswer["reserved"] | undefined;
  let digestInLog: Hex | undefined;
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== cfg.sworn) continue;
    try {
      const ev = decodeEventLog({ abi: swornAbi, data: log.data, topics: log.topics });
      if (ev.eventName !== "Reserved") continue;
      if (getAddress(ev.args.server) !== resp.server) continue;
      digestInLog = ev.args.digest.toLowerCase() as Hex;
      if (ev.args.blockHash.toLowerCase() !== q.blockHash) throw new DataError("block-mismatch", "Reserved.blockHash ≠ question.blockHash");
      if (ev.args.blockNumber !== q.blockNumber) throw new DataError("block-mismatch", "Reserved.blockNumber ≠ question.blockNumber");
      reserved = {
        blockNumber: ev.args.blockNumber,
        coverage: ev.args.coverage,
        client: getAddress(ev.args.client),
        expiry: ev.args.expiry,
        txBlock: receipt.blockNumber,
      };
    } catch (e) {
      if (e instanceof DataError) throw e;
    }
  }
  if (!reserved || !digestInLog) {
    throw new DataError("no-reserved-event", `tx ${resp.reserveTx} has no Reserved event from ${cfg.sworn} for server ${resp.server}`);
  }

  // (3) the digest on chain is the digest of *this* (question, answer) — computed here and by the contract
  const local = digestOf(cfg.chainId, cfg.sworn, q, a);
  const onChain = (await client.readContract({
    address: cfg.sworn,
    abi: swornAbi,
    functionName: "digestOf",
    args: [q, a],
  })) as Hex;
  if (local !== onChain.toLowerCase()) throw new DataError("digest-mismatch", "local EIP-712 digest ≠ Sworn.digestOf");
  if (digestInLog !== local || resp.digest !== local) {
    throw new DataError("digest-mismatch", "the reserved digest is not the digest of the answer the server returned");
  }
  if (reserved.client !== expected.client) throw new DataError("client-mismatch", `reservation pays ${reserved.client}, not this agent`);
  if (reserved.coverage !== resp.coverage) throw new DataError("coverage-mismatch", "Reserved.coverage ≠ the server's stated coverage");

  // (4) the guest the contract will verify proofs against
  const [vkey, version, res, decimals, symbol] = await Promise.all([
    client.readContract({ address: cfg.sworn, abi: swornAbi, functionName: "GUEST_VKEY" }) as Promise<Hex>,
    client.readContract({ address: cfg.sworn, abi: swornAbi, functionName: "GUEST_VERSION" }) as Promise<Hex>,
    client.readContract({
      address: cfg.sworn,
      abi: swornAbi,
      functionName: "reservations",
      args: [reservationKey(resp.server, local)],
    }) as Promise<readonly [Address, bigint, number, bigint]>,
    client.readContract({ address: q.token, abi: tip20Abi, functionName: "decimals" }),
    client.readContract({ address: q.token, abi: tip20Abi, functionName: "symbol" }).catch(() => "USD"),
  ]);
  if (vkey.toLowerCase() !== resp.guestVkey) throw new DataError("vkey-mismatch", "Sworn.GUEST_VKEY ≠ the server's guestVkey");
  if (version.toLowerCase() !== resp.guestVersion) throw new DataError("version-mismatch", "Sworn.GUEST_VERSION ≠ the server's guestVersion");
  const status = STATUS[res[2]];
  if (!status) throw new DataError("no-reserved-event", "Sworn has no reservation under this key");

  return {
    response: resp,
    reserved,
    status,
    token: { decimals: Number(decimals), symbol },
    receiverDelta: a.receiverAfter - a.receiverBefore,
  };
}
