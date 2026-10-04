// The timeline of one real slash on Moderato, read from chain. Nothing here is typed in: the three tx hashes
// come from deployments/moderato.json, every amount, address, block and timestamp from the RPC.
//
// Reads run one after another, never in parallel: the public Moderato RPC rate-limits bursts (429 / -32005),
// and viem retries each call with backoff (client.ts).
import { decodeEventLog, decodeFunctionData, getAddress, keccak256, stringToHex, type Address, type Client, type Hex, type Log } from "viem";
import { getBlock, getTransactionReceipt, readContract } from "viem/actions";
import { receivePolicyGuardAbi, swornAbi, tip20Abi, verifierAbi } from "./abis.ts";
import { RECEIVE_POLICY_GUARD, type ChainConfig, type Take } from "./config.ts";
import { DataError, asDataError } from "./errors.ts";

interface RawTx {
  hash: Hex;
  from: Address;
  to: Address | null;
  input: Hex;
  blockNumber: Hex | null;
  blockTimestamp?: Hex;
}

async function rawTx(client: Client, hash: Hex, what: string): Promise<RawTx> {
  const tx = (await client.request({ method: "eth_getTransactionByHash", params: [hash] } as never)) as RawTx | null;
  if (!tx || !tx.blockNumber) throw new DataError("tx-not-found", `${what} tx ${hash} is not on chain`);
  return tx;
}

async function receipt(client: Client, hash: Hex, what: string) {
  try {
    return await getTransactionReceipt(client, { hash });
  } catch (e) {
    if ((e as { name?: string }).name === "TransactionReceiptNotFoundError") {
      throw new DataError("tx-not-found", `${what} tx ${hash} is not on chain`);
    }
    throw e;
  }
}

async function timestampOf(client: Client, tx: RawTx): Promise<bigint> {
  if (tx.blockTimestamp) return BigInt(tx.blockTimestamp);
  return (await getBlock(client, { blockNumber: BigInt(tx.blockNumber!) })).timestamp;
}

const balanceAt = (client: Client, token: Address, who: Address, blockNumber: bigint) =>
  readContract(client, { address: token, abi: tip20Abi, functionName: "balanceOf", args: [who], blockNumber });


export interface Reservation {
  txHash: Hex;
  blockNumber: bigint;
  timestamp: bigint;
  server: Address;
  client: Address;
  digest: Hex;
  coverage: bigint;
  /** Block N the answer is about. */
  aboutBlock: bigint;
  /** The question: who pays, which token, to whom, how much. */
  payer: Address;
  token: Address;
  receiver: Address;
  amount: bigint;
  /** The answer as reserved: the receiver's balance change it claims. */
  claimedDelta: bigint;
}

export interface Payment {
  txHash: Hex;
  blockNumber: bigint;
  timestamp: bigint;
  success: boolean;
  /** TransferBlocked(receiver) from ReceivePolicyGuard in the receipt. */
  blockedByPolicy: boolean;
  receiverBefore: bigint;
  receiverAfter: bigint;
  guardBefore: bigint;
  guardAfter: bigint;
}

export interface Slash {
  txHash: Hex;
  blockNumber: bigint;
  timestamp: bigint;
  challenger: Address;
  server: Address;
  client: Address;
  coverage: bigint;
  bondToken: Address;
  clientBefore: bigint;
  clientAfter: bigint;
}

export interface Timeline {
  reservation: Reservation;
  payment: Payment;
  slash: Slash;
  paymentToken: { decimals: number; symbol: string };
  bondTokenMeta: { decimals: number; symbol: string };
}

