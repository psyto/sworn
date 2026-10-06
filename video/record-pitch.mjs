// Records video/pitch.mp4 — Sworn's ≤ 2 min CWF pitch v5.4, six scenes, SILENT, 1920×1080 — and
// video/pitch.srt with the narration of video/PITCH.md timed to where each scene landed.
//
//   node video/record-pitch.mjs            # then: node video/split-scenes.mjs pitch
//   PREVIEW=<dir> node video/record-pitch.mjs   # one PNG per scene + all source checks; records nothing
//
// Scene holds come from PITCH.md (words ÷ 2.2 w/s, rounded up to 0.5 s; total ≤ 118 s). Every figure, quote
// and call result on screen is read now from the source PITCH.md's claims table names; a missing or changed
// source THROWS:
//   scene 1  tempoxyz/zones README @ ac49071f (via `gh api`): "private blockchains anchored to", the operator's
//            full visibility, users see only their own state; Tempo's docs page zones/proving.md (Nitro activated
//            by T13; the reference verifier returns true); docs/research/moderato-zone-feasibility-20261004.md
//            (outsiders cannot build a witness); the recorder's OWN eth_call to Moderato's 0x5A56… (code = tempo
//            ZONE_VERIFIER_RUNTIME, pre-T13 selector 0x7106a43e ≠ IVerifier's) with an equivalent malformed batch
//            = true; Tempo's ZoneFactory: nextZoneId, zones(1..n).verifier / admin / sequencers, owner() Safe.
//   scene 2  spec 003 §3 (public values), SwornZoneVerifier.sol (verify is view); the data-flow motif's digest chip
//            = the fixture's digest = the attest's ZoneBatchVerified digest.
//   scene 3  our own Zone (moderato.json OwnZone ↔ Moderato): portal.verifier() = the recorded verifier (codehash),
//            the three submitBatch receipts (to the portal, BatchSubmitted, blocks), the payout's WithdrawalProcessed
//            (user, pathUSD, 500000, after the last batch); the recorder's OWN two eth_calls to that verifier with the
//            call its portal made (from debug_traceTransaction): real = true, height+1 reverts InvalidProof().
//            Also still read (scene 2's digest chip):
//            deployments/moderato.json ↔ Moderato (SwornZoneVerifierWithdrawal codehash, the attest 0xa630… —
//            batch counts, withdrawalQueueHash = fixture = calldata — and its ZoneBatchVerified event); the
//            explorer page of the attest (cropped to its transaction card, no header); the proving log; the
//            recorder's OWN two eth_calls: verify(real) = true, verify(height+1) reverts InvalidProof().
//   scene 4  spec 003 §5 D2/D4, spec 004 (header, "Payouts wait for ZK.", §5 upgrades, §6 "not built"), README T12.
//   scene 5  vendored tempo/Cargo.toml (reth, revm), fabrknt.com/dojo (21 courses), ethglobal.com, README "Who".
//   scene 6  README status and limits, the factory reads above, GitHub (repo public).
// The narration is checked for the wording rules (no "the same input", "broken", "protects/secures
// withdrawals", "every batch", "our customers are").
// Reads only. No keys, no transactions.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseAbiItem, decodeEventLog, decodeFunctionData, getAddress, toEventSelector, toFunctionSelector, keccak256, encodeFunctionData } from "viem";
import {
  dir, repo, read, fail, log, rel, short, EXPLORER, RPC, parseScenes, rpc, call, receipt, fetchText, ghFile, ghRepoPublic,
  moderato, recordSlides, checkOverflow, writeSrt, writeJson, duration, sleep,
} from "./lib/rec.mjs";

const MAX_TOTAL = 118;
const scenes = parseScenes("video/PITCH.md");
if (scenes.length !== 6) fail(`PITCH.md has ${scenes.length} scenes, expected 6`);
const TOTAL = scenes.reduce((a, s) => a + s.hold, 0);
const WORDS = scenes.reduce((a, s) => a + s.words, 0);
log(`• pitch v5.4: scene holds (words ÷ 2.2 w/s, rounded up to 0.5 s)`);
for (const s of scenes) log(`    scene ${s.n}: ${String(s.words).padStart(3)} words → ${s.hold.toFixed(1)} s  (${s.title})`);
log(`    total ${TOTAL.toFixed(1)} s, ${WORDS} words`);
if (TOTAL > MAX_TOTAL) fail(`pitch runs ${TOTAL} s > ${MAX_TOTAL} s — cut words in PITCH.md`);
const narr = scenes.map((s) => s.text).join(" ");
for (const banned of [/the same input/i, /\bbroken\b/i, /protects? withdrawals/i, /secures? withdrawals/i, /every batch/i, /our customers are/i])
  if (banned.test(narr)) fail(`PITCH.md narration says ${banned}`);
for (const must of ["audit-ready evidence", "operator selects the batch", "go-to-market test", "market is not proven", "No customer claimed"])
  if (!narr.includes(must)) fail(`PITCH.md narration no longer says "${must}"`);

