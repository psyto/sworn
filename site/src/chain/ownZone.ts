// Our own Zone on Moderato (2026-10-06 live run), read-only against the public RPC. Only the transaction
// hashes and addresses come from deployments/moderato.json (OwnZone); every shown value is read from chain:
//  - the portal's state: which verifier it calls, how many batches settled, the settled zone height;
//  - each submitBatch receipt: status 1, sent to the portal, a BatchSubmitted event from the portal;
//  - the payout receipt: WithdrawalProcessed(to, senderTag, token, amount, callbackSuccess) from the portal;
//  - the verifier's immutables (parent chain, pinned zone).
// Reads run one after another (the public RPC rate-limits bursts).
import { decodeEventLog, decodeFunctionData, getAddress, toEventSelector, type Address, type Client, type Hex, type Log } from "viem";
import { getTransactionReceipt, readContract } from "viem/actions";
import deployments from "../../../deployments/moderato.json";
import type { ChainConfig } from "./config.ts";
import { DataError, asDataError } from "./errors.ts";
import { revertName, zoneVerifierAbi } from "./zone.ts";
// The withdrawal batch's verify call, exactly as OwnZonePortal made it in submitBatch (taken from the trace by
// spikes/own-zone/scripts/export-vectors.mjs; forge re-checks it against the deployed bytecode). Named imports keep
// only these fields in the bundle.
import { settlement as wdSettlement, args as wdArgs, proof as wdProof } from "../../../contracts/test/vectors/own-zone/zone4242-blocks56-61.json";

const view = <N extends string, Ty extends string>(name: N, type: Ty) =>
  ({ type: "function", name, stateMutability: "view", inputs: [], outputs: [{ name: "", type }] }) as const;

/** OwnZonePortal (upstream ZonePortal, deployer-only initialize): only what the page reads. */
export const ownPortalAbi = [
  view("zoneId", "uint32"),
  view("verifier", "address"),
  view("withdrawalBatchIndex", "uint64"),
  view("zoneHeight", "uint256"),
] as const;

const INVALID_PROOF = "0x09bde339";
export const BATCH_SUBMITTED_TOPIC = toEventSelector("BatchSubmitted(uint64,uint256,bytes32,bytes32,bytes32,uint64,uint64)");
export const WITHDRAWAL_PROCESSED_TOPIC = toEventSelector("WithdrawalProcessed(address,bytes32,address,uint128,bool)");

const OZ = deployments.OwnZone;
export const OWN_ZONE = {
  portal: getAddress(OZ.OwnZonePortal.address),
  verifier: getAddress(OZ.SwornZoneVerifier.address),
  zoneId: OZ.zoneId,
  batches: OZ.batches.map((b) => ({ ...b, submitTx: b.submitTx as Hex })),
  payoutTx: OZ.payout.tx as Hex,
  user: getAddress(OZ.roles.user),
  userDelta: BigInt(OZ.payout.userPathUSD.delta),
  sequencer: getAddress(OZ.roles.sequencer),
  forgedTx: OZ.forgedBatch.tx as Hex,
  date: OZ.date,
};

export interface SettledBatch {
  zoneBlocks: string;
  content: string;
  txHash: Hex;
  blockNumber: bigint;
  gasUsed: bigint;
  anchor: number;
  anchorAge: bigint;
}

export interface Payout {
  txHash: Hex;
  blockNumber: bigint;
  to: Address;
  token: Address;
  amount: bigint;
  callbackSuccess: boolean;
}

/** The forged batch a malicious sequencer submitted: status 0, and the trace shows the verifier reverting. */
export interface ForgedRejection {
  txHash: Hex;
  blockNumber: bigint;
  gasUsed: bigint;
  /** The verifier's revert inside the portal's call (InvalidProof() = 0x09bde339). */
  verifierRevert: Hex;
}

export interface OwnZoneRead {
  portal: Address;
  portalVerifier: Address;
  zoneId: number;
  withdrawalBatchIndex: bigint;
  zoneHeight: bigint;
  parentChainId: bigint;
  pinnedZoneId: number;
  batches: SettledBatch[];
  payout: Payout;
  forged: ForgedRejection;
}

