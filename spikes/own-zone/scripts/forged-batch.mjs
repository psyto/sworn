// A malicious sequencer tries to settle a FORGED batch on our own Zone's portal, and the proof stops it.
//
//   node forged-batch.mjs selfcheck            no key: recompute the SettlementAttestation digest of the real
//                                              withdrawal batch (56-61) and recover its on-chain signature to the
//                                              sequencer, so the forged batch is signed exactly as the node signs.
//   node forged-batch.mjs build <out.json>     needs OWN_ZONE_SEQUENCER_KEY (from scripts/with-zone-keys.sh): build
//                                              the forged batch on top of the portal's current state, sign its
//                                              settlement certificate with the sequencer key (a local signature,
//                                              nothing is sent), and eth_call it from the sequencer: it must revert
//                                              with InvalidProof(), not with any earlier check.
//   node forged-batch.mjs check-tx <out.json> <txHash>
//                                              after own-zone.sh forged-batch --send: the receipt is status 0 and
//                                              to the portal, its trace shows the portal's STATICCALL to the verifier
//                                              reverting, and the portal's state equals the state before.
//
// The forged batch: prevBlockHash = the portal's current blockHash (zone height 61), a made-up nextBlockHash and
// withdrawal-queue hash (as if paying an attacker), deposits and token enablements unchanged, a direct anchor a few
// blocks old, and the REAL Groth16 proof of the withdrawal batch 56-61 replayed. Every check before the proof passes
// (sequencer, anchor, quorum certificate, deposit and token transitions); only the proof fails.
// Read-only except for the local signature; the transaction is sent by own-zone.sh forged-batch --send.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const req = createRequire(path.join(repo, "site/package.json"));
const { decodeFunctionData, encodeAbiParameters, encodeFunctionData, getAddress, hashTypedData, keccak256, recoverAddress, toHex, stringToHex } = req("viem");
const { privateKeyToAccount } = req("viem/accounts");

const RPC = process.env.L1_HTTP ?? "https://rpc.moderato.tempo.xyz";
const fail = (m) => { console.error(`forged-batch: ${m}`); process.exit(1); };
const say = (m) => console.log(`[forged-batch] ${m}`);
async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  return j;
}
async function rpcOk(method, params) { const j = await rpc(method, params); if (j.error) fail(`${method}: ${JSON.stringify(j.error)}`); return j.result; }

const dep = JSON.parse(readFileSync(path.join(repo, "deployments/moderato.json"), "utf8")).OwnZone;
const PORTAL = getAddress(dep.OwnZonePortal.address), VERIFIER = getAddress(dep.SwornZoneVerifier.address), SEQ = getAddress(dep.roles.sequencer);
const portalAbi = JSON.parse(readFileSync(path.join(repo, "spikes/own-zone/contracts/out/OwnZonePortal.sol/OwnZonePortal.json"), "utf8")).abi;
const wd = JSON.parse(readFileSync(path.join(repo, "contracts/test/vectors/own-zone/zone4242-blocks56-61.json"), "utf8"));
const INVALID_PROOF = "0x09bde339";

async function view(name, args = [], block = "latest") {
  const data = encodeFunctionData({ abi: portalAbi, functionName: name, args });
  const r = await rpcOk("eth_call", [{ to: PORTAL, data }, block]);
  const { decodeFunctionResult } = req("viem");
  return decodeFunctionResult({ abi: portalAbi, functionName: name, data: r });
}

const enc = (types, values) => keccak256(encodeAbiParameters(types, values));
function digestOf({ zoneId, sequencerSetVersion, zoneHeight, withdrawalBatchIndex, tempoBlockNumber, anchorBlockNumber, anchorBlockHash, bt, dq, te, withdrawalQueueHash, verifierConfig }) {
  return hashTypedData({
    domain: { name: "ZonePortal", version: "1", chainId: 42431, verifyingContract: PORTAL },
    types: {
      SettlementAttestation: [
        { name: "zoneId", type: "uint32" }, { name: "sequencerSetVersion", type: "uint64" }, { name: "zoneHeight", type: "uint256" },
        { name: "withdrawalBatchIndex", type: "uint256" }, { name: "verifier", type: "address" }, { name: "tempoBlockNumber", type: "uint64" },
        { name: "anchorBlockNumber", type: "uint64" }, { name: "anchorBlockHash", type: "bytes32" }, { name: "blockTransitionHash", type: "bytes32" },
        { name: "depositQueueTransitionHash", type: "bytes32" }, { name: "tokenEnablementTransitionHash", type: "bytes32" },
        { name: "withdrawalQueueHash", type: "bytes32" }, { name: "verifierConfigHash", type: "bytes32" },
      ],
    },
    primaryType: "SettlementAttestation",
    message: {
      zoneId, sequencerSetVersion, zoneHeight, withdrawalBatchIndex, verifier: VERIFIER, tempoBlockNumber, anchorBlockNumber, anchorBlockHash,
      blockTransitionHash: enc([{ type: "bytes32" }, { type: "bytes32" }], [bt.prevBlockHash, bt.nextBlockHash]),
      depositQueueTransitionHash: enc([{ type: "bytes32" }, { type: "bytes32" }, { type: "uint64" }, { type: "uint64" }], [dq.prevProcessedHash, dq.nextProcessedHash, dq.prevDepositNumber, dq.nextDepositNumber]),
      tokenEnablementTransitionHash: enc([{ type: "uint64" }, { type: "uint64" }], [te.prevProcessedTokenCount, te.nextProcessedTokenCount]),
      withdrawalQueueHash, verifierConfigHash: keccak256(verifierConfig),
    },
  });
}