const ZONES_REF = "ac49071f";
const ZONES_DIR = "spikes/zone-spf/zones";
const flat = (s) => s.replace(/\s+/g, " ").trim();
const lc = (s) => s.toLowerCase();
const utc = (d) => d.toISOString().slice(11, 19);

// ── scene 1: who sees what, and today's check ────────────────────────────────────────────────────
const zonesReadme = flat(ghFile("tempoxyz/zones", "README.md", "tempoxyz/zones README", ZONES_REF));
const ZONES_LINE = "Zones are private blockchains anchored to";
const OP_Q = "The Zone operator maintains full visibility into state for compliance.";
const USER_Q = "only the authorized account holder can access balances and transaction history.";
for (const q of [ZONES_LINE, OP_Q, USER_Q]) if (!zonesReadme.includes(q)) fail(`tempoxyz/zones README @ ${ZONES_REF} no longer says "${q}"`);
const DOCS = "https://tempo.xyz/developers/docs/protocol/zones/proving.md";
const docs = flat(await fetchText(DOCS, "Tempo docs (zones/proving)"));
if (!/^# Tempo Zone proving and settlement/.test(docs)) fail(`${DOCS}: title changed`);
const STUB = "The Zones Solidity reference verifier still returns `true` without checking execution.";
const NITRO = "Tempo also implements a native Nitro attestation verifier activated by T13.";
for (const q of [STUB, NITRO]) if (!docs.includes(q)) fail(`${DOCS} no longer says "${q}"`);
const RESEARCH = "docs/research/moderato-zone-feasibility-20261004.md";
const OUTSIDER = "An outsider cannot build a `BatchWitness` for someone else's Zone.";
if (!flat(read(RESEARCH, "Moderato Zone research")).includes(OUTSIDER)) fail(`${RESEARCH} no longer says "${OUTSIDER}"`);

// Moderato's pre-T13 verifier, called now with an equivalent malformed batch (never "the same input").
const T = (name, components) => ({ name, type: "tuple", components });
const BT = T("blockTransition", [{ name: "prevBlockHash", type: "bytes32" }, { name: "nextBlockHash", type: "bytes32" }]);
const DQ = T("depositQueueTransition", [{ name: "prevProcessedHash", type: "bytes32" }, { name: "nextProcessedHash", type: "bytes32" }, { name: "prevDepositNumber", type: "uint64" }, { name: "nextDepositNumber", type: "uint64" }]);
const head5 = [{ name: "zoneId", type: "uint32" }, { name: "tempoBlockNumber", type: "uint64" }, { name: "anchorBlockNumber", type: "uint64" }, { name: "anchorBlockHash", type: "bytes32" }, { name: "expectedWithdrawalBatchIndex", type: "uint64" }];
const tail3 = [{ name: "withdrawalQueueHash", type: "bytes32" }, { name: "verifierConfig", type: "bytes" }, { name: "proof", type: "bytes" }];
const zoneInputs = [...head5, { name: "nextZoneHeight", type: "uint256" }, BT, DQ, T("tokenEnablementTransition", [{ name: "prevProcessedTokenCount", type: "uint64" }, { name: "nextProcessedTokenCount", type: "uint64" }]), ...tail3];
const verifyAbi = [{ type: "function", name: "verify", stateMutability: "view", inputs: zoneInputs, outputs: [{ name: "", type: "bool" }] }];
const preAbi = [{ type: "function", name: "verify", stateMutability: "pure", inputs: [...head5, BT, DQ, ...tail3], outputs: [{ name: "", type: "bool" }] }];
const PRE_SEL = toFunctionSelector(preAbi[0]);
const IV_SEL = toFunctionSelector(verifyAbi[0]);
if (PRE_SEL !== "0x7106a43e" || PRE_SEL === IV_SEL) fail(`pre-T13 selector ${PRE_SEL} (IVerifier ${IV_SEL})`);
const PRE = getAddress((read("tempo/crates/contracts/src/precompiles/zone_factory.rs", "zone_factory.rs").match(/ZONE_VERIFIER_ADDRESS: Address = address!\("(0x[0-9a-fA-F]{40})"\)/) ?? fail("zone_factory.rs: no ZONE_VERIFIER_ADDRESS"))[1]);
const FACTORY_ADDR = getAddress((read("tempo/crates/contracts/src/precompiles/zone_factory.rs", "zone_factory.rs").match(/ZONE_FACTORY_ADDRESS: Address = address!\("(0x[0-9a-fA-F]{40})"\)/) ?? fail("zone_factory.rs: no ZONE_FACTORY_ADDRESS"))[1]);
const zrs = read("tempo/crates/contracts/src/zones.rs", "tempo zones.rs");
const rtm = zrs.match(/pub const ZONE_VERIFIER_RUNTIME: Bytes = bytes!\(([\s\S]*?)\);/) ?? fail("zones.rs: no ZONE_VERIFIER_RUNTIME");
const RUNTIME = lc("0x" + [...rtm[1].matchAll(/"([^"]*)"/g)].map((x) => x[1].replace(/^0x/, "")).join(""));
if (!RUNTIME.includes(`63${PRE_SEL.slice(2)}`)) fail("ZONE_VERIFIER_RUNTIME does not dispatch 0x7106a43e");
if (lc(await rpc("eth_getCode", [PRE, "latest"])) !== RUNTIME) fail(`code at ${PRE} != tempo ZONE_VERIFIER_RUNTIME (Moderato's verifier changed — T13?)`);
async function rawCall(to, data) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }) });
  return res.json();
}
const Z32 = "0x" + "00".repeat(32);
const malformed = [99, 0n, 0n, Z32, 0n, { prevBlockHash: Z32, nextBlockHash: Z32 }, { prevProcessedHash: Z32, nextProcessedHash: Z32, prevDepositNumber: 0n, nextDepositNumber: 0n }, Z32, "0xdead", "0xbeef"];
const stubCall = await rawCall(PRE, encodeFunctionData({ abi: preAbi, functionName: "verify", args: malformed }));
const stubAt = new Date();
if (stubCall.error || BigInt(stubCall.result) !== 1n) fail(`eth_call Moderato pre-T13 verify(malformed) did not return true: ${JSON.stringify(stubCall.error ?? stubCall.result)}`);
log(`• Moderato ${short(PRE)} pre-T13 ${PRE_SEL} verify(zone 99, zeros, 0xdead, 0xbeef) = true at ${stubAt.toISOString()}`);