/** The WithdrawalProcessed event of a receipt, emitted by the portal. Exported for tests. */
export function decodePayout(logs: Pick<Log, "address" | "topics" | "data">[], portal: Address): Omit<Payout, "txHash" | "blockNumber"> {
  const log = logs.find((l) => getAddress(l.address) === portal && l.topics[0] === WITHDRAWAL_PROCESSED_TOPIC);
  if (!log) throw new DataError("no-zone-event", "no WithdrawalProcessed event from the portal in this receipt");
  const ev = decodeEventLog({
    abi: [{
      type: "event", name: "WithdrawalProcessed", inputs: [
        { name: "to", type: "address", indexed: true }, { name: "senderTag", type: "bytes32", indexed: true },
        { name: "token", type: "address", indexed: false }, { name: "amount", type: "uint128", indexed: false },
        { name: "callbackSuccess", type: "bool", indexed: false },
      ],
    }] as const,
    topics: log.topics as [Hex, ...Hex[]],
    data: log.data,
  });
  return { to: getAddress(ev.args.to), token: getAddress(ev.args.token), amount: ev.args.amount, callbackSuccess: ev.args.callbackSuccess };
}

export async function readOwnZone(client: Client, _cfg: ChainConfig): Promise<OwnZoneRead> {
  try {
    const p = OWN_ZONE.portal;
    const portalRead = <R,>(functionName: string) => readContract(client, { address: p, abi: ownPortalAbi, functionName } as never) as Promise<R>;
    const vRead = <R,>(functionName: string) => readContract(client, { address: OWN_ZONE.verifier, abi: zoneVerifierAbi, functionName } as never) as Promise<R>;
    const portalVerifier = getAddress(await portalRead<Address>("verifier"));
    if (portalVerifier !== OWN_ZONE.verifier) throw new DataError("wrong-contract", `portal calls ${portalVerifier}, not ${OWN_ZONE.verifier}`);
    const zoneId = Number(await portalRead<number>("zoneId"));
    const withdrawalBatchIndex = await portalRead<bigint>("withdrawalBatchIndex");
    const zoneHeight = await portalRead<bigint>("zoneHeight");
    const parentChainId = await vRead<bigint>("PARENT_CHAIN_ID");
    const pinnedZoneId = Number(await vRead<number>("PINNED_ZONE_ID"));

    const batches: SettledBatch[] = [];
    for (const b of OWN_ZONE.batches) {
      const r = await getTransactionReceipt(client, { hash: b.submitTx });
      if (r.status !== "success") throw new DataError("tx-reverted", `submitBatch ${b.submitTx} reverted`);
      if (!r.to || getAddress(r.to) !== p) throw new DataError("wrong-contract", `submitBatch ${b.submitTx} was not sent to the portal`);
      if (!r.logs.some((l) => getAddress(l.address) === p && l.topics[0] === BATCH_SUBMITTED_TOPIC))
        throw new DataError("no-zone-event", `no BatchSubmitted event in ${b.submitTx}`);
      batches.push({
        zoneBlocks: b.zoneBlocks, content: b.content, txHash: b.submitTx, blockNumber: r.blockNumber, gasUsed: r.gasUsed,
        anchor: b.anchor, anchorAge: r.blockNumber - BigInt(b.anchor),
      });
    }

    const pr = await getTransactionReceipt(client, { hash: OWN_ZONE.payoutTx });
    if (pr.status !== "success") throw new DataError("tx-reverted", `payout ${OWN_ZONE.payoutTx} reverted`);
    const payout: Payout = { txHash: OWN_ZONE.payoutTx, blockNumber: pr.blockNumber, ...decodePayout(pr.logs, p) };
    if (pr.blockNumber <= batches[batches.length - 1].blockNumber)
      throw new DataError("block-mismatch", "the payout is not after the last settled batch");

    // The forged batch: reverted, sequencer → portal, and the revert came from the verifier (not an earlier check).
    const fr = await getTransactionReceipt(client, { hash: OWN_ZONE.forgedTx });
    if (fr.status !== "reverted") throw new DataError("bad-response", `forged batch ${OWN_ZONE.forgedTx} did not revert`);
    if (!fr.to || getAddress(fr.to) !== p || getAddress(fr.from) !== OWN_ZONE.sequencer) throw new DataError("wrong-contract", "forged batch is not sequencer → portal");
    type Frame = { to?: string; error?: string; output?: Hex; calls?: Frame[] };
    const trace = (await client.request({ method: "debug_traceTransaction", params: [OWN_ZONE.forgedTx, { tracer: "callTracer" }] } as never)) as Frame;
    const find = (c: Frame): Frame | undefined => (c.to && getAddress(c.to) === OWN_ZONE.verifier ? c : (c.calls ?? []).map(find).find(Boolean));
    const vcall = find(trace);
    if (!vcall?.error || !String(vcall.output ?? "").startsWith(INVALID_PROOF)) throw new DataError("bad-response", "forged batch: the verifier did not revert InvalidProof()");
    const forged: ForgedRejection = { txHash: OWN_ZONE.forgedTx, blockNumber: fr.blockNumber, gasUsed: fr.gasUsed, verifierRevert: vcall.output as Hex };

    return { portal: p, portalVerifier, zoneId, withdrawalBatchIndex, zoneHeight, parentChainId, pinnedZoneId, batches, payout, forged };
  } catch (e) {
    throw asDataError(e);
  }
}

