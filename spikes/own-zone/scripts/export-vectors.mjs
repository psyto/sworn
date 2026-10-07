// Export the own-Zone live run's three proven batches as test vectors (contracts/test/vectors/own-zone/).
// Read-only. For each batch in deployments/moderato.json → OwnZone.batches:
//   - the prover's record (runs/<run>/proofs/work/<batch>/summary.json + fixture.json: args, digest, public values,
//     vkey, Groth16 proof), and
//   - the verify call the portal actually made in that batch's submitBatch (debug_traceTransaction, callTracer).
// The two must agree field by field, and the proof bytes must be identical, or the script fails. So a committed
// vector is exactly what settled on Moderato, not a re-proof.
//
//   node spikes/own-zone/scripts/export-vectors.mjs [run dir, default spikes/own-zone/runs/moderato-20261007]
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const { decodeFunctionData, getAddress } = createRequire(path.join(repo, "site/package.json"))("viem");
const RPC = "https://rpc.moderato.tempo.xyz";
const run = path.resolve(repo, process.argv[2] ?? "spikes/own-zone/runs/moderato-20261007");
const out = path.join(repo, "contracts/test/vectors/own-zone");
const fail = (m) => { console.error(`export-vectors: ${m}`); process.exit(1); };

async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) fail(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

const T = (name, components) => ({ name, type: "tuple", components });
const verifyAbi = [{
  type: "function", name: "verify", stateMutability: "view", outputs: [{ name: "", type: "bool" }], inputs: [
    { name: "zoneId", type: "uint32" }, { name: "tempoBlockNumber", type: "uint64" }, { name: "anchorBlockNumber", type: "uint64" },
    { name: "anchorBlockHash", type: "bytes32" }, { name: "expectedWithdrawalBatchIndex", type: "uint64" }, { name: "nextZoneHeight", type: "uint256" },
    T("blockTransition", [{ name: "prevBlockHash", type: "bytes32" }, { name: "nextBlockHash", type: "bytes32" }]),
    T("depositQueueTransition", [{ name: "prevProcessedHash", type: "bytes32" }, { name: "nextProcessedHash", type: "bytes32" }, { name: "prevDepositNumber", type: "uint64" }, { name: "nextDepositNumber", type: "uint64" }]),
    T("tokenEnablementTransition", [{ name: "prevProcessedTokenCount", type: "uint64" }, { name: "nextProcessedTokenCount", type: "uint64" }]),
    { name: "withdrawalQueueHash", type: "bytes32" }, { name: "verifierConfig", type: "bytes" }, { name: "proof", type: "bytes" },
  ],
}];

const dep = JSON.parse(readFileSync(path.join(repo, "deployments/moderato.json"), "utf8")).OwnZone ?? fail("no OwnZone in moderato.json");
const V = getAddress(dep.SwornZoneVerifier.address);
const work = path.join(run, "proofs/work");
mkdirSync(out, { recursive: true });

// The deployed verifier's runtime code, so a test can run the real proofs against the exact bytecode on Moderato.
const code = await rpc("eth_getCode", [V, "latest"]);
const { keccak256 } = createRequire(path.join(repo, "site/package.json"))("viem");
if (keccak256(code) !== dep.SwornZoneVerifier.codehash) fail(`code at ${V} has hash ${keccak256(code)}, not moderato.json's`);
writeFileSync(path.join(out, "verifier-code.json"), JSON.stringify({
  note: `Runtime code of SwornZoneVerifier ${V} on Moderato (eth_getCode), codehash = deployments/moderato.json OwnZone. Same source as contracts/src/SwornZoneVerifier.sol, compiled with spikes/own-zone/contracts/foundry.toml.`,
  address: V, codehash: keccak256(code), code,
}, null, 2) + "\n");
console.log(`✓ verifier-code.json: ${(code.length - 2) / 2} bytes, codehash ${keccak256(code).slice(0, 10)}…`);

for (const b of dep.batches) {
  const dir = readdirSync(work).find((d) => d.includes(`-blocks${b.zoneBlocks}-a${b.anchor}`)) ?? fail(`no work dir for blocks ${b.zoneBlocks}`);
  const summary = JSON.parse(readFileSync(path.join(work, dir, "summary.json"), "utf8"));
  const fixture = JSON.parse(readFileSync(path.join(work, dir, "fixture.json"), "utf8"));

  const trace = await rpc("debug_traceTransaction", [b.submitTx, { tracer: "callTracer" }]);
  const find = (c) => (c.to && getAddress(c.to) === V ? c : (c.calls ?? []).map(find).find(Boolean));
  const call = find(trace) ?? fail(`${b.submitTx}: no call to ${V}`);
  const { args } = decodeFunctionData({ abi: verifyAbi, data: call.input });
  const [zoneId, tempoBlockNumber, anchorBlockNumber, anchorBlockHash, expectedWithdrawalBatchIndex, nextZoneHeight, bt, dq, te, withdrawalQueueHash, verifierConfig, proof] = args;
  const onChain = {
    zoneId: Number(zoneId), tempoBlockNumber: Number(tempoBlockNumber), anchorBlockNumber: Number(anchorBlockNumber), anchorBlockHash,
    expectedWithdrawalBatchIndex: Number(expectedWithdrawalBatchIndex), nextZoneHeight: Number(nextZoneHeight),
    prevBlockHash: bt.prevBlockHash, nextBlockHash: bt.nextBlockHash,
    prevProcessedHash: dq.prevProcessedHash, nextProcessedHash: dq.nextProcessedHash, prevDepositNumber: Number(dq.prevDepositNumber), nextDepositNumber: Number(dq.nextDepositNumber),
    prevProcessedTokenCount: Number(te.prevProcessedTokenCount), nextProcessedTokenCount: Number(te.nextProcessedTokenCount),
    withdrawalQueueHash,
  };
  for (const [k, v] of Object.entries(onChain)) {
    const mine = summary.args[k];
    if (mine === undefined || String(mine).toLowerCase() !== String(v).toLowerCase()) fail(`blocks ${b.zoneBlocks}: ${k} on chain ${v} != prover ${mine}`);
  }
  if (verifierConfig.toLowerCase() !== summary.verifierConfig.toLowerCase()) fail(`blocks ${b.zoneBlocks}: verifierConfig differs`);
  if (proof.toLowerCase() !== fixture.proof.toLowerCase()) fail(`blocks ${b.zoneBlocks}: the proof on chain is not the prover's proof`);
  if (getAddress(summary.verifier) !== V) fail(`blocks ${b.zoneBlocks}: prover bound the proof to ${summary.verifier}`);

  const vec = {
    note: `Own Zone live run on Moderato (2026-10-06), zone blocks ${b.zoneBlocks}. args/proof = the verify call OwnZonePortal made in submitBatch ${b.submitTx} (debug_traceTransaction), checked equal to the prover's record. Exported by spikes/own-zone/scripts/export-vectors.mjs.`,
    zoneBlocks: b.zoneBlocks,
    settlement: { portal: getAddress(dep.OwnZonePortal.address), submitTx: b.submitTx, submitBlock: b.submitBlock, verifyCalldata: call.input },
    args: onChain,
    destinationChainId: Number(summary.destinationChainId), parentChainId: Number(summary.parentChainId),
    digest: summary.digest, genesisArtifactHash: summary.genesisArtifactHash, publicValues: summary.publicValues,
    typehash: summary.typehash, verifier: V, verifierConfig, verifierConfigHash: summary.verifierConfigHash, zoneGuestVersion: summary.zoneGuestVersion,
    vkey: fixture.vkey, proof, mode: fixture.mode, prove_wall_secs: Number(fixture.prove_wall_secs), sp1_sdk: fixture.sp1_sdk,
  };
  const file = path.join(out, `zone4242-blocks${b.zoneBlocks}.json`);
  writeFileSync(file, JSON.stringify(vec, null, 2) + "\n");
  console.log(`✓ ${path.relative(repo, file)}: verify call from ${b.submitTx.slice(0, 10)}… = prover record; digest ${summary.digest.slice(0, 10)}…`);
}