// Moderato's Zones today: how many, who runs them, which verifier.
const ZI = "zones(uint32 id) view returns ((uint32 zoneId,address portal,bool accessMode,bool gatewayMode,address admin,address[] sequencers,uint8 threshold,address verifier,string rpcUrl))";
const nextId = Number(await call(FACTORY_ADDR, "nextZoneId() view returns (uint32)"));
const nZones = nextId - 1;
if (nZones < 1) fail("ZoneFactory: no Zones on Moderato");
const zones = [];
for (let i = 1; i <= nZones; i++) zones.push(await call(FACTORY_ADDR, ZI, [i]));
const admin = getAddress(zones[0].admin);
const seqs = (z) => z.sequencers.map(getAddress).sort().join();
for (const z of zones) {
  if (getAddress(z.verifier) !== PRE) fail(`zone ${z.zoneId} verifier ${z.verifier} != ${PRE}`);
  if (getAddress(z.admin) !== admin || seqs(z) !== seqs(zones[0])) fail(`zone ${z.zoneId} has another admin or sequencer set — "one Zone operator" is no longer true`);
}
const fOwner = getAddress(await call(FACTORY_ADDR, "owner() view returns (address)"));
const safeOwners = (await call(fOwner, "getOwners() view returns (address[])")).map(getAddress);
const safeT = await call(fOwner, "getThreshold() view returns (uint256)");
if (safeOwners.length !== 1 || safeOwners[0] !== admin || safeT !== 1n) fail(`factory owner ${fOwner}: owners ${safeOwners} threshold ${safeT} — not a 1-of-1 Safe of the Zones' admin`);
log(`• ZoneFactory ${short(FACTORY_ADDR)}: ${nZones} Zones, one admin ${short(admin)} and one sequencer set, verifier ${short(PRE)}; owner ${short(fOwner)} = 1-of-1 Safe of that admin`);

// ── scene 2: what is public ──────────────────────────────────────────────────────────────────────
const spec3 = flat(read("docs/specs/003-zone-verifier.md", "spec 003"));
for (const s of ["**Public values** = `abi.encode(bytes32 ZONE_GUEST_VERSION, bytes32 digest)`", "**D2 no caller check:**", "`attest` moves nothing and stores nothing"])
  if (!spec3.includes(s)) fail(`spec 003 no longer says "${s}"`);
const zsol = read("contracts/src/SwornZoneVerifier.sol", "SwornZoneVerifier source");
const zstrip = zsol.replace(/\/\/[^\n]*/g, "");
const vdef = zstrip.slice(zstrip.lastIndexOf("function verify("));
if (!/^function verify\([^)]*\)\s*external\s+view\s+returns\s*\(bool\)/.test(vdef)) fail("SwornZoneVerifier.verify is no longer `external view returns (bool)`");

