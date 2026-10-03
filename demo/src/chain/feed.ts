import { getAddress, parseAbiItem, type Address, type Hex, type PublicClient } from "viem";
import type { ChainConfig } from "./config.ts";
import { RECEIVE_POLICY_GUARD } from "./config.ts";
import { asDataError } from "./errors.ts";
import { tip20Abi } from "./abis.ts";

/** One line on the owner's phone. Every field comes from a log. */
export interface Notice {
  kind: "reserved" | "diverted" | "compensated";
  txHash: Hex;
  blockNumber: bigint;
  logIndex: number;
  amount: bigint;
  /** Block N the answer was about (reserved only). */
  aboutBlock?: bigint;
  server?: Address;
  token: Address;
  timestamp?: bigint;
}

const reservedEv = parseAbiItem(
  "event Reserved(address indexed server, bytes32 indexed digest, address indexed client, uint256 coverage, uint64 blockNumber, bytes32 blockHash, uint64 expiry)",
);
const slashedEv = parseAbiItem("event Slashed(address indexed server, bytes32 indexed digest, address indexed client, uint256 coverage)");
const transferEv = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 amount)");

const CHUNK = 5_000n;

async function chunked<T>(from: bigint, to: bigint, f: (a: bigint, b: bigint) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let a = from; a <= to; a += CHUNK) {
    const b = a + CHUNK - 1n > to ? to : a + CHUNK - 1n;
    out.push(...(await f(a, b)));
  }
  return out;
}

/** Notifications for the agent `owner`: its reservations, its payments diverted by a receive policy, its payouts. */
export async function readOwnerFeed(
  client: PublicClient,
  cfg: ChainConfig,
  owner: Address,
  paymentToken: Address,
): Promise<{ notices: Notice[]; head: bigint; from: bigint; decimals: Record<string, number> }> {
  try {
    const head = await client.getBlockNumber({ cacheTime: 0 });
    const from = head > cfg.feedLookback ? head - cfg.feedLookback : 0n;
    const bondToken = (await client.readContract({
      address: cfg.sworn,
      abi: [parseAbiItem("function BOND_TOKEN() view returns (address)")],
      functionName: "BOND_TOKEN",
    })) as Address;
    const [reserved, slashed, diverted] = await Promise.all([
      chunked(from, head, (a, b) =>
        client.getLogs({ address: cfg.sworn, event: reservedEv, args: { client: owner }, fromBlock: a, toBlock: b }),
      ),
      chunked(from, head, (a, b) =>
        client.getLogs({ address: cfg.sworn, event: slashedEv, args: { client: owner }, fromBlock: a, toBlock: b }),
      ),
      chunked(from, head, (a, b) =>
        client.getLogs({
          address: paymentToken,
          event: transferEv,
          args: { from: owner, to: RECEIVE_POLICY_GUARD },
          fromBlock: a,
          toBlock: b,
        }),
      ),
    ]);
    const notices: Notice[] = [
      ...reserved.map((l) => ({
        kind: "reserved" as const,
        txHash: l.transactionHash!,
        blockNumber: l.blockNumber!,
        logIndex: l.logIndex!,
        amount: l.args.coverage!,
        aboutBlock: l.args.blockNumber!,
        server: getAddress(l.args.server!),
        token: getAddress(bondToken),
      })),
      ...diverted.map((l) => ({
        kind: "diverted" as const,
        txHash: l.transactionHash!,
        blockNumber: l.blockNumber!,
        logIndex: l.logIndex!,
        amount: l.args.amount!,
        token: getAddress(paymentToken),
      })),
      ...slashed.map((l) => ({
        kind: "compensated" as const,
        txHash: l.transactionHash!,
        blockNumber: l.blockNumber!,
        logIndex: l.logIndex!,
        amount: l.args.coverage!,
        server: getAddress(l.args.server!),
        token: getAddress(bondToken),
      })),
    ].sort((x, y) => (x.blockNumber === y.blockNumber ? y.logIndex - x.logIndex : x.blockNumber > y.blockNumber ? -1 : 1));

    // timestamps for the newest 30 (one block read each)
    const blocks = [...new Set(notices.slice(0, 30).map((n) => n.blockNumber))];
    const stamps = new Map<bigint, bigint>();
    await Promise.all(
      blocks.map(async (b) => stamps.set(b, (await client.getBlock({ blockNumber: b })).timestamp)),
    );
    for (const n of notices) n.timestamp = stamps.get(n.blockNumber);

    const tokens = [...new Set(notices.map((n) => n.token))];
    const decimals: Record<string, number> = {};
    await Promise.all(
      tokens.map(async (t) => {
        decimals[t] = Number(await client.readContract({ address: t, abi: tip20Abi, functionName: "decimals" }));
      }),
    );
    return { notices, head, from, decimals };
  } catch (e) {
    throw asDataError(e);
  }
}
