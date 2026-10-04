// Records video/demo.mp4 — Sworn's ≤ 3 min CWF demo v2.1, six scenes, SILENT, 1920×1080 — plus video/demo.srt
// and video/demo.marks.json, from the edit plan video/DEMO.md (v2.1: Moderato's prototype verifier, then
// Sworn on the Zone batch with a withdrawal, the disclosure, bonded answers, next).
//
//   DEMO_PAGE_URL=http://localhost:4173/ node video/record-demo.mjs   # then: node video/split-scenes.mjs demo
//   PREVIEW=<dir> node video/record-demo.mjs   # one PNG per authored slide + all source checks; records nothing
//
// Reads only. No keys, no transactions: the page makes eth_call / receipt reads, this script makes eth_call /
// eth_getCode / receipts. Scene lengths: max(DEMO.md's "≈ N s" target, words ÷ 2.2 w/s rounded up to 0.5 s).
// Every figure on screen is read now from the source DEMO.md's claims table names; a missing or changed
// source THROWS:
//   scene 1  zones @ ac49071f ZonePortal.sol: submitBatch → verify → revert InvalidProof → enqueue withdrawals;
//            processWithdrawals → dequeue (line numbers read, order checked).
//   scenes 2–3  the page (DEMO_PAGE_URL), recorded in a real browser. Before recording, the recorder makes
//            its own three eth_calls: Sworn verify(real) = true, Sworn verify(height+1) reverts InvalidProof(),
//            and Moderato's 0x5A56… (code = tempo ZONE_VERIFIER_RUNTIME, pre-T13 selector 0x7106a43e, which
//            must differ from IVerifier.verify's) with the malformed batch = true. Every value the page shows
//            (attest 0xa630, block, gas, contract, decoded event, batch contents, ✓ lines, immutables, codehash,
//            all three rows, the comparison line, the disclosures) is compared with those reads,
//            deployments/moderato.json and the fixture. "Verify again" is clicked twice; each click must
//            change "Called at". The superseded verifier must appear nowhere. Explorer of 0xa630, cropped.
//   scene 4  deployments/moderato.json SwornZoneVerifierWithdrawal (batch, deviations), README, spec 004.
//   scene 5  the live take video/takes/demo-20261003T131156Z (take.json ↔ demoLiveTake ↔ Moderato), as in v2.
//   scene 6  (v2.2: the pitch v3.2 route) spec 004 (header, §6 "not built"), zone_factory, Tempo's ZoneFactory on Moderato
//            (one admin, 1-of-1 Safe owner), README limits, the repo (public), the page (HTTP 200).
// v2 (four scenes, hardfork batch) is in git: HEAD:video/record-demo.mjs before v2.1.
import path from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  parseAbiItem, parseAbi, decodeEventLog, getAddress, formatUnits, toEventSelector, toFunctionSelector, keccak256,
  encodeFunctionData,
} from "viem";
import {
  dir, repo, read, fail, log, rel, short, sleep, RPC, EXPLORER, FFMPEG, parseScenes, rpc, call, receipt, fetchText,
  ghRepoPublic, moderato, launch, newRecorder, recordSlides, checkOverflow, fontsReady, writeSrt, writeJson,
  duration, concat,
} from "./lib/rec.mjs";

const MAX_TOTAL = 180;
const PUBLISHED = "https://psyto.github.io/sworn/";
const PAGE = process.env.DEMO_PAGE_URL || PUBLISHED;
const TAKE = "video/takes/demo-20261003T131156Z";
const work = path.join(dir, "takes", "demo-v2"); // intermediates (gitignored)
mkdirSync(work, { recursive: true });

