// The Zone batch proof on Moderato, read from chain. The attest tx hash and the contract's expected codehash
// come from deployments/moderato.json; the proof re-checked by "Verify again" is the fixture the attest tx
// sent (contracts/test/vectors/zone-hardfork.json), and the page checks that it is byte-for-byte the same
// calldata as the transaction's.
//
// Reads run one after another (the public RPC rate-limits bursts).
import {
  BaseError,
  ContractFunctionRevertedError,
  decodeEventLog,
  decodeFunctionData,
  getAddress,
  keccak256,
  type Address,
  type Client,
  type Hex,
  type Log,
} from "viem";
import { getBlock, getCode, getTransactionReceipt, readContract } from "viem/actions";
import deployments from "../../../deployments/moderato.json";
// Named imports: the bundle keeps only these fields of the fixture (args, the proof, the config, the digest).
import { args as fxArgs, digest as fxDigest, proof as fxProof, verifierConfig as fxConfig } from "../../../contracts/test/vectors/zone-hardfork.json";
import { verifierAbi } from "./abis.ts";
import type { ChainConfig } from "./config.ts";
import { DataError, asDataError } from "./errors.ts";

const T = <N extends string, C extends readonly unknown[]>(name: N, components: C) => ({ name, type: "tuple" as const, components });
const zoneInputs = [
  { name: "zoneId", type: "uint32" },
  { name: "tempoBlockNumber", type: "uint64" },
  { name: "anchorBlockNumber", type: "uint64" },
  { name: "anchorBlockHash", type: "bytes32" },
  { name: "expectedWithdrawalBatchIndex", type: "uint64" },
  { name: "nextZoneHeight", type: "uint256" },
  T("blockTransition", [{ name: "prevBlockHash", type: "bytes32" }, { name: "nextBlockHash", type: "bytes32" }] as const),
  T("depositQueueTransition", [
    { name: "prevProcessedHash", type: "bytes32" }, { name: "nextProcessedHash", type: "bytes32" },
    { name: "prevDepositNumber", type: "uint64" }, { name: "nextDepositNumber", type: "uint64" },
  ] as const),
  T("tokenEnablementTransition", [{ name: "prevProcessedTokenCount", type: "uint64" }, { name: "nextProcessedTokenCount", type: "uint64" }] as const),
  { name: "withdrawalQueueHash", type: "bytes32" },
  { name: "verifierConfig", type: "bytes" },
  { name: "proof", type: "bytes" },
] as const;
const view = <N extends string, Ty extends string>(name: N, type: Ty) =>
  ({ type: "function", name, stateMutability: "view", inputs: [], outputs: [{ name: "", type }] }) as const;

/** contracts/src/SwornZoneVerifier.sol, only what the page uses. */
export const zoneVerifierAbi = [
  { type: "function", name: "verify", stateMutability: "view", inputs: zoneInputs, outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "attest", stateMutability: "nonpayable", inputs: zoneInputs, outputs: [] },
  {
    type: "event", name: "ZoneBatchVerified", anonymous: false, inputs: [
      { name: "zoneId", type: "uint32", indexed: false }, { name: "nextZoneHeight", type: "uint256", indexed: false },
      { name: "prevBlockHash", type: "bytes32", indexed: false }, { name: "nextBlockHash", type: "bytes32", indexed: false },
      { name: "digest", type: "bytes32", indexed: false },
    ],
  },
  { type: "error", name: "WrongVerifierConfig", inputs: [] },
  { type: "error", name: "WrongZone", inputs: [] },
  { type: "error", name: "InvalidProof", inputs: [] },
  view("SP1_VERIFIER", "address"),
  view("ZONE_VKEY", "bytes32"),
  view("PARENT_CHAIN_ID", "uint256"),
  view("PINNED_ZONE_ID", "uint32"),
  view("PINNED_GENESIS_ARTIFACT_HASH", "bytes32"),
] as const;

