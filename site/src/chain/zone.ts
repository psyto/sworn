// The Zone batch proofs on Moderato, read from chain. The primary evidence is the batch with a withdrawal
// (deployments/moderato.json SwornZoneVerifierWithdrawal, fixture
// contracts/test/vectors/zone-deposit_and_withdrawal_blocks5-6-sworn-sp1-groth16-v1.json); the first batch,
// hardfork_t13_recovery (SwornZoneVerifier), is read as a secondary "also verified" line. The proof re-checked
// by "Verify again" is the fixture the attest tx sent, and the page checks that it is byte-for-byte the same
// calldata as the transaction's. "Verify again" also calls Moderato's own Zone verifier (pre-T13 reference
// stub) with a malformed batch, for comparison; its ABI is the pre-T13 one, not IVerifier's 12 arguments.
//
// Reads run one after another (the public RPC rate-limits bursts).
import {
  BaseError,
  ContractFunctionRevertedError,
  decodeEventLog,
  decodeFunctionData,
  getAddress,
  keccak256,
  toFunctionSelector,
  type Address,
  type Client,
  type Hex,
  type Log,
} from "viem";
import { getBlock, getCode, getTransactionReceipt, readContract } from "viem/actions";
import deployments from "../../../deployments/moderato.json";
// Named imports: the bundle keeps only these fields of the fixtures (args, the proof, the config, the digest).
import {
  args as wdArgs,
  digest as wdDigest,
  proof as wdProof,
  verifierConfig as wdConfig,
} from "../../../contracts/test/vectors/zone-deposit_and_withdrawal_blocks5-6-sworn-sp1-groth16-v1.json";
import {
  args as hfArgs,
  digest as hfDigest,
  proof as hfProof,
  verifierConfig as hfConfig,
} from "../../../contracts/test/vectors/zone-hardfork-sworn-sp1-groth16-v1.json";
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

type FixtureArgs = typeof wdArgs;
interface Fixture {
  args: FixtureArgs;
  digest: string;
  proof: string;
  verifierConfig: string;
}

/** One proven batch: its fixture and its deployment record. */
export interface ZoneBatchDef {
  id: "withdrawal" | "hardfork";
  /** The integration-test case the batch comes from. */
  caseName: string;
  address: (cfg: ChainConfig) => Address;
  attestTx: Hex;
  codehash: Hex;
  constructor: typeof deployments.SwornZoneVerifier.constructor;
  fx: Fixture;
}

export const WITHDRAWAL_BATCH: ZoneBatchDef = {
  id: "withdrawal",
  caseName: "deposit_and_withdrawal_blocks5-6",
  address: (c) => c.zoneVerifierWithdrawal,
  attestTx: deployments.SwornZoneVerifierWithdrawal.attest.tx as Hex,
  codehash: deployments.SwornZoneVerifierWithdrawal.codehash as Hex,
  constructor: deployments.SwornZoneVerifierWithdrawal.constructor,
  fx: { args: wdArgs, digest: wdDigest, proof: wdProof, verifierConfig: wdConfig },
};

export const HARDFORK_BATCH: ZoneBatchDef = {
  id: "hardfork",
  caseName: "hardfork_t13_recovery",
  address: (c) => c.zoneVerifier,
  attestTx: deployments.SwornZoneVerifier.attest.tx as Hex,
  codehash: deployments.SwornZoneVerifier.codehash as Hex,
  constructor: deployments.SwornZoneVerifier.constructor,
  fx: { args: hfArgs, digest: hfDigest, proof: hfProof, verifierConfig: hfConfig },
};

/** A fixture's arguments in `verify`'s order, with nextZoneHeight optionally replaced. */
export function fixtureArgs(fx: Fixture = WITHDRAWAL_BATCH.fx, nextZoneHeight: bigint = BigInt(fx.args.nextZoneHeight)) {
  const a = fx.args;
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
    fx.verifierConfig as Hex,
    fx.proof as Hex,
  ] as const;
}