async function selfcheck() {
  const tx = await rpcOk("eth_getTransactionByHash", [wd.settlement.submitTx]);
  const input = tx.calls?.length === 1 ? tx.calls[0].input : tx.input;
  const { args } = decodeFunctionData({ abi: portalAbi, data: input });
  const [tempoBlockNumber, , bt, dq, te, withdrawalQueueHash, verifierConfig, , zoneHeight, signatures] = args;
  const before = BigInt(wd.settlement.submitBlock) - 1n;
  const h = "0x" + before.toString(16);
  const digest = digestOf({
    zoneId: Number(await view("zoneId", [], h)), sequencerSetVersion: await view("sequencerSetVersion", [], h), zoneHeight,
    withdrawalBatchIndex: (await view("withdrawalBatchIndex", [], h)) + 1n, tempoBlockNumber,
    anchorBlockNumber: BigInt(wd.args.anchorBlockNumber), anchorBlockHash: wd.args.anchorBlockHash, bt, dq, te, withdrawalQueueHash, verifierConfig,
  });
  const signer = await recoverAddress({ hash: digest, signature: signatures[0] });
  if (getAddress(signer) !== SEQ) fail(`selfcheck: real batch signature recovers to ${signer}, not the sequencer ${SEQ}`);
  say(`selfcheck OK: the withdrawal batch's on-chain certificate (${signatures[0].length / 2 - 1} bytes) recovers to the sequencer ${SEQ} under this digest`);
}

async function build(out) {
  const key = process.env.OWN_ZONE_SEQUENCER_KEY;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key ?? "")) fail("OWN_ZONE_SEQUENCER_KEY missing (run under scripts/with-zone-keys.sh)");
  const acct = privateKeyToAccount(key);
  if (getAddress(acct.address) !== SEQ) fail(`key is ${acct.address}, not the sequencer ${SEQ}`);
  const head = BigInt(await rpcOk("eth_blockNumber", []));
  const tempoBlockNumber = head - 5n;
  const anchorBlockHash = (await rpcOk("eth_getBlockByNumber", ["0x" + tempoBlockNumber.toString(16), false])).hash;
  const state = {
    zoneId: Number(await view("zoneId")), sequencerSetVersion: await view("sequencerSetVersion"), zoneHeight: await view("zoneHeight"),
    withdrawalBatchIndex: await view("withdrawalBatchIndex"), blockHash: await view("blockHash"),
    lastProcessedDepositNumber: await view("lastProcessedDepositNumber"), lastProcessedEnabledTokenCount: await view("lastProcessedEnabledTokenCount"),
    tokenEnablementCursorInitialized: await view("tokenEnablementCursorInitialized"), withdrawalQueueTail: await view("withdrawalQueueTail"),
  };
  if (state.blockHash.toLowerCase() !== wd.args.nextBlockHash.toLowerCase()) fail(`portal blockHash ${state.blockHash} is not the withdrawal batch's (${wd.args.nextBlockHash}): the zone moved`);
  const tokenPrev = state.tokenEnablementCursorInitialized ? state.lastProcessedEnabledTokenCount : 0n;
  const forged = {
    tempoBlockNumber, recentTempoBlockNumber: 0n,
    bt: { prevBlockHash: state.blockHash, nextBlockHash: keccak256(stringToHex("sworn: forged zone block 62")) },
    dq: { prevProcessedHash: wd.args.nextProcessedHash, nextProcessedHash: wd.args.nextProcessedHash, prevDepositNumber: state.lastProcessedDepositNumber, nextDepositNumber: state.lastProcessedDepositNumber },
    te: { prevProcessedTokenCount: tokenPrev, nextProcessedTokenCount: tokenPrev },
    withdrawalQueueHash: keccak256(stringToHex("sworn: forged withdrawal queue, paying an attacker")),
    verifierConfig: wd.verifierConfig, proof: wd.proof, zoneHeight: state.zoneHeight + 1n,
  };
  const digest = digestOf({
    zoneId: state.zoneId, sequencerSetVersion: state.sequencerSetVersion, zoneHeight: forged.zoneHeight, withdrawalBatchIndex: state.withdrawalBatchIndex + 1n,
    tempoBlockNumber, anchorBlockNumber: tempoBlockNumber, anchorBlockHash, bt: forged.bt, dq: forged.dq, te: forged.te,
    withdrawalQueueHash: forged.withdrawalQueueHash, verifierConfig: forged.verifierConfig,
  });
  const signature = await acct.sign({ hash: digest });
  if (getAddress(await recoverAddress({ hash: digest, signature })) !== SEQ) fail("own signature does not recover to the sequencer");
  const data = encodeFunctionData({
    abi: portalAbi, functionName: "submitBatch",
    args: [tempoBlockNumber, 0n, forged.bt, forged.dq, forged.te, forged.withdrawalQueueHash, forged.verifierConfig, forged.proof, forged.zoneHeight, [signature]],
  });
  const sim = await rpc("eth_call", [{ from: SEQ, to: PORTAL, data, gas: "0x1e8480" }, "latest"]);
  const reason = sim.error?.data ?? null;
  if (!sim.error || !String(reason).startsWith(INVALID_PROOF)) fail(`eth_call did not revert InvalidProof(): ${JSON.stringify(sim.error ?? sim.result)}`);
  // InvalidProof() is also the portal's prevBlockHash error, so prove the revert came from the verifier.
  const tr = await rpcOk("debug_traceCall", [{ from: SEQ, to: PORTAL, data, gas: "0x1e8480" }, "latest", { tracer: "callTracer" }]);
  if (!verifierReverted(tr)) fail("traceCall: the revert did not come from the verifier call");
  writeFileSync(out, JSON.stringify({
    note: "Forged batch on OwnZonePortal: sequencer-signed certificate, replayed real proof of batch 56-61, made-up nextBlockHash and withdrawalQueueHash.",
    portal: PORTAL, from: SEQ, builtAtHead: Number(head), tempoBlockNumber: Number(tempoBlockNumber), anchorBlockHash,
    zoneHeight: Number(forged.zoneHeight), withdrawalBatchIndex: Number(state.withdrawalBatchIndex + 1n),
    prevBlockHash: forged.bt.prevBlockHash, nextBlockHash: forged.bt.nextBlockHash, withdrawalQueueHash: forged.withdrawalQueueHash,
    replayedProofFrom: wd.settlement.submitTx, settlementDigest: digest, signature, calldata: data,
    stateBefore: Object.fromEntries(Object.entries(state).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v])),
    ethCall: { revert: INVALID_PROOF, name: "InvalidProof()" },
  }, null, 2) + "\n");
  say(`built ${path.relative(process.cwd(), out)}: zone height ${state.zoneHeight} → ${forged.zoneHeight}, anchor ${tempoBlockNumber} (head ${head}), certificate signed by ${SEQ}`);
  say(`eth_call from the sequencer: reverts InvalidProof() (${INVALID_PROOF}); every earlier check passed. Valid for ~8,000 blocks (EIP-2935 window), so send soon.`);
}