// ── the script ───────────────────────────────────────────────────────────────────────────────────
const scenes = parseScenes("video/DEMO.md");
if (scenes.length !== 6) fail(`DEMO.md has ${scenes.length} scenes, expected 6 (v2.1)`);
const md = read("video/DEMO.md", "DEMO.md");
const targets = [...md.matchAll(/^## Scene (\d+) — .*· ≈ (\d+(?:\.\d+)?) s\s*$/gm)].map((m) => +m[2]);
if (targets.length !== 6) fail("DEMO.md: every scene heading needs its \"≈ N s\" target");
const holds = scenes.map((s, i) => Math.max(s.hold, targets[i]));
const TOTAL = holds.reduce((a, b) => a + b, 0);
const words = scenes.reduce((a, s) => a + s.words, 0);
log(`• demo v2.2: scene lengths = max(target, words ÷ 2.2)`);
for (const [i, s] of scenes.entries()) log(`    scene ${s.n}: ${String(s.words).padStart(3)} words (${s.hold} s of voice) → ${holds[i]} s  (${s.title})`);
log(`    total ${TOTAL} s, ${words} words`);
if (words > 330) fail(`DEMO.md narration is ${words} words > the plan's hard cap 330`);
if (TOTAL > MAX_TOTAL) fail(`demo runs ${TOTAL} s > ${MAX_TOTAL} s`);
const narr = scenes.map((s) => s.text).join(" ");
for (const banned of [/the same input/i, /\bbroken\b/i, /secures? withdrawals/i, /protects withdrawals(?! yet)/i, /every batch/i, /our customers are/i])
  if (banned.test(narr)) fail(`DEMO.md narration says ${banned}`);
// Scene 2 is page; scene 3 is page (A) + explorer + page (C).
const S3 = { pageA: 14, explorer: 8 };
S3.pageC = holds[2] - S3.pageA - S3.explorer;
if (S3.pageC < 10) fail(`scene 3 leaves only ${S3.pageC} s for the rows`);
const IDLE = 6; // seconds of page recording cut out where the explorer insert goes (the page scrolls there)

const flat = (s) => s.replace(/\s+/g, " ").trim();
const fmt2 = (v, d) => { const [i, f = ""] = formatUnits(v, d).split("."); return `${i}.${(f + "00").slice(0, 2)}`; };
const lc = (s) => s.toLowerCase();

// ── scene 1: Tempo's portal code ─────────────────────────────────────────────────────────────────
const ZONES_DIR = "spikes/zone-spf/zones";
const ZONES_REF = "ac49071f";
const zhead = execFileSync("git", ["-C", path.join(repo, ZONES_DIR), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!zhead.startsWith(ZONES_REF)) fail(`${ZONES_DIR} is at ${zhead}, not ${ZONES_REF}`);
const PORTAL = `${ZONES_DIR}/crates/contracts/src/runtime/tempo/ZonePortal.sol`;
const pl = read(PORTAL, "ZonePortal.sol").split("\n");
const find = (re, from = 0, what = String(re)) => { const i = pl.findIndex((l, j) => j >= from && re.test(l)); if (i < 0) fail(`${PORTAL}: no ${what}`); return i; };
const iSubmit = find(/function submitBatch\(/);
const iVerify = find(/bool valid = IVerifier\(verifier\)/, iSubmit);
const iRevert = find(/if \(!valid\) revert InvalidProof\(\);/, iVerify);
const iEnq = find(/_withdrawalQueue\.enqueue\(withdrawalQueueHash\)/, iRevert);
const iProc = find(/function processWithdrawals\(/);
const iDeq = find(/_withdrawalQueue\.dequeue\(withdrawal, remainingQueue\)/, iProc);
if (!(iSubmit < iVerify && iVerify < iRevert && iRevert < iEnq && iEnq - iSubmit < 200)) fail(`${PORTAL}: submitBatch order changed`);
const ln = (i) => `${String(i + 1).padStart(4)}  ${pl[i].trim()}`;
const portalLines = [
  "submitBatch: the check, then the batch's withdrawals are queued",
  ln(iSubmit), ln(iVerify), ln(iRevert), ln(iEnq),
  "processWithdrawals: the payout reads that queue",
  ln(iProc), ln(iDeq),
].join("\n");
log(`• ${PORTAL}: submitBatch :${iSubmit + 1} → verify :${iVerify + 1} → revert :${iRevert + 1} → enqueue :${iEnq + 1}; processWithdrawals :${iProc + 1} → dequeue :${iDeq + 1}`);

// ── chain facts: the Zone batch with a withdrawal ────────────────────────────────────────────────
const M = await moderato();
const Z = M.dep.SwornZoneVerifierWithdrawal ?? fail("moderato.json: no SwornZoneVerifierWithdrawal");
const HF = M.dep.SwornZoneVerifier ?? fail("moderato.json: no SwornZoneVerifier");
const OLD = M.dep.SwornZoneVerifierSuperseded ?? fail("moderato.json: no SwornZoneVerifierSuperseded");
const ZV = getAddress(Z.address);
if (keccak256(await rpc("eth_getCode", [ZV, "latest"])) !== Z.codehash) fail("SwornZoneVerifierWithdrawal codehash on chain != moderato.json");
const staleNeedles = [OLD.address, OLD.attest.tx, short(OLD.address), short(OLD.attest.tx), short(OLD.address, 6), OLD.address.slice(0, 10), OLD.attest.tx.slice(0, 10)].map(lc);
const assertFresh = (text, where) => { for (const n of staleNeedles) if (lc(text).includes(n)) fail(`${where} shows the SUPERSEDED verifier/attest (${n})`); };
assertFresh(md, "video/DEMO.md");

const zsol = read("contracts/src/SwornZoneVerifier.sol", "SwornZoneVerifier source");
const zev = parseAbiItem(`event ${flat(zsol.match(/event (ZoneBatchVerified\([^)]*\));/)?.[1] ?? fail("no ZoneBatchVerified in SwornZoneVerifier.sol"))}`);
if (!/error InvalidProof\(\);/.test(zsol)) fail("SwornZoneVerifier.sol declares no InvalidProof()");
const atR = await receipt(Z.attest.tx, "attest");
const atBlock = parseInt(atR.blockNumber, 16);
if (atBlock !== Z.attest.block) fail(`attest block ${atBlock} != moderato.json ${Z.attest.block}`);
if (getAddress(atR.to) !== ZV) fail(`attest tx is to ${atR.to}, not SwornZoneVerifierWithdrawal ${ZV}`);
const topic0 = toEventSelector(zev);
const atLog = atR.logs.find((l) => getAddress(l.address) === ZV && l.topics[0] === topic0) ?? fail("attest: no ZoneBatchVerified from SwornZoneVerifierWithdrawal");
const ev = decodeEventLog({ abi: [zev], data: atLog.data, topics: atLog.topics }).args;
const fx = JSON.parse(read(Z.attest.fixture, "zone fixture"));
if (lc(fx.digest) !== lc(ev.digest)) fail("attest digest != fixture digest");
if (lc(fx.verifier) !== lc(ZV)) fail(`fixture verifier ${fx.verifier} != deployed ${ZV}`);
const atGas = parseInt(atR.gasUsed, 16);
if (atGas !== Z.attest.gasUsed) fail(`attest gas ${atGas} != moderato.json ${Z.attest.gasUsed}`);
// batch contents: counts from moderato.json's record, its withdrawalQueueHash prefix/suffix = fixture, non-zero
const bm = Z.batch.match(/integration test (\S+) \(dev chain (\d+)\).*?(\d+) withdrawals?, (\d+) user transactions?, withdrawalQueueHash (0x[0-9a-f]+)…([0-9a-f]+)/) ?? fail(`moderato.json batch line changed: ${Z.batch}`);
const [, ITEST, DEVCHAIN, NW, NU, wqA, wqB] = bm;
const WQH = lc(fx.args.withdrawalQueueHash);
if (!WQH.startsWith(wqA) || !WQH.endsWith(wqB)) fail("moderato.json withdrawalQueueHash disagrees with the fixture");
if (/^0x0+$/.test(WQH)) fail("fixture withdrawalQueueHash is zero");
if (+NW !== 1 || +NU !== 2 || DEVCHAIN !== "1337") fail(`batch is ${NW} withdrawals / ${NU} user txs / chain ${DEVCHAIN}; DEMO.md says 1 / 2 / 1337`);
const atTx = await rpc("eth_getTransactionByHash", [Z.attest.tx]);
const atInput = atTx.calls?.length === 1 ? atTx.calls[0].input : atTx.input;
if (!lc(atInput).includes(WQH.slice(2))) fail("attest calldata does not carry the fixture's withdrawalQueueHash");
log(`• attest ${short(Z.attest.tx)} block ${atBlock} → ${short(ZV)}: zone ${ev.zoneId} height ${ev.nextZoneHeight}; batch ${NW} withdrawal, ${NU} user txs, wqh ${short(WQH)} (${ITEST}, chain ${DEVCHAIN})`);
// the secondary line still reads
const hfR = await receipt(HF.attest.tx, "hardfork attest");
if (!hfR.logs.some((l) => getAddress(l.address) === getAddress(HF.address) && l.topics[0] === topic0)) fail("hardfork attest: no ZoneBatchVerified");

// ── the three live eth_calls ─────────────────────────────────────────────────────────────────────
const T = (name, components) => ({ name, type: "tuple", components });
const BT = T("blockTransition", [{ name: "prevBlockHash", type: "bytes32" }, { name: "nextBlockHash", type: "bytes32" }]);
const DQ = T("depositQueueTransition", [{ name: "prevProcessedHash", type: "bytes32" }, { name: "nextProcessedHash", type: "bytes32" }, { name: "prevDepositNumber", type: "uint64" }, { name: "nextDepositNumber", type: "uint64" }]);
const head5 = [{ name: "zoneId", type: "uint32" }, { name: "tempoBlockNumber", type: "uint64" }, { name: "anchorBlockNumber", type: "uint64" }, { name: "anchorBlockHash", type: "bytes32" }, { name: "expectedWithdrawalBatchIndex", type: "uint64" }];
const tail3 = [{ name: "withdrawalQueueHash", type: "bytes32" }, { name: "verifierConfig", type: "bytes" }, { name: "proof", type: "bytes" }];
const zoneInputs = [...head5, { name: "nextZoneHeight", type: "uint256" }, BT, DQ, T("tokenEnablementTransition", [{ name: "prevProcessedTokenCount", type: "uint64" }, { name: "nextProcessedTokenCount", type: "uint64" }]), ...tail3];
const verifyAbi = [{ type: "function", name: "verify", stateMutability: "view", inputs: zoneInputs, outputs: [{ name: "", type: "bool" }] }];
const preAbi = [{ type: "function", name: "verify", stateMutability: "pure", inputs: [...head5, BT, DQ, ...tail3], outputs: [{ name: "", type: "bool" }] }];
function solSelector(src) {
  const strip = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const structs = {};
  for (const m of strip.matchAll(/struct (\w+)\s*\{([^}]*)\}/g)) structs[m[1]] = m[2].split(";").map((f) => f.trim().split(/\s+/)[0]).filter(Boolean);
  const body = (strip.match(/function verify\(([^)]*)\)/) ?? fail("no verify("))[1];
  const ty = (t) => (structs[t] ? `(${structs[t].map(ty).join(",")})` : t);
  return toFunctionSelector(`verify(${body.split(",").map((p) => ty(p.trim().split(/\s+/)[0])).join(",")})`);
}
const izone = read(`${ZONES_DIR}/crates/contracts/src/runtime/interfaces/IZone.sol`, "zones IZone.sol");
const abiSel = toFunctionSelector(verifyAbi[0]);
if (solSelector(zsol) !== abiSel || solSelector(izone) !== abiSel) fail(`verify selector: recorder ${abiSel}, Sworn ${solSelector(zsol)}, zones ${solSelector(izone)}`);
const PRE_SEL = toFunctionSelector(preAbi[0]);
if (PRE_SEL !== "0x7106a43e") fail(`pre-T13 selector ${PRE_SEL} != 0x7106a43e`);
if (PRE_SEL === abiSel) fail("pre-T13 selector equals IVerifier's — the ABIs would not differ");
const PRE = getAddress((read("tempo/crates/contracts/src/precompiles/zone_factory.rs", "zone_factory.rs").match(/ZONE_VERIFIER_ADDRESS: Address = address!\("(0x[0-9a-fA-F]{40})"\)/) ?? fail("zone_factory.rs: no ZONE_VERIFIER_ADDRESS"))[1]);
const zrs = read("tempo/crates/contracts/src/zones.rs", "tempo zones.rs");
const rtm = zrs.match(/pub const ZONE_VERIFIER_RUNTIME: Bytes = bytes!\(([\s\S]*?)\);/) ?? fail("zones.rs: no ZONE_VERIFIER_RUNTIME");
const RUNTIME = lc("0x" + [...rtm[1].matchAll(/"([^"]*)"/g)].map((x) => x[1].replace(/^0x/, "")).join(""));
if (!RUNTIME.includes(`63${PRE_SEL.slice(2)}`)) fail("ZONE_VERIFIER_RUNTIME does not dispatch 0x7106a43e");
if (lc(await rpc("eth_getCode", [PRE, "latest"])) !== RUNTIME) fail(`code at ${PRE} != tempo ZONE_VERIFIER_RUNTIME (Moderato's verifier changed — T13?)`);
const a = fx.args;
const fxArgs = (h) => [a.zoneId, BigInt(a.tempoBlockNumber), BigInt(a.anchorBlockNumber), a.anchorBlockHash, BigInt(a.expectedWithdrawalBatchIndex), h,
  { prevBlockHash: a.prevBlockHash, nextBlockHash: a.nextBlockHash },
  { prevProcessedHash: a.prevProcessedHash, nextProcessedHash: a.nextProcessedHash, prevDepositNumber: BigInt(a.prevDepositNumber), nextDepositNumber: BigInt(a.nextDepositNumber) },
  { prevProcessedTokenCount: BigInt(a.prevProcessedTokenCount), nextProcessedTokenCount: BigInt(a.nextProcessedTokenCount) },
  a.withdrawalQueueHash, fx.verifierConfig, fx.proof];
const Z32 = "0x" + "00".repeat(32);
const malformed = [99, 0n, 0n, Z32, 0n, { prevBlockHash: Z32, nextBlockHash: Z32 }, { prevProcessedHash: Z32, nextProcessedHash: Z32, prevDepositNumber: 0n, nextDepositNumber: 0n }, Z32, "0xdead", "0xbeef"];
const H = BigInt(a.nextZoneHeight);
if (H !== ev.nextZoneHeight) fail("fixture nextZoneHeight != event");
async function rawCall(to, data) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }) });
  return res.json();
}
const okCall = await rawCall(ZV, encodeFunctionData({ abi: verifyAbi, functionName: "verify", args: fxArgs(H) }));
if (okCall.error || BigInt(okCall.result) !== 1n) fail(`eth_call verify(real) did not return true: ${JSON.stringify(okCall.error ?? okCall.result)}`);
const badCall = await rawCall(ZV, encodeFunctionData({ abi: verifyAbi, functionName: "verify", args: fxArgs(H + 1n) }));
const INVALID = toFunctionSelector("InvalidProof()");
if (!badCall.error || !String(badCall.error.data ?? "").startsWith(INVALID)) fail(`eth_call verify(height+1) did not revert InvalidProof(): ${JSON.stringify(badCall)}`);
const preData = encodeFunctionData({ abi: preAbi, functionName: "verify", args: malformed });
if (!preData.startsWith(PRE_SEL)) fail("pre-T13 calldata selector mismatch");
const stubCall = await rawCall(PRE, preData);
if (stubCall.error || BigInt(stubCall.result) !== 1n) fail(`eth_call Moderato pre-T13 verify(malformed) did not return true: ${JSON.stringify(stubCall.error ?? stubCall.result)}`);
const liveCalls = { swornReal: "true", swornMutated: "InvalidProof()", moderatoPreT13Malformed: "true", preT13Selector: PRE_SEL, at: new Date().toISOString() };
const proofBytes = (fx.proof.length - 2) / 2;
log(`• our eth_calls: Sworn verify(height ${H}) = true; verify(height ${H + 1n}) reverts InvalidProof(); Moderato ${short(PRE)} pre-T13 ${PRE_SEL} verify(zone 99, 0xdead, 0xbeef) = true`);