// ── scene 3: the Zone proof on Moderato ──────────────────────────────────────────────────────────
const M = await moderato();
const Z = M.dep.SwornZoneVerifierWithdrawal ?? fail("moderato.json: no SwornZoneVerifierWithdrawal");
const ZV = getAddress(Z.address);
if (keccak256(await rpc("eth_getCode", [ZV, "latest"])) !== Z.codehash) fail("SwornZoneVerifierWithdrawal codehash on chain != moderato.json");
if (!Z.attest.tx.startsWith("0xa63009fd")) fail(`withdrawal attest is ${Z.attest.tx}, expected 0xa630…`);
const zev = parseAbiItem(`event ${flat(zsol.match(/event (ZoneBatchVerified\([^)]*\));/)?.[1] ?? fail("no ZoneBatchVerified in SwornZoneVerifier.sol"))}`);
const atR = await receipt(Z.attest.tx, "attest");
const atBlock = parseInt(atR.blockNumber, 16);
if (atBlock !== Z.attest.block) fail(`attest block ${atBlock} != moderato.json ${Z.attest.block}`);
if (getAddress(atR.to) !== ZV) fail(`attest is to ${atR.to}, not ${ZV}`);
const atGas = parseInt(atR.gasUsed, 16);
if (atGas !== Z.attest.gasUsed) fail(`attest gas ${atGas} != moderato.json ${Z.attest.gasUsed}`);
const atLog = atR.logs.find((l) => getAddress(l.address) === ZV && l.topics[0] === toEventSelector(zev)) ?? fail("attest: no ZoneBatchVerified from SwornZoneVerifier");
const ev = decodeEventLog({ abi: [zev], data: atLog.data, topics: atLog.topics }).args;
const fx = JSON.parse(read(Z.attest.fixture, "zone fixture"));
if (lc(fx.digest) !== lc(ev.digest)) fail("attest digest != fixture digest");
if (lc(fx.verifier) !== lc(ZV)) fail(`fixture verifier ${fx.verifier} != deployed ${ZV}`);
const bm = Z.batch.match(/\(dev chain (\d+)\).*?(\d+) withdrawals?, (\d+) user transactions?, withdrawalQueueHash (0x[0-9a-f]+)…([0-9a-f]+)/) ?? fail(`moderato.json batch line changed: ${Z.batch}`);
const WQH = lc(fx.args.withdrawalQueueHash);
if (!WQH.startsWith(bm[4]) || !WQH.endsWith(bm[5]) || /^0x0+$/.test(WQH)) fail("withdrawalQueueHash: moderato.json / fixture disagree, or zero");
const atTx = await rpc("eth_getTransactionByHash", [Z.attest.tx]);
const atInput = lc(atTx.calls?.length === 1 ? atTx.calls[0].input : atTx.input);
if (!atInput.includes(WQH.slice(2))) fail("attest calldata does not carry the fixture's withdrawalQueueHash");
if (+bm[2] !== 1 || +bm[3] !== 2 || bm[1] !== "1337") fail(`batch: ${bm[2]} withdrawals, ${bm[3]} user txs, chain ${bm[1]}`);
log(`• attest ${short(Z.attest.tx)} block ${atBlock}: ZoneBatchVerified zone ${ev.zoneId} height ${ev.nextZoneHeight} digest ${short(ev.digest)}`);

// IVerifier.verify's selector, from the pinned zones checkout, = SwornZoneVerifier's = the recorder's ABI.
const head = execFileSync("git", ["-C", path.join(repo, ZONES_DIR), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!head.startsWith(ZONES_REF)) fail(`${ZONES_DIR} is at ${head}, not ${ZONES_REF}`);
function solSelector(src, what) {
  const strip = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const structs = {};
  for (const m of strip.matchAll(/struct (\w+)\s*\{([^}]*)\}/g)) structs[m[1]] = m[2].split(";").map((f) => f.trim().split(/\s+/)[0]).filter(Boolean);
  const body = (strip.match(/function verify\(([^)]*)\)/) ?? fail(`${what}: no verify(`))[1];
  const ty = (t) => (structs[t] ? `(${structs[t].map(ty).join(",")})` : t);
  return toFunctionSelector(`verify(${body.split(",").map((p) => ty(p.trim().split(/\s+/)[0])).join(",")})`);
}
const izone = read(`${ZONES_DIR}/crates/contracts/src/runtime/interfaces/IZone.sol`, "zones IZone.sol");
if (solSelector(izone, "IZone.sol") !== IV_SEL || solSelector(zsol, "SwornZoneVerifier.sol") !== IV_SEL) fail("verify selector: zones / Sworn / recorder disagree");

// Change one field: the recorder's own two eth_calls.
const a = fx.args;
const H = BigInt(a.nextZoneHeight);
if (H !== ev.nextZoneHeight) fail("fixture nextZoneHeight != event");
const fxArgs = (h) => [a.zoneId, BigInt(a.tempoBlockNumber), BigInt(a.anchorBlockNumber), a.anchorBlockHash, BigInt(a.expectedWithdrawalBatchIndex), h,
  { prevBlockHash: a.prevBlockHash, nextBlockHash: a.nextBlockHash },
  { prevProcessedHash: a.prevProcessedHash, nextProcessedHash: a.nextProcessedHash, prevDepositNumber: BigInt(a.prevDepositNumber), nextDepositNumber: BigInt(a.nextDepositNumber) },
  { prevProcessedTokenCount: BigInt(a.prevProcessedTokenCount), nextProcessedTokenCount: BigInt(a.nextProcessedTokenCount) },
  a.withdrawalQueueHash, fx.verifierConfig, fx.proof];
const okCall = await rawCall(ZV, encodeFunctionData({ abi: verifyAbi, functionName: "verify", args: fxArgs(H) }));
if (okCall.error || BigInt(okCall.result) !== 1n) fail(`eth_call verify(real) did not return true: ${JSON.stringify(okCall.error ?? okCall.result)}`);
const badCall = await rawCall(ZV, encodeFunctionData({ abi: verifyAbi, functionName: "verify", args: fxArgs(H + 1n) }));
const callAt = new Date();
if (!/error InvalidProof\(\);/.test(zsol)) fail("SwornZoneVerifier.sol declares no InvalidProof()");
if (!badCall.error || !String(badCall.error.data ?? "").startsWith(toFunctionSelector("InvalidProof()"))) fail(`eth_call verify(height+1) did not revert InvalidProof(): ${JSON.stringify(badCall)}`);
log(`• our eth_calls at ${callAt.toISOString()}: verify(height ${H}) = true; verify(height ${H + 1n}) reverts InvalidProof()`);