/** The primary batch's fixture, as the page shows it. */
export const FIXTURE = {
  zoneId: wdArgs.zoneId,
  nextZoneHeight: BigInt(wdArgs.nextZoneHeight),
  withdrawalQueueHash: wdArgs.withdrawalQueueHash as Hex,
  digest: wdDigest as Hex,
  proofBytes: (wdProof.length - 2) / 2,
};

const ZERO32 = `0x${"0".repeat(64)}` as Hex;

/**
 * What the batch contains, from deployments/moderato.json's record of it ("… 1 withdrawal, 2 user
 * transactions, withdrawalQueueHash 0xcf747192…02e7"). The record's hash prefix and suffix must agree with
 * the fixture, else `recordAgrees` is false and the page shows ✗.
 */
export const BATCH_CONTENTS = (() => {
  const line = deployments.SwornZoneVerifierWithdrawal.batch;
  const m = line.match(/(\d+) withdrawals?, (\d+) user transactions?, withdrawalQueueHash (0x[0-9a-f]+)…([0-9a-f]+)/);
  const wqh = FIXTURE.withdrawalQueueHash.toLowerCase();
  return {
    withdrawals: m ? Number(m[1]) : NaN,
    userTransactions: m ? Number(m[2]) : NaN,
    recordAgrees: !!m && wqh.startsWith(m[3]) && wqh.endsWith(m[4]),
    integrationTest: (line.match(/integration test (\S+)/)?.[1] ?? "").replace(/\s/g, ""),
  };
})();

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

/** An attest tx, its decoded event and calldata: enough for the "also verified" line. */
export interface AttestLine {
  txHash: Hex;
  contract: Address;
  blockNumber: bigint;
  timestamp: bigint;
  gasUsed: bigint;
  from: Address;
  event: ZoneEvent;
  /** The event's digest equals the fixture's (the digest the guest committed). */
  digestMatchesFixture: boolean;
  /** The attest calldata is the fixture's arguments and proof, byte for byte. */
  calldataMatchesFixture: boolean;
  /** withdrawalQueueHash from the attest calldata (the event does not carry it). */
  withdrawalQueueHash: Hex;
}

export interface ZoneAttest extends AttestLine {
  immutables: ZoneImmutables;
  /** Each immutable equals the deployment record's constructor argument. */
  immutablesMatch: boolean;
  codehash: Hex;
  codehashMatches: boolean;
  codeBytes: number;
}

/** The attest tx of `def`: the receipt, its ZoneBatchVerified event and the decoded calldata. */
export async function readAttestLine(client: Client, cfg: ChainConfig, def: ZoneBatchDef): Promise<AttestLine> {
  try {
    const hash = def.attestTx;
    const contract = def.address(cfg);
    const tx = (await client.request({ method: "eth_getTransactionByHash", params: [hash] } as never)) as RawTx | null;
    if (!tx || !tx.blockNumber) throw new DataError("tx-not-found", `attest tx ${hash} is not on chain`);
    const call = tx.calls?.length === 1 ? tx.calls[0] : { to: tx.to, input: tx.input ?? "0x" };
    if (!call.to || getAddress(call.to) !== contract) throw new DataError("wrong-contract", `attest tx ${hash} did not call ${contract}`);
    const rc = await getTransactionReceipt(client, { hash });
    if (rc.status !== "success") throw new DataError("tx-reverted", `attest tx ${hash} reverted`);

    let event: ZoneEvent | undefined;
    for (const log of rc.logs as Log[]) {
      if (getAddress(log.address) !== contract) continue;
      try {
        const ev = decodeEventLog({ abi: zoneVerifierAbi, data: log.data, topics: log.topics });
        if (ev.eventName === "ZoneBatchVerified") event = ev.args as ZoneEvent;
      } catch {
        /* not ours */
      }
    }
    if (!event) throw new DataError("no-zone-event", `tx ${hash} has no ZoneBatchVerified event from ${contract}`);

    const decoded = decodeFunctionData({ abi: zoneVerifierAbi, data: call.input as Hex });
    if (decoded.functionName !== "attest") throw new DataError("bad-response", `tx ${hash} is not an attest() call`);
    const calldataMatchesFixture = jsonish(decoded.args) === jsonish(fixtureArgs(def.fx));
    const timestamp = tx.blockTimestamp ? BigInt(tx.blockTimestamp) : (await getBlock(client, { blockNumber: rc.blockNumber })).timestamp;
    return {
      txHash: hash,
      contract,
      blockNumber: rc.blockNumber,
      timestamp,
      gasUsed: rc.gasUsed,
      from: getAddress(tx.from),
      event: { ...event, zoneId: Number(event.zoneId) },
      digestMatchesFixture: event.digest.toLowerCase() === def.fx.digest.toLowerCase(),
      calldataMatchesFixture,
      withdrawalQueueHash: decoded.args[9] as Hex,
    };
  } catch (e) {
    throw asDataError(e);
  }
}