// ── the page ─────────────────────────────────────────────────────────────────────────────────────
const pageHtml = await fetchText(PAGE, "page");
if (!/<title>Sworn/.test(pageHtml)) fail(`${PAGE}: no "<title>Sworn"`);
const im = Z.constructor;
const readmeText = read("README.md", "README");
if (!readmeText.includes(PUBLISHED)) fail(`README does not link ${PUBLISHED}`);
const STUB_LINE = "On Moderato today, the pre-T13 Solidity reference verifier is a prototype stub: it returns true without checking execution";
const COMPARE = "An equivalent malformed batch is accepted by Moderato's current prototype verifier, while Sworn rejects a mutation of its proven batch.";

function checkZoneText(t, when) {
  const want = [
    "✓ succeeded · ZoneBatchVerified emitted", short(Z.attest.tx), `${atBlock} ·`, `${atGas.toLocaleString("en-US")} gas`, short(ZV, 6),
    `withdrawals\n${NW}`, `user transactions\n${NU}`, fx.args.withdrawalQueueHash, "✓ non-zero (a withdrawal is queued)", ITEST,
    "✓ its withdrawalQueueHash agrees with the fixture",
    String(ev.nextZoneHeight), ev.prevBlockHash, ev.nextBlockHash, ev.digest, "✓ the digest the zkVM guest committed",
    "✓ the attest call's arguments and proof are the ones \"Verify again\" uses",
    getAddress(im.sp1Verifier), M.verifierVersion, im.zoneVkey, `${im.parentChainId} (the dev chain`, im.pinnedGenesisArtifactHash,
    "✓ all five equal the constructor arguments", Z.codehash, "✓ equals deployments/moderato.json",
    short(HF.attest.tx), "✓ ZoneBatchVerified, digest and calldata match its fixture",
    `same ${proofBytes}-byte proof`,
    `verify(zone ${a.zoneId}, height ${H}, …, withdrawalQueueHash ${short(WQH)}, …, proof)`, "✓ true",
    `verify(zone ${a.zoneId}, height ${H + 1n}, …, proof)`, "✗ reverts InvalidProof()",
    "Moderato's current prototype verifier (pre-T13 reference stub), an equivalent malformed batch",
    "Moderato, pre-T13 · called", `${short(PRE)}.verify(zone 99, every block number 0, every hash 0x00…00, verifierConfig 0xdead, proof 0xbeef)`,
    `selector ${PRE_SEL}`, "not IVerifier's 12", "returns true", STUB_LINE, "Sworn demonstrates the missing ZK check.", COMPARE,
    "The batches are not from Moderato.", "Not connected to a ZonePortal; it does not protect withdrawals today.", "is a proposal (spec 004",
  ];
  for (const w of want) if (!lc(t).includes(lc(w))) fail(`page (${when}) does not show "${w}"`);
  if (/does not match|no longer returns true/.test(t)) fail(`page (${when}) shows a mismatch`);
  if (/the same input/i.test(t)) fail(`page (${when}) says "the same input"`);
  assertFresh(t, `page (${when})`);
}