/** The fixture's arguments in `verify`'s order, with nextZoneHeight optionally replaced. */
export function fixtureArgs(nextZoneHeight: bigint = BigInt(fxArgs.nextZoneHeight)) {
  const a = fxArgs;
  return [
    a.zoneId,
    BigInt(a.tempoBlockNumber),
    BigInt(a.anchorBlockNumber),
    a.anchorBlockHash as Hex,
    BigInt(a.expectedWithdrawalBatchIndex),
    nextZoneHeight,
    { prevBlockHash: a.prevBlockHash as Hex, nextBlockHash: a.nextBlockHash as Hex },
    {
      prevProcessedHash: a.prevProcessedHash as Hex, nextProcessedHash: a.nextProcessedHash as Hex,
      prevDepositNumber: BigInt(a.prevDepositNumber), nextDepositNumber: BigInt(a.nextDepositNumber),
    },
    { prevProcessedTokenCount: BigInt(a.prevProcessedTokenCount), nextProcessedTokenCount: BigInt(a.nextProcessedTokenCount) },
    a.withdrawalQueueHash as Hex,
    fxConfig as Hex,
    fxProof as Hex,
  ] as const;
}

export const FIXTURE = {
  nextZoneHeight: BigInt(fxArgs.nextZoneHeight),
  digest: fxDigest as Hex,
  proofBytes: (fxProof.length - 2) / 2,
};

export const ZONE = {
  attestTx: deployments.SwornZoneVerifier.attest.tx as Hex,
  codehash: deployments.SwornZoneVerifier.codehash as Hex,
  constructor: deployments.SwornZoneVerifier.constructor,
};

interface RawTx {
  from: Address;
  to: Address | null;
  input?: Hex;
  /** Tempo transactions (type 0x76) carry a list of calls. */
  calls?: { to: Address | null; input: Hex }[];
  blockNumber: Hex | null;
  blockTimestamp?: Hex;
}

export interface ZoneEvent {
  zoneId: number;
  nextZoneHeight: bigint;
  prevBlockHash: Hex;
  nextBlockHash: Hex;
  digest: Hex;
}

export interface ZoneImmutables {
  sp1Verifier: Address;
  zoneVkey: Hex;
  parentChainId: bigint;
  pinnedZoneId: number;
  pinnedGenesisArtifactHash: Hex;
  /** VERSION() of the SP1 verifier it points at. */
  sp1VerifierVersion: string;
}

export interface ZoneAttest {
  txHash: Hex;
  blockNumber: bigint;
  timestamp: bigint;
  gasUsed: bigint;
  from: Address;
  event: ZoneEvent;
  /** The event's digest equals the fixture's (the digest the guest committed). */
  digestMatchesFixture: boolean;
  /** The attest calldata is the fixture's arguments and proof, byte for byte. */
  calldataMatchesFixture: boolean;
  immutables: ZoneImmutables;
  /** Each immutable equals the deployment record's constructor argument. */
  immutablesMatch: boolean;
  codehash: Hex;
  codehashMatches: boolean;
  codeBytes: number;
}