/** The primary attest (the batch with a withdrawal), plus the contract's immutables and codehash. */
export async function readZoneAttest(client: Client, cfg: ChainConfig, def: ZoneBatchDef = WITHDRAWAL_BATCH): Promise<ZoneAttest> {
  try {
    const line = await readAttestLine(client, cfg, def);
    const contract = line.contract;
    const read = <R,>(functionName: string) => readContract(client, { address: contract, abi: zoneVerifierAbi, functionName } as never) as Promise<R>;
    const immutables: ZoneImmutables = {
      sp1Verifier: getAddress(await read<Address>("SP1_VERIFIER")),
      zoneVkey: await read<Hex>("ZONE_VKEY"),
      parentChainId: await read<bigint>("PARENT_CHAIN_ID"),
      pinnedZoneId: Number(await read<number>("PINNED_ZONE_ID")),
      pinnedGenesisArtifactHash: await read<Hex>("PINNED_GENESIS_ARTIFACT_HASH"),
      sp1VerifierVersion: "",
    };
    immutables.sp1VerifierVersion = await readContract(client, { address: immutables.sp1Verifier, abi: verifierAbi, functionName: "VERSION" });
    const k = def.constructor;
    const immutablesMatch =
      immutables.sp1Verifier === getAddress(k.sp1Verifier) &&
      immutables.zoneVkey.toLowerCase() === k.zoneVkey.toLowerCase() &&
      immutables.parentChainId === BigInt(k.parentChainId) &&
      immutables.pinnedZoneId === k.pinnedZoneId &&
      immutables.pinnedGenesisArtifactHash.toLowerCase() === k.pinnedGenesisArtifactHash.toLowerCase();

    const code = await getCode(client, { address: contract });
    if (!code || code === "0x") throw new DataError("wrong-contract", `no code at ${contract}`);
    const codehash = keccak256(code);
    return {
      ...line,
      immutables,
      immutablesMatch,
      codehash,
      codehashMatches: codehash.toLowerCase() === def.codehash.toLowerCase(),
      codeBytes: (code.length - 2) / 2,
    };
  } catch (e) {
    throw asDataError(e);
  }
}

export const isNonZero = (h: Hex) => h.toLowerCase() !== ZERO32;

const jsonish = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : typeof x === "string" ? x.toLowerCase() : x));

// ── Moderato's own Zone verifier today (pre-T13) ───────────────────────────────────────────────────
// Runtime at 0x5A56… = tempo crates/contracts/src/zones.rs ZONE_VERIFIER_RUNTIME, compiled from zones
// crates/contracts/src/runtime/tempo/Verifier.sol ("Stub implementation that always returns true for
// prototyping"). Its ABI is the PRE-T13 one: 10 arguments, no nextZoneHeight and no token-enablement
// transition, selector 0x7106a43e. It is NOT IVerifier's 12-argument verify that SwornZoneVerifier has.
const T2 = <N extends string, C extends readonly unknown[]>(name: N, components: C) => ({ name, type: "tuple" as const, components });
export const preT13VerifierAbi = [
  {
    type: "function", name: "verify", stateMutability: "pure", outputs: [{ name: "", type: "bool" }], inputs: [
      { name: "zoneId", type: "uint32" },
      { name: "tempoBlockNumber", type: "uint64" },
      { name: "anchorBlockNumber", type: "uint64" },
      { name: "anchorBlockHash", type: "bytes32" },
      { name: "expectedWithdrawalBatchIndex", type: "uint64" },
      T2("blockTransition", [{ name: "prevBlockHash", type: "bytes32" }, { name: "nextBlockHash", type: "bytes32" }] as const),
      T2("depositQueueTransition", [
        { name: "prevProcessedHash", type: "bytes32" }, { name: "nextProcessedHash", type: "bytes32" },
        { name: "prevDepositNumber", type: "uint64" }, { name: "nextDepositNumber", type: "uint64" },
      ] as const),
      { name: "withdrawalQueueHash", type: "bytes32" },
      { name: "verifierConfig", type: "bytes" },
      { name: "proof", type: "bytes" },
    ],
  },
] as const;
export const PRE_T13_SELECTOR = toFunctionSelector(preT13VerifierAbi[0]);