const plog = read(Z.attest.proving.log, "Zone proving log");
const cycles = +(plog.match(/cycles\(total_instruction_count\): (\d+)/) ?? fail("proving log: no cycle count"))[1];
const wall = +(plog.match(/PROVE groth16 wall: ([\d.]+)s/) ?? fail("proving log: no groth16 wall time"))[1];
if (cycles !== Z.attest.proving.cycles) fail(`proving log cycles ${cycles} != moderato.json`);
if (Math.abs(wall - Z.attest.proving.groth16WallSecs) > 0.5) fail(`proving log Groth16 ${wall} s != moderato.json ${Z.attest.proving.groth16WallSecs}`);

// Our own Zone (2026-10-06): the portal calls the recorded verifier; three submitBatch receipts settled through it;
// the payout's WithdrawalProcessed is the user's 500000 pathUSD; and the withdrawal batch's verifier call, taken
// from its submitBatch trace, is verified now and rejected with one field changed.
const OZ = M.dep.OwnZone ?? fail("moderato.json: no OwnZone");
const PORTAL = getAddress(OZ.OwnZonePortal.address), OZV = getAddress(OZ.SwornZoneVerifier.address);
if (getAddress(await call(PORTAL, "verifier() view returns (address)")) !== OZV) fail(`portal ${PORTAL} does not call ${OZV}`);
if (keccak256(await rpc("eth_getCode", [OZV, "latest"])) !== OZ.SwornZoneVerifier.codehash) fail("own-Zone verifier codehash != moderato.json");
const BATCH_TOPIC = toEventSelector("BatchSubmitted(uint64,uint256,bytes32,bytes32,bytes32,uint64,uint64)");
const ages = [];
for (const b of OZ.batches) {
  const r = await receipt(b.submitTx, `submitBatch ${b.zoneBlocks}`);
  if (getAddress(r.to) !== PORTAL) fail(`submitBatch ${b.submitTx} is to ${r.to}, not the portal`);
  if (!r.logs.some((l) => getAddress(l.address) === PORTAL && l.topics[0] === BATCH_TOPIC)) fail(`submitBatch ${b.submitTx}: no BatchSubmitted`);
  const blk = parseInt(r.blockNumber, 16);
  if (blk !== b.submitBlock) fail(`submitBatch ${b.submitTx} block ${blk} != moderato.json ${b.submitBlock}`);
  ages.push(blk - b.anchor);
}
const wpEv = parseAbiItem("event WithdrawalProcessed(address indexed to, bytes32 indexed senderTag, address token, uint128 amount, bool callbackSuccess)");
const payR = await receipt(OZ.payout.tx, "payout");
const payLog = payR.logs.find((l) => getAddress(l.address) === PORTAL && l.topics[0] === toEventSelector(wpEv)) ?? fail("payout: no WithdrawalProcessed from the portal");
const pay = decodeEventLog({ abi: [wpEv], data: payLog.data, topics: payLog.topics }).args;
if (getAddress(pay.to) !== getAddress(OZ.roles.user) || pay.amount !== BigInt(OZ.payout.userPathUSD.delta) || getAddress(pay.token) !== getAddress("0x20C0000000000000000000000000000000000000"))
  fail(`payout: ${pay.to} ${pay.token} ${pay.amount} is not the user's 500000 pathUSD`);
if (parseInt(payR.blockNumber, 16) <= OZ.batches.at(-1).submitBlock) fail("payout is not after the last settled batch");
const wdBatch = OZ.batches.at(-1);
const trace = await rpc("debug_traceTransaction", [wdBatch.submitTx, { tracer: "callTracer" }]);
const findCall = (c) => (c.to && getAddress(c.to) === OZV ? c : (c.calls ?? []).map(findCall).find(Boolean));
const vcall = findCall(trace) ?? fail(`${wdBatch.submitTx}: the portal did not call ${OZV}`);
if (vcall.input.slice(0, 10) !== IV_SEL) fail(`own-Zone verifier call selector ${vcall.input.slice(0, 10)} != IVerifier ${IV_SEL}`);
const { args: ozArgs } = decodeFunctionData({ abi: verifyAbi, data: vcall.input });
const ozH = ozArgs[5];
const ozOk = await rawCall(OZV, vcall.input);
if (ozOk.error || BigInt(ozOk.result) !== 1n) fail(`eth_call own-Zone verify(real) did not return true: ${JSON.stringify(ozOk.error ?? ozOk.result)}`);
const ozMut = [...ozArgs]; ozMut[5] = ozH + 1n;
const ozBad = await rawCall(OZV, encodeFunctionData({ abi: verifyAbi, functionName: "verify", args: ozMut }));
const ozAt = new Date();
if (!ozBad.error || !String(ozBad.error.data ?? "").startsWith(toFunctionSelector("InvalidProof()"))) fail(`eth_call own-Zone verify(height+1) did not revert InvalidProof(): ${JSON.stringify(ozBad)}`);
log(`• own Zone: portal ${short(PORTAL)} → ${short(OZV)}; ${OZ.batches.length} batches settled (anchor ages ${ages.join(" / ")}); payout ${short(OZ.payout.tx)} ${pay.amount} to ${short(pay.to)}; verify(height ${ozH}) = true, (height ${ozH + 1n}) reverts InvalidProof() at ${ozAt.toISOString()}`);