async function capturePage() {
  const browser = await launch();
  const raw = path.join(work, "page.raw.mp4");
  const t = { marks: {}, called: [] };
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    await page.setViewport({ width: 1024, height: 576, deviceScaleFactor: 1.875 });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
    await page.emulateTimezone("UTC");
    await page.goto(PAGE, { waitUntil: "networkidle2", timeout: 120000 });
    await page.waitForFunction(() => { const z = document.querySelector("#zone")?.innerText ?? ""; return z.includes("ZoneBatchVerified emitted") && z.includes("✓ true") && z.includes("returns true") && z.includes("match its fixture"); }, { timeout: 120000, polling: 250 });
    await fontsReady(page).catch(() => fail("the page's Geist fonts did not load"));
    assertFresh(await page.evaluate(() => document.body.innerText), "page (whole)");
    checkZoneText(await page.evaluate(() => document.querySelector("#zone").innerText), "on load");
    const hdr = await page.evaluate(() => document.querySelector("header").getBoundingClientRect().height);
    const go = (sel, mode = "start", smooth = true) => page.evaluate((s, m, h, sm) => {
      const el = document.querySelector(s); if (!el) return false;
      const r = el.getBoundingClientRect(); const top = r.top + scrollY;
      const y = m === "start" ? top - h - 14 : m === "end" ? top + r.height - innerHeight + 24 : top - h - (innerHeight - h - r.height) / 2;
      scrollTo({ top: Math.max(0, y), behavior: sm ? "smooth" : "instant" }); return true;
    }, sel, mode, hdr, smooth).then((ok) => ok || fail(`page: no ${sel}`));
    const rect = (sel) => page.evaluate((x) => { const r = document.querySelector(x).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }, sel);
    const readat = () => page.evaluate(() => document.querySelector("#zone .again .readat")?.textContent ?? "");
    const click = async (label) => {
      const before = await readat();
      await page.click("#zone .again button.btn");
      mark(label);
      await page.waitForFunction((b) => { const r = document.querySelector("#zone .again .readat")?.textContent ?? ""; return r && r !== b && document.querySelector("#zone .again .row-stub"); }, { timeout: 30000, polling: 50 }, before);
      mark(`${label}:results`);
      t.called.push([before, await readat()]);
    };
    await go("#zone .zone-card.again", "start", false);
    await sleep(1500);
    t.btnRect = await rect("#zone .again button.btn");

    const recorder = await newRecorder(page);
    await recorder.start(raw);
    const t0 = Date.now();
    const at = async (s) => sleep(Math.max(0, t0 + s * 1000 - Date.now()));
    function mark(e) { t.marks[e] = (Date.now() - t0) / 1000; log(`    ${t.marks[e].toFixed(1).padStart(5)} s  ${e}`); }
    const P2 = holds[1];
    // scene 2: click, then centre Moderato's row
    mark("s2");
    await at(2.5); await click("click1");
    await at(5); await go("#zone .calls li.row-stub", "center"); mark("stub");
    await at(P2); mark("s3a");
    // scene 3a: the attest card, then what the batch contains
    await go("#zone .zone-card", "start");
    await at(P2 + 6); await go("#zone .zone-card .sub-head", "start"); mark("contains");
    await at(P2 + S3.pageA); mark("idle");
    // cut out: the explorer insert goes here; the page moves to the rows
    await go("#zone .again button.btn", "start", false);
    await sleep(1000); t.btnRect2 = await rect("#zone .again button.btn");
    await at(P2 + S3.pageA + IDLE); mark("s3c");
    // scene 3c: second click, rows 1–2, then the comparison line
    await at(P2 + S3.pageA + IDLE + 1); await click("click2");
    await at(P2 + S3.pageA + IDLE + 2.5); await go("#zone .again .calls", "start");
    await at(P2 + S3.pageA + IDLE + S3.pageC - 5); await go("#zone .compare-line", "end"); mark("compare");
    await at(P2 + S3.pageA + IDLE + S3.pageC + 0.5); mark("end");
    t.wall = (Date.now() - t0) / 1000;
    await recorder.stop();
    checkZoneText(await page.evaluate(() => document.querySelector("#zone").innerText), "after the clicks");
    for (const [b, aft] of t.called) {
      if (b === aft) fail(`page: "Called at" did not change (${aft})`);
      const ca = aft.match(/Called at (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) UTC/) ?? fail(`page: "${aft}"`);
      if (Math.abs(Date.now() - Date.parse(ca[1].replace(" ", "T") + "Z")) / 1000 > 120) fail(`page: "${aft}" is not now`);
    }
    for (const c of ["click1", "click2"]) if (t.marks[`${c}:results`] - t.marks[c] > 10) fail(`"Verify again" took too long (${c})`);
  } finally { await browser.close(); }
  log(`• page: ✓ checks passed on load and after both clicks (${t.called.map((c) => c[1]).join(" · ")})`);
  return { raw, ...t };
}

