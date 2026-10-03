import { decodeEventLog, getAddress, type Address, type Hex, type Log, type PublicClient } from "viem";
import { receivePolicyGuardAbi, swornAbi, tip20Abi } from "./abis.ts";
import { RECEIVE_POLICY_GUARD, type ChainConfig } from "./config.ts";
import { DataError, asDataError } from "./errors.ts";

async function receiptOf(client: PublicClient, hash: Hex, what: string) {
  try {
    return await client.getTransactionReceipt({ hash });
  } catch (e) {
    if ((e as { name?: string }).name === "TransactionReceiptNotFoundError") {
      throw new DataError("tx-not-found", `${what} tx ${hash} is not on chain`);
    }
    throw asDataError(e);
  }
}

async function balanceAt(client: PublicClient, token: Address, who: Address, blockNumber: bigint) {
  return client.readContract({ address: token, abi: tip20Abi, functionName: "balanceOf", args: [who], blockNumber });
}

// ---------------------------------------------------------------------------------------------
// Where did a payment go? Read from its receipt and from balances around its block.
// ---------------------------------------------------------------------------------------------

export interface PaymentOutcome {
  txHash: Hex;
  blockNumber: bigint;
  success: boolean;
  /** Amount the intended receiver was credited (Transfer from → receiver). */
  credited: bigint;
  /** Amount redirected to ReceivePolicyGuard (Transfer from → guard + TransferBlocked). */
  diverted: bigint;
  blockedByPolicy: boolean;
  receiverBalance: { before: bigint; after: bigint };
  guardBalance: { before: bigint; after: bigint };
  decimals: number;
}