export async function readTimeline(client: Client, cfg: ChainConfig, take: Take): Promise<Timeline> {
  try {
    // 1. The reservation: a Reserved event from Sworn, and the reserve() calldata (question + answer).
    const rTx = await rawTx(client, take.reserveTx, "reserve");
    if (!rTx.to || getAddress(rTx.to) !== cfg.sworn) throw new DataError("wrong-contract", `reserve tx ${take.reserveTx} was not sent to Sworn`);
    const rRc = await receipt(client, take.reserveTx, "reserve");
    if (rRc.status !== "success") throw new DataError("tx-reverted", `reserve tx ${take.reserveTx} reverted`);
    let reserved: { server: Address; digest: Hex; client: Address; coverage: bigint; blockNumber: bigint } | undefined;
    for (const log of rRc.logs as Log[]) {
      if (getAddress(log.address) !== cfg.sworn) continue;
      try {
        const ev = decodeEventLog({ abi: swornAbi, data: log.data, topics: log.topics });
        if (ev.eventName === "Reserved") reserved = ev.args as typeof reserved;
      } catch {
        /* not ours */
      }
    }
    if (!reserved) throw new DataError("no-reserved-event", `tx ${take.reserveTx} has no Reserved event from Sworn`);
    const call = decodeFunctionData({ abi: swornAbi, data: rTx.input });
    if (call.functionName !== "reserve") throw new DataError("bad-response", `tx ${take.reserveTx} is not a reserve() call`);
    const [q, a] = call.args as unknown as [
      { from: Address; token: Address; data: Hex; blockNumber: bigint },
      { receiver: Address; receiverBefore: bigint; receiverAfter: bigint },
    ];
    const t = decodeFunctionData({ abi: tip20Abi, data: q.data });
    if (t.functionName !== "transfer" && t.functionName !== "transferWithMemo") throw new DataError("question-mismatch", "the question is not a TIP-20 transfer");
    const [to, amount] = t.args as unknown as [Address, bigint];
    if (getAddress(to) !== getAddress(a.receiver)) throw new DataError("question-mismatch", "the answer's receiver is not the transfer's receiver");
    const reservation: Reservation = {
      txHash: take.reserveTx,
      blockNumber: rRc.blockNumber,
      timestamp: await timestampOf(client, rTx),
      server: getAddress(reserved.server),
      client: getAddress(reserved.client),
      digest: reserved.digest,
      coverage: reserved.coverage,
      aboutBlock: BigInt(reserved.blockNumber),
      payer: getAddress(q.from),
      token: getAddress(q.token),
      receiver: getAddress(a.receiver),
      amount,
      claimedDelta: a.receiverAfter - a.receiverBefore,
    };

    // 2. The payment: its receipt, and the receiver's and the guard's balances at block-1 and block.
    const pTx = await rawTx(client, take.paymentTx, "payment");
    const pRc = await receipt(client, take.paymentTx, "payment");
    if (getAddress(pTx.from) !== reservation.payer) throw new DataError("client-mismatch", "the payment was not sent by the agent that asked");
    let blockedByPolicy = false;
    let sawTransfer = false;
    for (const log of pRc.logs as Log[]) {
      const at = getAddress(log.address);
      try {
        if (at === reservation.token) {
          const ev = decodeEventLog({ abi: tip20Abi, data: log.data, topics: log.topics });
          if (ev.eventName === "Transfer" && getAddress(ev.args.from) === reservation.payer) sawTransfer = true;
        } else if (at === RECEIVE_POLICY_GUARD) {
          const ev = decodeEventLog({ abi: receivePolicyGuardAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "TransferBlocked" && getAddress(ev.args.receiver) === reservation.receiver) blockedByPolicy = true;
        }
      } catch {
        /* not an event we read */
      }
    }
    if (pRc.status === "success" && !sawTransfer) throw new DataError("no-transfer", `payment tx moved no ${reservation.token} from the agent`);
    const pb = pRc.blockNumber;
    const receiverBefore = await balanceAt(client, reservation.token, reservation.receiver, pb - 1n);
    const receiverAfter = await balanceAt(client, reservation.token, reservation.receiver, pb);
    const guardBefore = await balanceAt(client, reservation.token, RECEIVE_POLICY_GUARD, pb - 1n);
    const guardAfter = await balanceAt(client, reservation.token, RECEIVE_POLICY_GUARD, pb);
    const payment: Payment = {
      txHash: take.paymentTx,
      blockNumber: pb,
      timestamp: await timestampOf(client, pTx),
      success: pRc.status === "success",
      blockedByPolicy,
      receiverBefore,
      receiverAfter,
      guardBefore,
      guardAfter,
    };

    // 3. The challenge: a Slashed event for this reservation's digest, and the agent's bond-token balance around it.
    const cTx = await rawTx(client, take.challengeTx, "challenge");
    const cRc = await receipt(client, take.challengeTx, "challenge");
    if (cRc.status !== "success") throw new DataError("tx-reverted", `challenge tx ${take.challengeTx} reverted`);
    let slashed: { server: Address; digest: Hex; client: Address; coverage: bigint } | undefined;
    for (const log of cRc.logs as Log[]) {
      if (getAddress(log.address) !== cfg.sworn) continue;
      try {
        const ev = decodeEventLog({ abi: swornAbi, data: log.data, topics: log.topics });
        if (ev.eventName === "Slashed" && ev.args.digest.toLowerCase() === reservation.digest.toLowerCase()) slashed = ev.args as typeof slashed;
      } catch {
        /* not ours */
      }
    }
    if (!slashed) throw new DataError("no-slash-event", `tx ${take.challengeTx} has no Slashed event from Sworn for this reservation`);
    if (getAddress(slashed.client) !== reservation.client) throw new DataError("client-mismatch", "the slash paid a different client");
    const bondToken = getAddress((await readContract(client, { address: cfg.sworn, abi: swornAbi, functionName: "BOND_TOKEN" })) as Address);
    const cb = cRc.blockNumber;
    const clientBefore = await balanceAt(client, bondToken, reservation.client, cb - 1n);
    const clientAfter = await balanceAt(client, bondToken, reservation.client, cb);
    const slash: Slash = {
      txHash: take.challengeTx,
      blockNumber: cb,
      timestamp: await timestampOf(client, cTx),
      challenger: getAddress(cTx.from),
      server: getAddress(slashed.server),
      client: getAddress(slashed.client),
      coverage: slashed.coverage,
      bondToken,
      clientBefore,
      clientAfter,
    };

    const meta = async (token: Address) => ({
      decimals: Number(await readContract(client, { address: token, abi: tip20Abi, functionName: "decimals" })),
      symbol: (await readContract(client, { address: token, abi: tip20Abi, functionName: "symbol" })) as string,
    });
    const paymentToken = await meta(reservation.token);
    const bondTokenMeta = bondToken === reservation.token ? paymentToken : await meta(bondToken);
    return { reservation, payment, slash, paymentToken, bondTokenMeta };
  } catch (e) {
    throw asDataError(e);
  }
}

// ---------------------------------------------------------------------------------------------
// The proof system's pins, read from the contracts.
// ---------------------------------------------------------------------------------------------


export interface ProofPins {
  verifier: Address;
  verifierVersion: string;
  guestVkey: Hex;
  guestVersion: Hex;
  /** GUEST_VERSION == keccak256("sworn-guest-v1"), computed here. */
  guestVersionIsV1: boolean;
  maxAge: bigint;
}

export async function readProofPins(client: Client, cfg: ChainConfig): Promise<ProofPins> {
  try {
    const read = (functionName: string) => readContract(client, { address: cfg.sworn, abi: swornAbi, functionName } as never) as Promise<unknown>;
    const verifier = getAddress((await read("SP1_VERIFIER")) as Address);
    const guestVkey = (await read("GUEST_VKEY")) as Hex;
    const guestVersion = (await read("GUEST_VERSION")) as Hex;
    const maxAge = (await read("MAX_AGE")) as bigint;
    const verifierVersion = await readContract(client, { address: verifier, abi: verifierAbi, functionName: "VERSION" });
    return {
      verifier,
      verifierVersion,
      guestVkey,
      guestVersion,
      guestVersionIsV1: guestVersion.toLowerCase() === keccak256(stringToHex("sworn-guest-v1")).toLowerCase(),
      maxAge,
    };
  } catch (e) {
    throw asDataError(e);
  }
}