/** The malformed batch sent to Moderato's verifier: nonsense on purpose, shown on the page as is. */
export const MALFORMED = {
  zoneId: 99,
  number: 0n,
  hash: ZERO32,
  verifierConfig: "0xdead" as Hex,
  proof: "0xbeef" as Hex,
};
const malformedArgs = [
  MALFORMED.zoneId, MALFORMED.number, MALFORMED.number, MALFORMED.hash, MALFORMED.number,
  { prevBlockHash: MALFORMED.hash, nextBlockHash: MALFORMED.hash },
  { prevProcessedHash: MALFORMED.hash, nextProcessedHash: MALFORMED.hash, prevDepositNumber: MALFORMED.number, nextDepositNumber: MALFORMED.number },
  MALFORMED.hash, MALFORMED.verifierConfig, MALFORMED.proof,
] as const;

export interface VerifyNow {
  /** eth_call verify(real proof of the batch with a withdrawal) on latest. */
  real: boolean;
  /** eth_call verify with nextZoneHeight + 1: the custom error it reverted with. */
  mutatedError: string;
  mutatedHeight: bigint;
  /** eth_call of Moderato's pre-T13 verifier with the malformed batch: what it returned, as read. */
  preT13: { result: "true" | "false" | "reverted"; selector: Hex };
  readAt: number;
}

/**
 * Three live eth_calls: Sworn's verify(real proof) must return true and one changed field must revert;
 * Moderato's pre-T13 verifier is called with a malformed batch and its answer is reported as it is.
 */
export async function verifyZoneNow(client: Client, cfg: ChainConfig): Promise<VerifyNow> {
  try {
    const address = cfg.zoneVerifierWithdrawal;
    const real = (await readContract(client, { address, abi: zoneVerifierAbi, functionName: "verify", args: fixtureArgs() })) as boolean;
    if (real !== true) throw new DataError("verify-false", "verify(real proof) did not return true");
    const mutatedHeight = FIXTURE.nextZoneHeight + 1n;
    let mutatedError: string | undefined;
    try {
      await readContract(client, { address, abi: zoneVerifierAbi, functionName: "verify", args: fixtureArgs(WITHDRAWAL_BATCH.fx, mutatedHeight) });
    } catch (e) {
      mutatedError = revertName(e);
    }
    if (mutatedError === undefined) throw new DataError("mutation-accepted", "verify accepted a changed nextZoneHeight");

    let preT13: VerifyNow["preT13"]["result"];
    try {
      const r = (await readContract(client, { address: cfg.preT13Verifier, abi: preT13VerifierAbi, functionName: "verify", args: malformedArgs })) as boolean;
      preT13 = r ? "true" : "false";
    } catch (e) {
      revertName(e); // rethrows an RPC failure
      preT13 = "reverted";
    }
    return { real, mutatedError, mutatedHeight, preT13: { result: preT13, selector: PRE_T13_SELECTOR }, readAt: Date.now() };
  } catch (e) {
    throw asDataError(e);
  }
}

/** The custom error of a revert; anything that is not a revert (an RPC failure) is rethrown. */
export function revertName(e: unknown): string {
  const rev = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
  if (!(rev instanceof ContractFunctionRevertedError)) throw e;
  return rev.data?.errorName ?? rev.signature ?? "revert";
}