// The explorer, captured now: its transaction card and the event row, never the header.
const exUrl = `${EXPLORER}/tx/${Z.attest.tx}`;
async function explorerShots() {
  const { default: puppeteer } = await import("puppeteer");
  const br = await puppeteer.launch({ headless: true, timeout: 180000, args: ["--no-sandbox", "--hide-scrollbars"], defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 2 } });
  try {
    const p = await br.newPage();
    await p.emulateTimezone("UTC");
    await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
    await p.goto(`${exUrl}?tab=events`, { waitUntil: "networkidle2", timeout: 120000 });
    await p.waitForFunction((x) => document.body.innerText.includes("Success") && document.body.innerText.toLowerCase().includes(x), { timeout: 90000 }, lc(topic0));
    const text = await p.evaluate(() => document.body.innerText);
    for (const w of [Z.attest.tx, String(atBlock), "success", topic0, ZV]) if (!lc(text).includes(lc(w))) fail(`explorer page does not show ${w}`);
    assertFresh(text, "explorer page");
    for (let i = 0; i < 3; i++) {
      const tt = await p.evaluate(() => document.querySelector('button[title^="Showing "][title$="click to change"]')?.title ?? null);
      if (!tt || !/relative/i.test(tt)) break;
      await p.click('button[title^="Showing "][title$="click to change"]'); await sleep(500);
    }
    const clips = await p.evaluate((t0, zv) => {
      const leaves = [...document.querySelectorAll("body *")].filter((e) => e.children.length === 0);
      const leaf = (t) => leaves.find((e) => e.textContent.trim() === t);
      const st = leaf("Status"), to = leaf("To");
      let card = st;
      while (card && !(card.innerText.includes("Hash") && card.innerText.includes("Receipt"))) card = card.parentElement;
      const tl = leaves.find((e) => e.textContent.trim().toLowerCase() === t0);
      let row = tl;
      while (row && !(row.innerText.toLowerCase().includes(zv) && row.innerText.includes("Show details"))) row = row.parentElement;
      if (!card || !to || !row || row.innerText.includes("Transfer")) return null;
      const c = card.getBoundingClientRect(), s = st.getBoundingClientRect(), t = to.getBoundingClientRect(), r = row.getBoundingClientRect();
      return { card: { x: c.left, y: s.top - 22, width: c.width, height: t.bottom + 20 - (s.top - 22) }, row: { x: r.left, y: r.top, width: r.width, height: r.height } };
    }, lc(topic0), lc(ZV));
    if (!clips) fail("explorer: transaction card or event row not found");
    const card = await p.screenshot({ clip: clips.card, encoding: "base64" });
    const row = await p.screenshot({ clip: clips.row, encoding: "base64" });
    return { card: `data:image/png;base64,${card}`, row: `data:image/png;base64,${row}`, cw: clips.card.width, ch: clips.card.height };
  } finally { await br.close(); }
}

// ── scene 5: the live take (as in v2) ────────────────────────────────────────────────────────────
const take = JSON.parse(read(`${TAKE}/take.json`, "take.json"));
const L = M.dep.demoLiveTake ?? fail("moderato.json: no demoLiveTake");
if (L.take !== TAKE) fail(`demoLiveTake.take ${L.take} != ${TAKE}`);
for (const [k, v] of [["reserveTx", L.dishonestReserve], ["paymentTx", L.paymentDivertedToReceivePolicyGuard], ["payoutTx", L.challengeTx], ["honestReserveTx", L.honestReserve]])
  if (lc(take[k]) !== lc(v)) fail(`take.json ${k} ${take[k]} != moderato.json demoLiveTake`);