export async function readPayment(
  client: PublicClient,
  args: { txHash: Hex; token: Address; from: Address; receiver: Address },
): Promise<PaymentOutcome> {
  try {
    const r = await receiptOf(client, args.txHash, "payment");
    let credited = 0n;
    let diverted = 0n;
    let blockedByPolicy = false;
    let sawTransfer = false;
    for (const log of r.logs as Log[]) {
      const at = getAddress(log.address);
      try {
        if (at === args.token) {
          const ev = decodeEventLog({ abi: tip20Abi, data: log.data, topics: log.topics });
          if (ev.eventName !== "Transfer" || getAddress(ev.args.from) !== args.from) continue;
          sawTransfer = true;
          const to = getAddress(ev.args.to);
          if (to === args.receiver) credited += ev.args.amount;
          else if (to === RECEIVE_POLICY_GUARD) diverted += ev.args.amount;
        } else if (at === RECEIVE_POLICY_GUARD) {
          const ev = decodeEventLog({ abi: receivePolicyGuardAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "TransferBlocked" && getAddress(ev.args.receiver) === args.receiver) blockedByPolicy = true;
        }
      } catch {
        /* not an event we read */
      }
    }
    if (r.status === "success" && !sawTransfer) {
      throw new DataError("no-transfer", `tx ${args.txHash} moved no ${args.token} from ${args.from}`);
    }
    const prev = r.blockNumber - 1n;
    const [rb, ra, gb, ga, decimals] = await Promise.all([
      balanceAt(client, args.token, args.receiver, prev),
      balanceAt(client, args.token, args.receiver, r.blockNumber),
      balanceAt(client, args.token, RECEIVE_POLICY_GUARD, prev),
      balanceAt(client, args.token, RECEIVE_POLICY_GUARD, r.blockNumber),
      client.readContract({ address: args.token, abi: tip20Abi, functionName: "decimals" }),
    ]);
    return {
      txHash: args.txHash,
      blockNumber: r.blockNumber,
      success: r.status === "success",
      credited,
      diverted,
      blockedByPolicy,
      receiverBalance: { before: rb, after: ra },
      guardBalance: { before: gb, after: ga },
      decimals: Number(decimals),
    };
  } catch (e) {
    throw asDataError(e);
  }
}

// ---------------------------------------------------------------------------------------------
// The payout: a Slashed event and the client's bond-token balance around it.
// ---------------------------------------------------------------------------------------------

export interface SlashOutcome {
  txHash: Hex;
  blockNumber: bigint;
  server: Address;
  digest: Hex;
  client: Address;
  coverage: bigint;
  clientBalance: { before: bigint; after: bigint };
  bondToken: Address;
  decimals: number;
}

export async function readSlash(
  client: PublicClient,
  cfg: ChainConfig,
  args: { txHash: Hex; digest?: Hex },
): Promise<SlashOutcome> {
  try {
    const r = await receiptOf(client, args.txHash, "challenge");
    if (r.status !== "success") throw new DataError("tx-reverted", "challenge tx reverted");
    for (const log of r.logs as Log[]) {
      if (getAddress(log.address) !== cfg.sworn) continue;
      let ev;
      try {
        ev = decodeEventLog({ abi: swornAbi, data: log.data, topics: log.topics });
      } catch {
        continue;
      }
      if (ev.eventName !== "Slashed") continue;
      if (args.digest && ev.args.digest.toLowerCase() !== args.digest.toLowerCase()) continue;
      const bondToken = (await client.readContract({ address: cfg.sworn, abi: swornAbi, functionName: "BOND_TOKEN" })) as Address;
      const who = getAddress(ev.args.client);
      const [before, after, decimals] = await Promise.all([
        balanceAt(client, bondToken, who, r.blockNumber - 1n),
        balanceAt(client, bondToken, who, r.blockNumber),
        client.readContract({ address: bondToken, abi: tip20Abi, functionName: "decimals" }),
      ]);
      return {
        txHash: args.txHash,
        blockNumber: r.blockNumber,
        server: getAddress(ev.args.server),
        digest: ev.args.digest,
        client: who,
        coverage: ev.args.coverage,
        clientBalance: { before, after },
        bondToken: getAddress(bondToken),
        decimals: Number(decimals),
      };
    }
    throw new DataError("no-slash-event", `tx ${args.txHash} has no Slashed event from ${cfg.sworn}`);
  } catch (e) {
    throw asDataError(e);
  }
}

// ---------------------------------------------------------------------------------------------
// Contract constants for the "How it works" panel — read, not typed in.
// ---------------------------------------------------------------------------------------------

export interface SwornParams {
  maxAge: bigint;
  challengePeriod: bigint;
  guestVkey: Hex;
  guestVersion: Hex;
  verifier: Address;
  bondToken: Address;
}

export async function readSwornParams(client: PublicClient, cfg: ChainConfig): Promise<SwornParams> {
  try {
    const read = (functionName: string) =>
      client.readContract({ address: cfg.sworn, abi: swornAbi, functionName } as never) as Promise<unknown>;
    const [maxAge, challengePeriod, guestVkey, guestVersion, verifier, bondToken] = await Promise.all([
      read("MAX_AGE"),
      read("CHALLENGE_PERIOD"),
      read("GUEST_VKEY"),
      read("GUEST_VERSION"),
      read("SP1_VERIFIER"),
      read("BOND_TOKEN"),
    ]);
    return {
      maxAge: maxAge as bigint,
      challengePeriod: challengePeriod as bigint,
      guestVkey: guestVkey as Hex,
      guestVersion: guestVersion as Hex,
      verifier: verifier as Address,
      bondToken: bondToken as Address,
    };
  } catch (e) {
    throw asDataError(e);
  }
}

export async function readBalance(client: PublicClient, token: Address, who: Address) {
  try {
    const [value, decimals] = await Promise.all([
      client.readContract({ address: token, abi: tip20Abi, functionName: "balanceOf", args: [who] }),
      client.readContract({ address: token, abi: tip20Abi, functionName: "decimals" }),
    ]);
    return { value, decimals: Number(decimals) };
  } catch (e) {
    throw asDataError(e);
  }
}