// The explorer, captured now, cropped to its transaction card (the site header carries Tempo's wordmark).
const exUrl = `${EXPLORER}/tx/${Z.attest.tx}`;
const topic0 = toEventSelector(zev);
async function explorerShot() {
  const { default: puppeteer } = await import("puppeteer");
  const br = await puppeteer.launch({ headless: true, timeout: 180000, args: ["--no-sandbox", "--hide-scrollbars"], defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 2 } });
  try {
    const p = await br.newPage();
    await p.emulateTimezone("UTC");
    await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
    await p.goto(`${exUrl}?tab=events`, { waitUntil: "networkidle2", timeout: 120000 });
    await p.waitForFunction((t) => document.body.innerText.includes("Success") && document.body.innerText.toLowerCase().includes(t), { timeout: 90000 }, lc(topic0));
    const text = lc(await p.evaluate(() => document.body.innerText));
    for (const want of [Z.attest.tx, String(atBlock), "success", topic0, ZV]) if (!text.includes(lc(want))) fail(`explorer page does not show ${want}`);
    for (let i = 0; i < 3; i++) {
      const t = await p.evaluate(() => document.querySelector('button[title^="Showing "][title$="click to change"]')?.title ?? null);
      if (!t || !/relative/i.test(t)) break;
      await p.click('button[title^="Showing "][title$="click to change"]');
      await sleep(500);
    }
    const clip = await p.evaluate(() => {
      const leaves = [...document.querySelectorAll("body *")].filter((e) => e.children.length === 0);
      const leaf = (t) => leaves.find((e) => e.textContent.trim() === t);
      const st = leaf("Status"), to = leaf("To");
      let card = st;
      while (card && !(card.innerText.includes("Hash") && card.innerText.includes("Receipt"))) card = card.parentElement;
      if (!card || !to) return null;
      const c = card.getBoundingClientRect(), s = st.getBoundingClientRect(), t = to.getBoundingClientRect();
      return { x: c.left, y: s.top - 22, width: c.width, height: t.bottom + 20 - (s.top - 22) };
    });
    if (!clip) fail("explorer: transaction card not found");
    const png = await p.screenshot({ clip, encoding: "base64" });
    return { png: `data:image/png;base64,${png}`, w: clip.width, h: clip.height };
  } finally { await br.close(); }
}
const shot = await explorerShot();
log(`• explorer: ${short(Z.attest.tx)} Success, block ${atBlock}, topic0 ${short(topic0)} on its Events tab; card ${Math.round(shot.w)}×${Math.round(shot.h)}`);

// ── scene 4: the route ───────────────────────────────────────────────────────────────────────────
const spec4 = flat(read("docs/specs/004-tee-plus-zk.md", "spec 004"));
for (const s of ["A proposal for Tempo, not something Sworn can deploy.", "Payouts wait for ZK.", "each hardfork that changes Zone execution needs a new guest and vkey", "on time, on an SLA"])
  if (!spec4.includes(s)) fail(`spec 004 no longer says "${s}"`);
const s6 = read("docs/specs/004-tee-plus-zk.md", "spec 004").split("## 6. Status")[1]?.split("\n## ")[0] ?? fail("spec 004: no §6 Status");
const notBuilt = (s6.match(/\| not built/g) ?? []).length;
if (notBuilt < 5 || /\|\s*\*\*built\*\*/.test(s6)) fail(`spec 004 §6: ${notBuilt} rows "not built" (expected ≥ 5, none built)`);
const readme = read("README.md", "README");
const t12 = readme.match(/T12, activates at (\d{4}-\d\d-\d\d \d\d:\d\d UTC)/) ?? fail("README: no T12 activation date");