export interface OwnZoneVerifyNow {
  submitTx: Hex;
  /** The submitBatch transaction's calldata carries this proof and the batch's block and withdrawal-queue hashes. */
  boundToTx: true;
  real: boolean;
  height: bigint;
  mutatedError: string;
  readAt: number;
}

/**
 * Re-check our own Zone's withdrawal batch, live and read-only: the verify call its portal made (from the
 * trace, committed as a vector) must be the one the submitBatch transaction carries, must return true now, and
 * must revert with nextZoneHeight + 1.
 */
export async function verifyOwnZoneNow(client: Client): Promise<OwnZoneVerifyNow> {
  try {
    const submitTx = wdSettlement.submitTx as Hex;
    const tx = (await client.request({ method: "eth_getTransactionByHash", params: [submitTx] } as never)) as
      | { to?: Address | null; input?: Hex; calls?: { to: Address | null; input: Hex }[] }
      | null;
    if (!tx) throw new DataError("tx-not-found", `${submitTx} not found`);
    const call = tx.calls?.length === 1 ? tx.calls[0] : { to: tx.to ?? null, input: tx.input ?? "0x" };
    if (!call.to || getAddress(call.to) !== OWN_ZONE.portal) throw new DataError("wrong-contract", `${submitTx} is not a call to the portal`);
    const input = call.input.toLowerCase();
    for (const [name, value] of [["proof", wdProof], ["prevBlockHash", wdArgs.prevBlockHash], ["nextBlockHash", wdArgs.nextBlockHash], ["withdrawalQueueHash", wdArgs.withdrawalQueueHash]] as const)
      if (!input.includes(value.slice(2).toLowerCase())) throw new DataError("fixture-mismatch", `${submitTx} does not carry the recorded ${name}`);

    const { args } = decodeFunctionData({ abi: zoneVerifierAbi, data: wdSettlement.verifyCalldata as Hex });
    const a = [...(args as readonly unknown[])];
    const real = (await readContract(client, { address: OWN_ZONE.verifier, abi: zoneVerifierAbi, functionName: "verify", args: a } as never)) as boolean;
    if (real !== true) throw new DataError("verify-false", "verify(the portal's call) did not return true");
    const height = a[5] as bigint;
    a[5] = height + 1n;
    let mutatedError: string | undefined;
    try {
      await readContract(client, { address: OWN_ZONE.verifier, abi: zoneVerifierAbi, functionName: "verify", args: a } as never);
    } catch (e) {
      mutatedError = revertName(e);
    }
    if (mutatedError === undefined) throw new DataError("mutation-accepted", "verify accepted a changed nextZoneHeight");
    return { submitTx, boundToTx: true, real, height, mutatedError, readAt: Date.now() };
  } catch (e) {
    throw asDataError(e);
  }
}
