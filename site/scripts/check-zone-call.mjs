// Confirms SwornZoneVerifier.verify is callable with eth_call on the public Moderato RPC (read-only, no keys).
import { createPublicClient, http, encodeFunctionData, decodeErrorResult, toFunctionSelector } from "viem";
import fx from "../../contracts/test/vectors/zone-hardfork.json" with { type: "json" };
import dep from "../../deployments/moderato.json" with { type: "json" };
const T = (n, c) => ({ name: n, type: "tuple", components: c });
const inputs = [
  { name: "zoneId", type: "uint32" }, { name: "tempoBlockNumber", type: "uint64" }, { name: "anchorBlockNumber", type: "uint64" },
  { name: "anchorBlockHash", type: "bytes32" }, { name: "expectedWithdrawalBatchIndex", type: "uint64" }, { name: "nextZoneHeight", type: "uint256" },
  T("blockTransition", [{ name: "prevBlockHash", type: "bytes32" }, { name: "nextBlockHash", type: "bytes32" }]),
  T("depositQueueTransition", [{ name: "prevProcessedHash", type: "bytes32" }, { name: "nextProcessedHash", type: "bytes32" }, { name: "prevDepositNumber", type: "uint64" }, { name: "nextDepositNumber", type: "uint64" }]),
  T("tokenEnablementTransition", [{ name: "prevProcessedTokenCount", type: "uint64" }, { name: "nextProcessedTokenCount", type: "uint64" }]),
  { name: "withdrawalQueueHash", type: "bytes32" }, { name: "verifierConfig", type: "bytes" }, { name: "proof", type: "bytes" },
];
const abi = [
  { type: "function", name: "verify", stateMutability: "view", inputs, outputs: [{ type: "bool" }] },
  { type: "error", name: "InvalidProof", inputs: [] }, { type: "error", name: "WrongZone", inputs: [] }, { type: "error", name: "WrongVerifierConfig", inputs: [] },
];
const a = fx.args;
const args = (h) => [a.zoneId, BigInt(a.tempoBlockNumber), BigInt(a.anchorBlockNumber), a.anchorBlockHash, BigInt(a.expectedWithdrawalBatchIndex), BigInt(h),
  { prevBlockHash: a.prevBlockHash, nextBlockHash: a.nextBlockHash },
  { prevProcessedHash: a.prevProcessedHash, nextProcessedHash: a.nextProcessedHash, prevDepositNumber: BigInt(a.prevDepositNumber), nextDepositNumber: BigInt(a.nextDepositNumber) },
  { prevProcessedTokenCount: BigInt(a.prevProcessedTokenCount), nextProcessedTokenCount: BigInt(a.nextProcessedTokenCount) },
  a.withdrawalQueueHash, fx.verifierConfig, fx.proof];
const c = createPublicClient({ transport: http("https://rpc.moderato.tempo.xyz") });
const to = dep.SwornZoneVerifier.address;
console.log("selector", toFunctionSelector(abi[0]));
const ok = await c.request({ method: "eth_call", params: [{ to, data: encodeFunctionData({ abi, functionName: "verify", args: args(a.nextZoneHeight) }) }, "latest"] });
console.log("verify(real) ->", ok);
try {
  const bad = await c.request({ method: "eth_call", params: [{ to, data: encodeFunctionData({ abi, functionName: "verify", args: args(a.nextZoneHeight + 1) }) }, "latest"] });
  console.log("UNEXPECTED mutated ->", bad);
} catch (e) {
  const data = e?.cause?.data ?? e?.data ?? e?.details;
  console.log("mutated reverted:", e.shortMessage, "| data:", JSON.stringify(e.cause?.data ?? e.data));
  try { console.log("decoded:", decodeErrorResult({ abi, data: e.cause?.data ?? e.data }).errorName); } catch (x) { console.log("decode failed", x.message); }
}