function verifierReverted(c) {
  const v = (x) => (x.to && getAddress(x.to) === VERIFIER ? x : (x.calls ?? []).map(v).find(Boolean));
  const call = v(c);
  return Boolean(call && call.error && String(call.output ?? "").startsWith(INVALID_PROOF));
}

async function checkTx(file, hash) {
  const f = JSON.parse(readFileSync(file, "utf8"));
  const r = await rpcOk("eth_getTransactionReceipt", [hash]);
  if (!r) fail(`no receipt for ${hash}`);
  if (r.status !== "0x0") fail(`${hash} has status ${r.status}: the forged batch was NOT rejected`);
  if (getAddress(r.to) !== PORTAL || getAddress(r.from) !== SEQ) fail(`${hash} is not sequencer → portal`);
  const tr = await rpcOk("debug_traceTransaction", [hash, { tracer: "callTracer" }]);
  if (!verifierReverted(tr)) fail(`${hash}: the trace does not show the verifier reverting InvalidProof()`);
  const now = {};
  for (const k of Object.keys(f.stateBefore)) { const v = await view(k); now[k] = typeof v === "bigint" ? v.toString() : v; }
  for (const [k, v] of Object.entries(f.stateBefore)) if (String(now[k]).toLowerCase() !== String(v).toLowerCase()) fail(`${k} changed: ${v} → ${now[k]}`);
  const result = { tx: hash, block: parseInt(r.blockNumber, 16), status: 0, gasUsed: parseInt(r.gasUsed, 16), revert: "InvalidProof() from SwornZoneVerifier (trace)", stateAfterEqualsBefore: true, stateAfter: now };
  writeFileSync(file.replace(/\.json$/, "-result.json"), JSON.stringify(result, null, 2) + "\n");
  say(`tx ${hash} block ${result.block}: status 0, the verifier reverted InvalidProof(), gas ${result.gasUsed}`);
  say(`portal state unchanged: ${Object.entries(now).map(([k, v]) => `${k}=${String(v).length > 20 ? String(v).slice(0, 10) + "…" : v}`).join(", ")}`);
}

const [cmd, arg, arg2] = process.argv.slice(2);
if (cmd === "selfcheck") await selfcheck();
else if (cmd === "build") await build(path.resolve(arg ?? fail("build <out.json>")));
else if (cmd === "check-tx") await checkTx(path.resolve(arg ?? fail("check-tx <out.json> <tx>")), arg2 ?? fail("check-tx <out.json> <tx>"));
else fail("usage: forged-batch.mjs selfcheck | build <out.json> | check-tx <out.json> <tx>");