export async function readZoneAttest(client: Client, cfg: ChainConfig): Promise<ZoneAttest> {
  try {
    const hash = ZONE.attestTx;
    const tx = (await client.request({ method: "eth_getTransactionByHash", params: [hash] } as never)) as RawTx | null;
    if (!tx || !tx.blockNumber) throw new DataError("tx-not-found", `attest tx ${hash} is not on chain`);
    const call = tx.calls?.length === 1 ? tx.calls[0] : { to: tx.to, input: tx.input ?? "0x" };
    if (!call.to || getAddress(call.to) !== cfg.zoneVerifier) throw new DataError("wrong-contract", `attest tx ${hash} did not call SwornZoneVerifier`);
    const rc = await getTransactionReceipt(client, { hash });
    if (rc.status !== "success") throw new DataError("tx-reverted", `attest tx ${hash} reverted`);

    let event: ZoneEvent | undefined;
    for (const log of rc.logs as Log[]) {
      if (getAddress(log.address) !== cfg.zoneVerifier) continue;
      try {
        const ev = decodeEventLog({ abi: zoneVerifierAbi, data: log.data, topics: log.topics });
        if (ev.eventName === "ZoneBatchVerified") event = ev.args as ZoneEvent;
      } catch {
        /* not ours */
      }
    }
    if (!event) throw new DataError("no-zone-event", `tx ${hash} has no ZoneBatchVerified event from SwornZoneVerifier`);

    const decoded = decodeFunctionData({ abi: zoneVerifierAbi, data: call.input as Hex });
    if (decoded.functionName !== "attest") throw new DataError("bad-response", `tx ${hash} is not an attest() call`);
    const calldataMatchesFixture = jsonish(decoded.args) === jsonish(fixtureArgs());

    const read = <R,>(functionName: string) => readContract(client, { address: cfg.zoneVerifier, abi: zoneVerifierAbi, functionName } as never) as Promise<R>;
    const immutables: ZoneImmutables = {
      sp1Verifier: getAddress(await read<Address>("SP1_VERIFIER")),
      zoneVkey: await read<Hex>("ZONE_VKEY"),
      parentChainId: await read<bigint>("PARENT_CHAIN_ID"),
      pinnedZoneId: Number(await read<number>("PINNED_ZONE_ID")),
      pinnedGenesisArtifactHash: await read<Hex>("PINNED_GENESIS_ARTIFACT_HASH"),
      sp1VerifierVersion: "",
    };
    immutables.sp1VerifierVersion = await readContract(client, { address: immutables.sp1Verifier, abi: verifierAbi, functionName: "VERSION" });
    const k = ZONE.constructor;
    const immutablesMatch =
      immutables.sp1Verifier === getAddress(k.sp1Verifier) &&
      immutables.zoneVkey.toLowerCase() === k.zoneVkey.toLowerCase() &&
      immutables.parentChainId === BigInt(k.parentChainId) &&
      immutables.pinnedZoneId === k.pinnedZoneId &&
      immutables.pinnedGenesisArtifactHash.toLowerCase() === k.pinnedGenesisArtifactHash.toLowerCase();

    const code = await getCode(client, { address: cfg.zoneVerifier });
    if (!code || code === "0x") throw new DataError("wrong-contract", `no code at ${cfg.zoneVerifier}`);
    const codehash = keccak256(code);
    const timestamp = tx.blockTimestamp ? BigInt(tx.blockTimestamp) : (await getBlock(client, { blockNumber: rc.blockNumber })).timestamp;

    return {
      txHash: hash,
      blockNumber: rc.blockNumber,
      timestamp,
      gasUsed: rc.gasUsed,
      from: getAddress(tx.from),
      event: { ...event, zoneId: Number(event.zoneId) },
      digestMatchesFixture: event.digest.toLowerCase() === FIXTURE.digest.toLowerCase(),
      calldataMatchesFixture,
      immutables,
      immutablesMatch,
      codehash,
      codehashMatches: codehash.toLowerCase() === ZONE.codehash.toLowerCase(),
      codeBytes: (code.length - 2) / 2,
    };
  } catch (e) {
    throw asDataError(e);
  }
}

const jsonish = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : typeof x === "string" ? x.toLowerCase() : x));

export interface VerifyNow {
  /** eth_call verify(real proof) on latest. */
  real: boolean;
  /** eth_call verify with nextZoneHeight + 1: the custom error it reverted with. */
  mutatedError: string;
  mutatedHeight: bigint;
  readAt: number;
}

/** Two live eth_calls of verify(...): the real proof (must return true) and one changed field (must revert). */
export async function verifyZoneNow(client: Client, cfg: ChainConfig): Promise<VerifyNow> {
  try {
    const real = (await readContract(client, { address: cfg.zoneVerifier, abi: zoneVerifierAbi, functionName: "verify", args: fixtureArgs() })) as boolean;
    if (real !== true) throw new DataError("verify-false", "verify(real proof) did not return true");
    const mutatedHeight = FIXTURE.nextZoneHeight + 1n;
    let mutatedError: string | undefined;
    try {
      await readContract(client, { address: cfg.zoneVerifier, abi: zoneVerifierAbi, functionName: "verify", args: fixtureArgs(mutatedHeight) });
    } catch (e) {
      const rev = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
      if (!(rev instanceof ContractFunctionRevertedError)) throw e; // an RPC failure, not a revert
      mutatedError = rev.data?.errorName ?? rev.signature ?? "revert";
    }
    if (mutatedError === undefined) throw new DataError("mutation-accepted", "verify accepted a changed nextZoneHeight");
    return { real, mutatedError, mutatedHeight, readAt: Date.now() };
  } catch (e) {
    throw asDataError(e);
  }
}