// ── scene 5: why me ──────────────────────────────────────────────────────────────────────────────
const cargo = read("tempo/Cargo.toml", "vendored tempo Cargo.toml");
if (!/^reth-[\w-]+ = \{ git = "https:\/\/github\.com\/paradigmxyz\/reth"/m.test(cargo) || !/^revm = \{ version = "([\d.]+)"/m.test(cargo)) fail("tempo/Cargo.toml no longer depends on paradigmxyz/reth and revm");
const revmV = cargo.match(/^revm = \{ version = "([\d.]+)"/m)[1];
const DOJO = "https://fabrknt.com/dojo";
const dojo = flat(await fetchText(DOJO, "Fabrknt Dojo"));
if (!/21 courses/.test(dojo) || !/Reth/.test(dojo)) fail(`${DOJO}: no longer says "21 courses" on Reth`);
const EG = "https://ethglobal.com/showcase/reckn-47t6m";
const eg = (await fetchText(EG, "ETHGlobal showcase")).replace(/<!-- -->/g, "");
const prize = eg.match(/<h4[^>]*>\s*(Uniswap Foundation)\s*-\s*(.*?)\s*(3rd place)\s*<\/h4>/) ?? fail(`${EG}: no "Uniswap Foundation … 3rd place" prize`);
if (!/ETHGlobal Tokyo 2026/.test(eg)) fail(`${EG}: does not say ETHGlobal Tokyo 2026`);
const BANK = "15 years building banking systems in Japan";
if (!flat(readme).includes(BANK)) fail(`README "Who" no longer says "${BANK}"`);

// ── scene 6: limits ──────────────────────────────────────────────────────────────────────────────
for (const s of ["## What the Zone verifier is, and is not", "**Our own Zone, not a Tempo-created one.**", "**Tempo's own Zones are unchanged.**", "Tempo's zones integration tests", "Unaudited.", "no customers, revenue, design partner or payer agreement", "It does not secure withdrawals on Tempo's Zones"])
  if (!flat(readme).includes(flat(s))) fail(`README no longer says "${s}"`);
const repoUrl = ghRepoPublic("psyto/sworn", "repo");
log(`• README limits present; ${repoUrl} public; ETHGlobal: ${prize[1]} ${prize[3]}; tempo: reth + revm ${revmV}`);

const data = {
  scenes: ["p1", "p2", "p3", "p4", "p5", "p6"],
  // 1
  zonesLine: "Tempo Zones: private blockchains on Tempo.",
  opQuote: OP_Q, userQuote: USER_Q.replace(/^only/, "Only"),
  zonesSrc: `tempoxyz/zones README @ ${ZONES_REF}: “${ZONES_LINE} Tempo” · GitHub API, read while recording`,
  outsiderSrc: `${RESEARCH} §2: an outsider cannot build a Zone's batch witness; the Zone RPC needs an operator credential`,
  nitroQuote: NITRO, docsSrc: `Tempo's docs · ${DOCS.replace(/^https:\/\//, "").replace(/\.md$/, "")} · read while recording`,
  stubWhen: `Moderato, pre-T13 · called ${utc(stubAt)} UTC`,
  stubCall: `${short(PRE)}.verify(…) with an equivalent malformed batch: zone 99, every hash 0x00…00, config 0xdead, proof 0xbeef → true`,
  stubSrc: `eth_call, read-only · selector ${PRE_SEL} (pre-T13, 10 arguments) · the verifier of all ${nZones} Zones on Moderato (Tempo's Zone factory, read now)`,
  // 2 — the motif's digest chip: the fixture's digest, = the attest event's (checked in scene 3's reads)
  digest: short(fx.digest),
  pubSrc: "spec 003 §3: the proof's public values are a guest version and one digest of these fields · SwornZoneVerifier.verify(…) is a view function: any address can call it",
  // 3
  cycles: cycles.toLocaleString("en-US"), groth16: `${Math.round(wall)} s`,
  proveSrc: `Tempo's zone_spf::prove_zone_batch @ ${ZONES_REF} in SP1 · ${cycles.toLocaleString("en-US")} cycles · Groth16 proof in ${Math.round(wall)} s, locally`,
  batchFrom: `a test batch from Tempo's zones integration tests · dev chain ${bm[1]}`,
  atStatus: "✓ status 1 · ZoneBatchVerified emitted", atTx: short(Z.attest.tx, 8),
  atBlock: `${atBlock.toLocaleString("en-US")} · ${atGas.toLocaleString("en-US")} gas`,
  batchLine: `${bm[2]} withdrawal · ${bm[3]} user transactions`,
  atTo: `SwornZoneVerifier ${short(ZV, 6)}`,
  exUrl: `explore.testnet.tempo.xyz/tx/${short(Z.attest.tx)}`, exShot: shot.png,
  exNote: `captured while recording · its Events tab: topic0 ${short(topic0, 6)} = ZoneBatchVerified`,
  settled: String(OZ.batches.length),
  paid: `${(Number(pay.amount) / 1e6).toFixed(1)} pathUSD`,
  anchorAge: `${Math.max(...ages).toLocaleString("en-US")} of 8,190 blocks`,
  settleSrc: `our own Zone ${OZ.zoneId} · portal ${short(PORTAL, 6)} → SwornZoneVerifier ${short(OZV, 6)} → SP1 · submitBatch ${OZ.batches.map((b) => short(b.submitTx)).join(", ")} · payout ${short(OZ.payout.tx)} · read now from Moderato`,
  callRealWhat: `the withdrawal batch, zone blocks ${wdBatch.zoneBlocks}`,
  callReal: "✓ verify(…) → true",
  callBadWhat: `one field changed: height ${ozH} → ${ozH + 1n}`,
  callBad: "✗ rejected: reverts InvalidProof()",
  callSrc: `eth_call, read-only, to our Zone's verifier ${short(OZV, 6)}, with the call its portal made in ${short(wdBatch.submitTx)} · called ${utc(ozAt)} UTC`,
  // 4
  nearSrc: "On Tempo's own Zones, checked off to the side: their portals do not call this contract and it stores nothing (spec 003 §5 D2, D4). Only our own Zone settles through it.",
  laterSrc: `spec 004: “A proposal for Tempo, not something Sworn can deploy.” · “Payouts wait for ZK.” · §6: ${notBuilt} parts, not built`,
  serviceSrc: `spec 004 §5: each hardfork that changes Zone execution needs a new guest and vkey · next Tempo upgrade: T12 on Moderato, ${t12[1]}`,
  // 5
  stackSrc: `Tempo's own Cargo.toml: reth from github.com/paradigmxyz/reth · revm ${revmV}`,
  rethlab: `Fabrknt Dojo: 21 source-grounded courses on Rust, Reth, Revm, Alloy · ${DOJO}`,
  ethglobal: `ETHGlobal Tokyo 2026: ${prize[1]}, ${prize[3]}`,
  ethglobalSrc: `with Reckn · ${prize[2].trim()} · ${EG.replace(/^https:\/\//, "")}`,
  banking: BANK, bankingSrc: "README “Who” · read while recording",
  // 6
  limitsSrc: "README: “What the Zone verifier is, and is not” · Moderato testnet only, unaudited, no customers/revenue/design partner/payer agreement",
  operatorSrc: `Tempo's Zone factory on Moderato, read now: ${nZones} Zones, one admin and one sequencer set; the factory's owner is a 1-of-1 Safe with that same signer`,
  repo: repoUrl,
};

// ── layout check, then record ────────────────────────────────────────────────────────────────────
if (process.env.PREVIEW) {
  const { launch, fontsReady } = await import("./lib/rec.mjs");
  const { mkdirSync } = await import("node:fs");
  const outDir = path.resolve(process.env.PREVIEW);
  mkdirSync(outDir, { recursive: true });
  const br = await launch();
  try {
    const page = await br.newPage();
    await page.goto("file://" + path.join(dir, "pitch.html"), { waitUntil: "load" });
    await page.evaluate((d) => window.__fill(d), data);
    await fontsReady(page);
    for (const id of data.scenes) {
      const bad = await page.evaluate((x) => window.__overflow(x), id);
      if (bad.length) log(`  #${id}: ${bad.join("; ")}`);
      await page.screenshot({ path: path.join(outDir, `${id}.png`) });
    }
  } finally { await br.close(); }
  log(`• preview PNGs in ${outDir}`);
  process.exit(0);
}
await checkOverflow("pitch.html", data, data.scenes);
log("• layout: nothing outside its card or the frame");
const out = path.join(dir, "pitch.mp4");
const marks = await recordSlides({ html: "pitch.html", data, ids: data.scenes, holds: scenes.map((s) => s.hold), raw: path.join(dir, "pitch.raw.mp4"), out });
const got = duration(out);
if (Math.abs(got - TOTAL) > 0.1) fail(`pitch.mp4 is ${got} s, expected ${TOTAL} s`);
if (got > MAX_TOTAL + 0.05) fail(`pitch.mp4 is ${got} s > ${MAX_TOTAL} s`);
const starts = scenes.reduce((acc, s) => [...acc, acc.at(-1) + s.hold], [0]);
const cues = writeSrt(scenes, starts, path.join(dir, "pitch.srt"));
const ffmpeg = process.env.FFMPEG_PATH || "/opt/homebrew/bin/ffmpeg";
for (let i = 0; i < 6; i++) execFileSync(ffmpeg, ["-v", "error", "-ss", (starts[i + 1] - 0.2).toFixed(2), "-i", out, "-frames:v", "1", path.join(dir, "frames", `pitch-scene${i + 1}.png`), "-y"]);
writeJson(path.join(dir, "pitch.marks.json"), {
  name: "pitch", script: "video/PITCH.md", version: "5.4", holds: scenes.map((s) => s.hold), titles: scenes.map((s) => s.title),
  words: scenes.map((s) => s.words), totalWords: WORDS,
  liveCalls: { moderatoPreT13Malformed: "true", moderatoPreT13At: stubAt.toISOString(), swornReal: "true", swornMutated: "InvalidProof()", swornAt: callAt.toISOString(), preT13Selector: PRE_SEL },
  moderatoZones: { count: nZones, admin, factoryOwner: fOwner, safeOwners, safeThreshold: Number(safeT) },
  zoneAttest: Z.attest.tx,
  ownZone: { portal: PORTAL, verifier: OZV, settled: OZ.batches.map((b) => b.submitTx), anchorAges: ages, payout: OZ.payout.tx, verifyReal: "true", verifyMutated: "InvalidProof()", at: ozAt.toISOString() },
  recorderMarks: marks.map((m) => +m.toFixed(3)), recordedAt: new Date().toISOString(),
});
log(`\n✓ ${rel(out)}  (${got.toFixed(2)} s, holds ${scenes.map((s) => s.hold).join(" / ")}, ${WORDS} words)`);
log(`✓ video/pitch.srt  (${cues} cues) · video/pitch.marks.json · video/frames/pitch-scene{1..6}.png`);
log(`  next: node video/split-scenes.mjs pitch`);