const sol = read("contracts/src/Sworn.sol", "Sworn source");
const evSig = (name) => parseAbiItem(`event ${name}(${flat((sol.match(new RegExp(`^\\s*event ${name}\\(([^)]*)\\);`, "m")) ?? fail(`Sworn.sol: no ${name}`))[1])})`);
const swornEvent = (r, e, what) => {
  const lg = r.logs.find((l) => getAddress(l.address) === M.SWORN && l.topics[0] === toEventSelector(e)) ?? fail(`${what}: no ${e.name} from Sworn`);
  return decodeEventLog({ abi: [e], data: lg.data, topics: lg.topics }).args;
};
const R500 = 500n * 10n ** BigInt(M.bondDecimals);
const dres = swornEvent(await receipt(L.dishonestReserve, "dishonest reserve"), evSig("Reserved"), "dishonest reserve");
if (dres.coverage !== R500) fail(`dishonest reserve coverage ${dres.coverage}`);
const GUARD_SRC = "tempo/crates/contracts/src/precompiles/mod.rs";
const GUARD = getAddress((read(GUARD_SRC, "Tempo precompile addresses").match(/RECEIVE_POLICY_GUARD_ADDRESS: Address =\s*address!\("(0x[0-9a-fA-F]{40})"\)/) ?? fail(`${GUARD_SRC}: no RECEIVE_POLICY_GUARD_ADDRESS`))[1]);
const payR = await receipt(L.paymentDivertedToReceivePolicyGuard, "payment");
const payBlock = parseInt(payR.blockNumber, 16);
if (payBlock !== L.paymentBlock) fail(`payment block ${payBlock} != moderato.json`);
const payTx = await rpc("eth_getTransactionByHash", [L.paymentDivertedToReceivePolicyGuard]);
const TOKEN = getAddress(payTx.to);
if (!payTx.input.startsWith(toFunctionSelector("transfer(address,uint256)"))) fail("payment is not a TIP-20 transfer(address,uint256)");
const RPRIME = getAddress("0x" + payTx.input.slice(34, 74));
const tdec = Number(await call(TOKEN, "decimals() view returns (uint8)"));
const bal = async (who, b) => call(TOKEN, "balanceOf(address) view returns (uint256)", [who], b);
const gDelta = (await bal(GUARD, payBlock)) - (await bal(GUARD, payBlock - 1));
const rDelta = (await bal(RPRIME, payBlock)) - (await bal(RPRIME, payBlock - 1));
if (gDelta !== 500n * 10n ** BigInt(tdec) || rDelta !== 0n) fail(`payment: guard Δ ${gDelta}, R′ Δ ${rDelta} (want +500 / 0)`);
const chR = await receipt(L.challengeTx, "challenge");
const chBlock = parseInt(chR.blockNumber, 16);
const sl = swornEvent(chR, evSig("Slashed"), "challenge");
if (sl.coverage !== R500 || getAddress(sl.client) !== getAddress(M.dep.roles.client)) fail("challenge: Slashed is not 500 to the client");
const cDelta = (await call(M.bondToken, "balanceOf(address) view returns (uint256)", [M.dep.roles.client], chBlock)) - (await call(M.bondToken, "balanceOf(address) view returns (uint256)", [M.dep.roles.client], chBlock - 1));
if (cDelta !== R500) fail(`challenge: client Δ ${cDelta}`);
const job = take.jobs.at(-1).job;
const realProve = (job.phaseStartedAt.submitting - job.phaseStartedAt.proving) / 1000;
const mmss = (s) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s`;
if (mmss(realProve) !== L.provingRealTime) fail(`take proving ${mmss(realProve)} != moderato.json ${L.provingRealTime}`);
const ev2 = (e) => (take.events.find((x) => x.e.startsWith(e)) ?? fail(`take.json: no "${e}" mark`)).t;
const BUY = ev2("buy"), ANSWER = ev2("answer");
const takeClip = path.join(repo, TAKE, "scene1.mp4");
const takeDur = duration(takeClip);
const SPED_TO = 3;
const sped = ANSWER - BUY;
log(`• take: reserve ${short(L.dishonestReserve)} 500; payment ${short(L.paymentDivertedToReceivePolicyGuard)}: guard +${fmt2(gDelta, tdec)}, R′ +${fmt2(rDelta, tdec)}; challenge ${short(L.challengeTx)} Slashed 500, client +${fmt2(cDelta, M.bondDecimals)}; proving ${mmss(realProve)}; speed-up ${sped.toFixed(1)} s → ${SPED_TO} s`);

// ── scenes 4 and 6: disclosures, spec 004, limits ────────────────────────────────────────────────
if (!/D2 no portal caller check/.test(HF.deviations) || !/D1-D4 as SwornZoneVerifier/.test(Z.deviations)) fail("moderato.json: deviations no longer name D2 (no portal)");
if (!/not that withdrawals are secured/.test(Z.deviations)) fail("moderato.json SwornZoneVerifierWithdrawal.deviations changed");
const spec4 = flat(read("docs/specs/004-tee-plus-zk.md", "spec 004"));
for (const s of ["A proposal for Tempo, not something Sworn can deploy.", "Payouts wait for ZK."]) if (!spec4.includes(s)) fail(`spec 004 no longer says "${s}"`);
const FACTORY = "tempo/crates/precompiles/src/zone_factory/mod.rs";
const fac = read(FACTORY, "vendored zone_factory").split("\n");
const fv = fac.findIndex((l) => l.trim() === "verifier: ZONE_VERIFIER_ADDRESS,");
if (fv < 0) fail(`${FACTORY}: verifier assignment moved`);
for (const s of ["**The batches are not from Moderato.**", "Tempo's zones integration tests", "It does not secure withdrawals", "Unaudited.", "Traction: none.", "Revenue today: zero.", "`challenge()` pays the reserved coverage to the client"])
  if (!flat(readmeText).includes(flat(s))) fail(`README no longer says "${s}"`);
// v3.2 route (scene 6): "one Zone operator" read now from Tempo's ZoneFactory on Moderato.
const FADDR = getAddress((read("tempo/crates/contracts/src/precompiles/zone_factory.rs", "zone_factory.rs").match(/ZONE_FACTORY_ADDRESS: Address = address!\("(0x[0-9a-fA-F]{40})"\)/) ?? fail("zone_factory.rs: no ZONE_FACTORY_ADDRESS"))[1]);
const nZones = Number(await call(FADDR, "nextZoneId() view returns (uint32)")) - 1;
if (nZones < 1) fail("ZoneFactory: no Zones");
const zs = [];
for (let i = 1; i <= nZones; i++) zs.push(await call(FADDR, "zones(uint32 id) view returns ((uint32 zoneId,address portal,bool accessMode,bool gatewayMode,address admin,address[] sequencers,uint8 threshold,address verifier,string rpcUrl))", [i]));
const zAdmin = getAddress(zs[0].admin);
for (const z of zs) if (getAddress(z.admin) !== zAdmin || z.sequencers.map(getAddress).sort().join() !== zs[0].sequencers.map(getAddress).sort().join()) fail(`zone ${z.zoneId}: another admin or sequencer set — "one Zone operator" no longer true`);
const fOwner = getAddress(await call(FADDR, "owner() view returns (address)"));
const sOwners = (await call(fOwner, "getOwners() view returns (address[])")).map(getAddress);
if (sOwners.length !== 1 || sOwners[0] !== zAdmin || (await call(fOwner, "getThreshold() view returns (uint256)")) !== 1n) fail("factory owner is not a 1-of-1 Safe of the Zones' admin");
log(`• ZoneFactory: ${nZones} Zones, one admin ${short(zAdmin)}; owner ${short(fOwner)} = 1-of-1 Safe of that admin`);
const s6 = read("docs/specs/004-tee-plus-zk.md", "spec 004").split("## 6. Status")[1]?.split("\n## ")[0] ?? fail("spec 004: no §6");
if ((s6.match(/\| not built/g) ?? []).length < 5) fail("spec 004 §6: fewer than 5 rows not built");
for (const s of ["Moderato has one Zone operator today, and we have no customers.", "evidence, not yet a guarantee"]) if (!flat(readmeText).includes(s)) fail(`README no longer says "${s}"`);
const repoUrl = ghRepoPublic("psyto/sworn", "repo");
const pub = await fetchText(PUBLISHED, "published page");
if (!/<title>Sworn/.test(pub)) fail(`${PUBLISHED}: no "<title>Sworn"`);

const data = {
  scenes: ["d1", "e1", "dz", "d6"],
  portalSrc: `tempoxyz/zones @ ${ZONES_REF} · ZonePortal.sol`, portalLines,
  exUrl: `explore.testnet.tempo.xyz/tx/${short(Z.attest.tx)}`,
  exTopic: `topic0 ${short(topic0, 6)} = keccak256 of ${zev.name}(…) from SwornZoneVerifier.sol`,
  exFrom: `contract ${short(ZV, 6)} = SwornZoneVerifierWithdrawal in deployments/moderato.json`,
  itest: ITEST,
  plainSrc: "deployments/moderato.json SwornZoneVerifierWithdrawal (batch, deviations D1–D4) · README “What the Zone verifier is, and is not” · docs/specs/004-tee-plus-zk.md",
  specSrc: `spec 004: “A proposal for Tempo, not something Sworn can deploy.” · “Payouts wait for ZK.” · Tempo's factory fixes each Zone's verifier (${FACTORY.replace(/^tempo\//, "")}:${fv + 1})`,
  operatorSrc: `README Status · Tempo's Zone factory on Moderato, read now: ${nZones} Zones, one admin and one sequencer set, factory owned by a 1-of-1 Safe with that signer`,
  repo: repoUrl, pageUrl: PUBLISHED.replace(/^https:\/\//, "").replace(/\/$/, ""),
};
for (const [k, v] of Object.entries(data)) if (typeof v === "string") assertFresh(v, `slot ${k}`);

const shots = await explorerShots();
data.exCard = shots.card; data.exEvent = shots.row;
log(`• explorer: ${short(Z.attest.tx)} card ${Math.round(shots.cw)}×${Math.round(shots.ch)} CSS px, header excluded`);
if (process.env.PREVIEW) {
  const outDir = path.resolve(process.env.PREVIEW);
  mkdirSync(outDir, { recursive: true });
  const br = await launch();
  try {
    const page = await br.newPage();
    await page.goto("file://" + path.join(dir, "demo.html"), { waitUntil: "load" });
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
await checkOverflow("demo.html", data, data.scenes);
log("• layout: nothing outside its card or the frame");

// ── overlays (this ffmpeg has no drawtext): transparent 1920×1080 PNGs ──────────────────────────
async function pills(list) {
  const br = await launch();
  try {
    const p = await br.newPage();
    for (const { file, html, pos } of list) {
      await p.setContent(`<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=block"></head><body style="margin:0;width:1280px;height:720px;background:transparent">
        <div style="position:absolute;${pos}">${html}</div></body></html>`);
      await fontsReady(p);
      await p.screenshot({ path: file, omitBackground: true });
    }
  } finally { await br.close(); }
}
const pill = (main, sub) => `<span style="display:inline-block;background:#2b3078;color:#fff;padding:10px 20px;text-align:left;font-family:'Geist Mono',ui-monospace,Menlo,monospace;font-weight:500;font-size:17px;letter-spacing:.06em;text-transform:uppercase">${main}${sub ? `<br><span style="font-weight:400;font-size:12px;letter-spacing:.06em;color:#d4d4d4">${sub}</span>` : ""}</span>`;
const ENC = ["-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-crf", "20", "-preset", "slow", "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart"];
const ff = (args) => execFileSync(FFMPEG, ["-v", "error", ...args, "-y"]);
const VF = "fps=30,scale=1920:1080,setsar=1,scale=in_range=full:out_range=tv,format=yuv420p";

// ── scene 1 ─────────────────────────────────────────────────────────────────────────────────────
const scene1 = path.join(work, "scene1.mp4");
await recordSlides({ html: "demo.html", data, ids: ["d1"], holds: [holds[0]], raw: path.join(work, "s1.raw.mp4"), out: scene1 });

// ── scenes 2–3: the page ────────────────────────────────────────────────────────────────────────
log("• scenes 2–3: recording the page …");
const pg = await capturePage();
const P = { click: path.join(work, "pill-click.png"), click2: path.join(work, "pill-click2.png"), speed: path.join(work, "pill-speed.png") };
const factor = sped / SPED_TO;
await pills([
  { file: P.click, pos: `top:${(((pg.btnRect.top + pg.btnRect.bottom) / 2) * 1.25 - 26).toFixed(0)}px;left:${((pg.btnRect.right + 24) * 1.25).toFixed(0)}px`, html: pill(`“Verify again” clicked · live`, "three read-only eth_calls · the page also ran them when it loaded") },
  { file: P.click2, pos: `top:${(((pg.btnRect2.top + pg.btnRect2.bottom) / 2) * 1.25 - 26).toFixed(0)}px;left:${((pg.btnRect2.right + 24) * 1.25).toFixed(0)}px`, html: pill(`“Verify again” clicked again · live`, "the same three read-only eth_calls") },
  { file: P.speed, pos: "top:150px;right:24px;text-align:right", html: pill(`×${factor.toFixed(1)} · MPP charge + reserve`, `this run: ${sped.toFixed(1)} s real → ${SPED_TO} s · sped up in the edit`) },
]);
const k = duration(pg.raw) / pg.wall;
const K = (e) => pg.marks[e] * k;
const scene2 = path.join(work, "scene2.mp4"), s3a = path.join(work, "s3a.mp4"), s3x = path.join(work, "s3x.mp4"), s3c = path.join(work, "s3c.mp4");
ff(["-i", pg.raw, "-loop", "1", "-framerate", "30", "-i", P.click, "-filter_complex",
  `[0:v]fps=30,scale=1920:1080,setsar=1[b];[b][1:v]overlay=0:0:shortest=1:enable='between(t,${(K("click1") - 0.3).toFixed(2)},${(K("click1") + 4).toFixed(2)})',scale=in_range=full:out_range=tv,format=yuv420p[v]`,
  "-map", "[v]", "-an", "-t", String(holds[1]), ...ENC, scene2]);
ff(["-ss", K("s3a").toFixed(3), "-i", pg.raw, "-vf", VF, "-an", "-t", String(S3.pageA), ...ENC, s3a]);
await recordSlides({ html: "demo.html", data, ids: ["e1"], holds: [S3.explorer], raw: path.join(work, "s3x.raw.mp4"), out: s3x });
const c2 = K("click2") - K("s3c");
ff(["-ss", K("s3c").toFixed(3), "-i", pg.raw, "-loop", "1", "-framerate", "30", "-i", P.click2, "-filter_complex",
  `[0:v]fps=30,scale=1920:1080,setsar=1[b];[b][1:v]overlay=0:0:shortest=1:enable='between(t,${Math.max(0, c2 - 0.3).toFixed(2)},${(c2 + 1.4).toFixed(2)})',scale=in_range=full:out_range=tv,format=yuv420p[v]`,
  "-map", "[v]", "-an", "-t", String(S3.pageC), ...ENC, s3c]);
const scene3 = path.join(work, "scene3.mp4");
concat([s3a, s3x, s3c], scene3);
rmSync(pg.raw, { force: true });

// ── scene 4: said plainly ───────────────────────────────────────────────────────────────────────
const scene4 = path.join(work, "scene4.mp4");
await recordSlides({ html: "demo.html", data, ids: ["dz"], holds: [holds[3]], raw: path.join(work, "s4.raw.mp4"), out: scene4 });

// ── scene 5: the take, re-cut ───────────────────────────────────────────────────────────────────
log("• scene 5: re-cutting the take …");
const scene5 = path.join(work, "scene5.mp4");
const kept = BUY + SPED_TO + (takeDur - ANSWER);
if (kept > holds[4]) fail(`scene 5 picture ${kept.toFixed(1)} s > its ${holds[4]} s`);
ff(["-i", takeClip, "-loop", "1", "-framerate", "30", "-i", P.speed, "-filter_complex", [
  `[0:v]fps=30,scale=1920:1080,setsar=1,split=3[s0][s1][s2]`,
  `[s0]trim=0:${BUY},setpts=PTS-STARTPTS[a]`,
  `[s1]trim=${BUY}:${ANSWER},setpts=(PTS-STARTPTS)/${factor},fps=30[b0]`, `[b0][1:v]overlay=0:0:shortest=1[b]`,
  `[s2]trim=${ANSWER}:${takeDur},setpts=PTS-STARTPTS[c]`,
  `[a][b][c]concat=n=3:v=1:a=0,tpad=stop_mode=clone:stop_duration=${(holds[4] - kept + 1).toFixed(2)},format=yuv420p[v]`].join(";"),
  "-map", "[v]", "-an", "-t", String(holds[4]), ...ENC, scene5]);

// ── scene 6 ─────────────────────────────────────────────────────────────────────────────────────
const scene6 = path.join(work, "scene6.mp4");
await recordSlides({ html: "demo.html", data, ids: ["d6"], holds: [holds[5]], raw: path.join(work, "s6.raw.mp4"), out: scene6 });

// ── assemble ────────────────────────────────────────────────────────────────────────────────────
const parts = [scene1, scene2, scene3, scene4, scene5, scene6];
parts.forEach((f, i) => { const d = duration(f); if (Math.abs(d - holds[i]) > 0.12) fail(`scene ${i + 1} clip is ${d} s, expected ${holds[i]} s`); });
const out = path.join(dir, "demo.mp4");
concat(parts, out);
const got = duration(out);
if (Math.abs(got - TOTAL) > 0.25) fail(`demo.mp4 is ${got} s, expected ${TOTAL} s`);
if (got > MAX_TOTAL) fail(`demo.mp4 is ${got} s > ${MAX_TOTAL} s`);
const starts = holds.reduce((acc, h) => [...acc, acc.at(-1) + h], [0]);
const cues = writeSrt(scenes, starts, path.join(dir, "demo.srt"));
for (let i = 0; i < 6; i++) ff(["-ss", (starts[i + 1] - 0.2).toFixed(2), "-i", out, "-frames:v", "1", path.join(dir, "frames", `demo-scene${i + 1}.png`)]);
const r2 = (e) => +K(e).toFixed(2);
writeJson(path.join(dir, "demo.marks.json"), {
  name: "demo", script: "video/DEMO.md", version: "2.2", holds, titles: scenes.map((s) => s.title), words: scenes.map((s) => s.words), totalWords: words,
  page: PAGE, published: PUBLISHED, recordedFromPublishedPage: PAGE === PUBLISHED, take: TAKE,
  zoneAttest: Z.attest.tx, liveCalls,
  pageMarks: { click1: r2("click1"), stub: r2("stub"), s3a: r2("s3a"), contains: r2("contains"), s3c: r2("s3c"), click2: r2("click2"), compare: r2("compare") },
  calledAt: pg.called,
  scene3: { pageA: S3.pageA, explorer: S3.explorer, pageC: S3.pageC, cutOutOfPage: IDLE },
  scene5: { kept: [[0, BUY], [ANSWER, +takeDur.toFixed(3)]], spedUp: { from: [BUY, ANSWER], realSecs: +sped.toFixed(2), shownSecs: SPED_TO }, timelapse: { realProve: L.provingRealTime, shownSecs: 10, burnedInBy: "the v1 edit of this take" }, heldLastFrame: +(holds[4] - kept).toFixed(2) },
  note: "Silent. Read each scene's lines over its clip (video/scenes/demo/). Scene 3 has the explorer insert in its middle; scene 5 has silent time at the time-lapse.",
  recordedAt: new Date().toISOString(),
});
log(`\n✓ ${rel(out)}  (${got.toFixed(2)} s, holds ${holds.join(" / ")}, ${words} words)`);
log(`✓ video/demo.srt  (${cues} cues) · video/demo.marks.json · video/frames/demo-scene{1..6}.png`);
log(`  next: node video/split-scenes.mjs demo`);
