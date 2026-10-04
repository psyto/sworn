// Records video/demo.mp4 — Sworn's ≤ 3 min CWF demo v2, four scenes, SILENT, 1920×1080 — plus video/demo.srt
// and video/demo.marks.json, from the v2 edit plan video/DEMO.md (Zone proof first; order approved 10-04).
//
//   node video/record-demo.mjs           # then: node video/split-scenes.mjs demo
//   PREVIEW=<dir> node video/record-demo.mjs   # one PNG per authored slide + the page checks; records nothing
//
// Reads only. No keys, no transactions: the public page makes eth_call / receipt reads, this script makes
// eth_call / eth_getCode / receipts / eth_simulateV1. Scene lengths: max(DEMO.md's "≈ N s" target, words ÷
// 2.2 w/s rounded up to 0.5 s). Every figure on screen is read now from the source DEMO.md's claims table
// names, and a missing or changed source THROWS:
//   scene 1  the PUBLISHED page (DEMO_PAGE_URL, default https://psyto.github.io/sworn/), its Zone section
//            recorded in a real browser; every value the page shows (attest tx, block, gas, contract,
//            decoded event, ✓ lines, immutables, verify(…) results, proof size) is compared with
//            deployments/moderato.json ↔ Moderato, the fixture and our own eth_calls; "Verify again" is
//            clicked and its "Called at" must change. The superseded verifier / attest tx must appear nowhere.
//            The pipeline caption's seconds must equal the proving log, else the caption is hidden in the
//            capture and the log's figure is burned in instead (recorded in demo.marks.json).
//            The explorer page of the attest tx, cropped to its transaction card and its event row (no header).
//   scene 2  the live take video/takes/demo-20261003T131156Z (take.json ↔ deployments/moderato.json
//            demoLiveTake ↔ Moderato: reserve, payment with guard +500 / R′ +0 at block−1/block, challenge
//            with Slashed and client +500). One labelled speed-up (MPP charge + reserve), real duration from
//            the take's own marks; the existing time-lapse label is the take's.
//   scene 3  the honest card of the same take, the honest recheck log (AnswerCorrect), Sworn.sol, and an
//            eth_simulateV1 of the agent's own transfer at the question's block, run now.
//   scene 4  README (limits), the repo (public), the published page (HTTP 200, title).
// v1 (five scenes, bonded answers first, --live / --no-live / --from-take) is in git: d6996a3:video/record-demo.mjs.
import path from "node:path";
import { existsSync, readFileSync, rmSync, mkdirSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  parseAbiItem, parseAbi, decodeEventLog, getAddress, formatUnits, toEventSelector, toFunctionSelector, keccak256,
  encodeFunctionData,
} from "viem";
import {
  dir, repo, read, fail, log, rel, short, sleep, RPC, EXPLORER, FFMPEG, parseScenes, rpc, call, receipt, fetchText,
  ghRepoPublic, moderato, launch, newRecorder, encode, recordSlides, checkOverflow, fontsReady, writeSrt, writeJson,
  duration, concat,
} from "./lib/rec.mjs";

const MAX_TOTAL = 180;
const PAGE = process.env.DEMO_PAGE_URL || "https://psyto.github.io/sworn/";
const TAKE = "video/takes/demo-20261003T131156Z";
const work = path.join(dir, "takes", "demo-v2"); // intermediates (gitignored)
mkdirSync(work, { recursive: true });

// ── the script ───────────────────────────────────────────────────────────────────────────────────
const scenes = parseScenes("video/DEMO.md");
if (scenes.length !== 4) fail(`DEMO.md has ${scenes.length} scenes, expected 4 (v2)`);
const md = read("video/DEMO.md", "DEMO.md");
const targets = [...md.matchAll(/^## Scene (\d+) — .*· ≈ (\d+(?:\.\d+)?) s\s*$/gm)].map((m) => +m[2]);
if (targets.length !== 4) fail("DEMO.md: every scene heading needs its \"≈ N s\" target");
const holds = scenes.map((s, i) => Math.max(s.hold, targets[i]));
const TOTAL = holds.reduce((a, b) => a + b, 0);
const words = scenes.reduce((a, s) => a + s.words, 0);
log(`• demo v2: scene lengths = max(target, words ÷ 2.2)`);
for (const [i, s] of scenes.entries()) log(`    scene ${s.n}: ${String(s.words).padStart(3)} words (${s.hold} s of voice) → ${holds[i]} s  (${s.title})`);
log(`    total ${TOTAL} s, ${words} words`);
if (words > 330) fail(`DEMO.md narration is ${words} words > the plan's hard cap 330`);
if (TOTAL > MAX_TOTAL) fail(`demo runs ${TOTAL} s > ${MAX_TOTAL} s`);
// Scene 1 is page A + explorer insert + page B.
const S1 = { explorer: 12, pageB: 6 };
S1.pageA = holds[0] - S1.explorer - S1.pageB;
if (S1.pageA < 40) fail(`scene 1 leaves only ${S1.pageA} s for the page`);

const flat = (s) => s.replace(/\s+/g, " ").trim();
const fmt2 = (v, d) => { const [i, f = ""] = formatUnits(v, d).split("."); return `${i}.${(f + "00").slice(0, 2)}`; };
const lc = (s) => s.toLowerCase();

// ── chain facts ──────────────────────────────────────────────────────────────────────────────────
const M = await moderato();
const Z = M.dep.SwornZoneVerifier ?? fail("moderato.json: no SwornZoneVerifier");
const OLD = M.dep.SwornZoneVerifierSuperseded ?? fail("moderato.json: no SwornZoneVerifierSuperseded");
const ZV = getAddress(Z.address);
if (keccak256(await rpc("eth_getCode", [ZV, "latest"])) !== Z.codehash) fail("SwornZoneVerifier codehash on chain != moderato.json");
// Anything that names the superseded deployment is stale.
const staleNeedles = [OLD.address, OLD.attest.tx, short(OLD.address), short(OLD.attest.tx), short(OLD.address, 6), OLD.address.slice(0, 10), OLD.attest.tx.slice(0, 10)].map(lc);
const assertFresh = (text, where) => { for (const n of staleNeedles) if (lc(text).includes(n)) fail(`${where} shows the SUPERSEDED verifier/attest (${n})`); };
assertFresh(md, "video/DEMO.md");

const zsol = read("contracts/src/SwornZoneVerifier.sol", "SwornZoneVerifier source");
const zev = parseAbiItem(`event ${flat(zsol.match(/event (ZoneBatchVerified\([^)]*\));/)?.[1] ?? fail("no ZoneBatchVerified in SwornZoneVerifier.sol"))}`);
if (!/error InvalidProof\(\);/.test(zsol)) fail("SwornZoneVerifier.sol declares no InvalidProof()");
const atR = await receipt(Z.attest.tx, "attest");
const atBlock = parseInt(atR.blockNumber, 16);
if (atBlock !== Z.attest.block) fail(`attest block ${atBlock} != moderato.json ${Z.attest.block}`);
if (getAddress(atR.to) !== ZV) fail(`attest tx is to ${atR.to}, not SwornZoneVerifier ${ZV}`);
const topic0 = toEventSelector(zev);
const atLog = atR.logs.find((l) => getAddress(l.address) === ZV && l.topics[0] === topic0) ?? fail("attest: no ZoneBatchVerified from SwornZoneVerifier");
const ev = decodeEventLog({ abi: [zev], data: atLog.data, topics: atLog.topics }).args;
const fxPath = Z.attest.fixture;
const fx = JSON.parse(read(fxPath, "zone fixture"));
if (lc(fx.digest) !== lc(ev.digest)) fail("attest digest != fixture digest");
if (lc(fx.verifier) !== lc(ZV)) fail(`fixture verifier ${fx.verifier} != deployed ${ZV}`);
const atGas = parseInt(atR.gasUsed, 16);
if (atGas !== Z.attest.gasUsed) fail(`attest gas ${atGas} != moderato.json ${Z.attest.gasUsed}`);
const plog = read(Z.attest.proving.log, "Zone proving log");
const cycles = +(plog.match(/cycles\(total_instruction_count\): (\d+)/) ?? fail("proving log: no cycle count"))[1];
const wall = +(plog.match(/PROVE groth16 wall: ([\d.]+)s/) ?? fail("proving log: no groth16 wall time"))[1];
if (cycles !== Z.attest.proving.cycles) fail(`proving log cycles ${cycles} != moderato.json`);
if (Math.abs(wall - Z.attest.proving.groth16WallSecs) > 0.1) fail(`proving log wall ${wall} != moderato.json`);
log(`• attest ${short(Z.attest.tx)} block ${atBlock} → ${short(ZV)}: ZoneBatchVerified zone ${ev.zoneId} height ${ev.nextZoneHeight}; proving log ${cycles} cycles, ${wall.toFixed(1)} s`);

// Our own two eth_calls of verify(…) with the fixture: true, and nextZoneHeight+1 → InvalidProof().
const T = (name, components) => ({ name, type: "tuple", components });
const zoneInputs = [
  { name: "zoneId", type: "uint32" }, { name: "tempoBlockNumber", type: "uint64" }, { name: "anchorBlockNumber", type: "uint64" },
  { name: "anchorBlockHash", type: "bytes32" }, { name: "expectedWithdrawalBatchIndex", type: "uint64" }, { name: "nextZoneHeight", type: "uint256" },
  T("blockTransition", [{ name: "prevBlockHash", type: "bytes32" }, { name: "nextBlockHash", type: "bytes32" }]),
  T("depositQueueTransition", [{ name: "prevProcessedHash", type: "bytes32" }, { name: "nextProcessedHash", type: "bytes32" }, { name: "prevDepositNumber", type: "uint64" }, { name: "nextDepositNumber", type: "uint64" }]),
  T("tokenEnablementTransition", [{ name: "prevProcessedTokenCount", type: "uint64" }, { name: "nextProcessedTokenCount", type: "uint64" }]),
  { name: "withdrawalQueueHash", type: "bytes32" }, { name: "verifierConfig", type: "bytes" }, { name: "proof", type: "bytes" },
];
const verifyAbi = [{ type: "function", name: "verify", stateMutability: "view", inputs: zoneInputs, outputs: [{ name: "", type: "bool" }] }];
// The ABI above must be the deployed source's verify(…): compare selectors with SwornZoneVerifier.sol.
function solSelector(src) {
  const strip = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const structs = {};
  for (const m of strip.matchAll(/struct (\w+)\s*\{([^}]*)\}/g)) structs[m[1]] = m[2].split(";").map((f) => f.trim().split(/\s+/)[0]).filter(Boolean);
  const body = (strip.match(/function verify\(([^)]*)\)/) ?? fail("no verify("))[1];
  const ty = (t) => (structs[t] ? `(${structs[t].map(ty).join(",")})` : t);
  return toFunctionSelector(`verify(${body.split(",").map((p) => ty(p.trim().split(/\s+/)[0])).join(",")})`);
}
const izone = read("spikes/zone-spf/zones/crates/contracts/src/runtime/interfaces/IZone.sol", "zones IZone.sol");
const abiSel = toFunctionSelector(verifyAbi[0]);
if (solSelector(zsol) !== abiSel || solSelector(izone) !== abiSel) fail(`verify selector: recorder ${abiSel}, Sworn ${solSelector(zsol)}, zones ${solSelector(izone)}`);
const a = fx.args;
const fxArgs = (h) => [a.zoneId, BigInt(a.tempoBlockNumber), BigInt(a.anchorBlockNumber), a.anchorBlockHash, BigInt(a.expectedWithdrawalBatchIndex), h,
  { prevBlockHash: a.prevBlockHash, nextBlockHash: a.nextBlockHash },
  { prevProcessedHash: a.prevProcessedHash, nextProcessedHash: a.nextProcessedHash, prevDepositNumber: BigInt(a.prevDepositNumber), nextDepositNumber: BigInt(a.nextDepositNumber) },
  { prevProcessedTokenCount: BigInt(a.prevProcessedTokenCount), nextProcessedTokenCount: BigInt(a.nextProcessedTokenCount) },
  a.withdrawalQueueHash, fx.verifierConfig, fx.proof];
const H = BigInt(a.nextZoneHeight);
if (H !== ev.nextZoneHeight) fail("fixture nextZoneHeight != event");
async function rawCall(data) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: ZV, data }, "latest"] }) });
  return res.json();
}
const okCall = await rawCall(encodeFunctionData({ abi: verifyAbi, functionName: "verify", args: fxArgs(H) }));
if (okCall.error || BigInt(okCall.result) !== 1n) fail(`eth_call verify(real) did not return true: ${JSON.stringify(okCall.error ?? okCall.result)}`);
const badCall = await rawCall(encodeFunctionData({ abi: verifyAbi, functionName: "verify", args: fxArgs(H + 1n) }));
const INVALID = toFunctionSelector("InvalidProof()");
if (!badCall.error || !String(badCall.error.data ?? "").startsWith(INVALID)) fail(`eth_call verify(height+1) did not revert InvalidProof(): ${JSON.stringify(badCall)}`);
const proofBytes = (fx.proof.length - 2) / 2;
log(`• our eth_calls: verify(height ${H}) = true; verify(height ${H + 1n}) reverts ${INVALID} InvalidProof(); proof ${proofBytes} bytes`);

// ── scene 1: the published page ─────────────────────────────────────────────────────────────────
const pageHtml = await fetchText(PAGE, "published page");
if (!/<title>Sworn/.test(pageHtml)) fail(`${PAGE}: no "<title>Sworn"`);
const im = Z.constructor;
const readmeText = read("README.md", "README");
if (!readmeText.includes(PAGE)) fail(`README does not link ${PAGE}`);

/** The checks the page must pass, on #zone's text. */
function checkZoneText(t, when) {
  const want = [
    "✓ succeeded · ZoneBatchVerified emitted", short(Z.attest.tx), `${atBlock} ·`, `${atGas.toLocaleString("en-US")} gas`, short(ZV, 6),
    `${ev.zoneId}`, ev.prevBlockHash, ev.nextBlockHash, ev.digest, "✓ the digest the zkVM guest committed",
    "✓ the attest call's arguments and proof are the ones \"Verify again\" uses",
    getAddress(im.sp1Verifier), M.verifierVersion, im.zoneVkey, `${im.parentChainId} (the dev chain`, im.pinnedGenesisArtifactHash,
    "✓ all five equal the constructor arguments", Z.codehash, "✓ equals deployments/moderato.json",
    `same ${proofBytes}-byte proof`, `verify(zone ${a.zoneId}, height ${H}, …, proof)`, "✓ true",
    `verify(zone ${a.zoneId}, height ${H + 1n}, …, proof)`, "✗ reverts InvalidProof()", "The batch is not from Moderato.",
  ];
  for (const w of want) if (!lc(t).includes(lc(w))) fail(`page (${when}) does not show "${w}"`);
  if (/does not match/.test(t)) fail(`page (${when}) shows "does not match"`);
  assertFresh(t, `page (${when})`);
}

async function capturePage() {
  const browser = await launch();
  const raw = path.join(work, "page.raw.mp4");
  const t = { marks: {}, hidCaption: null };
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    // 1024×576 CSS px at 1.875× = 1920×1080: the page at 125 % zoom, so its mono values read at 1080p.
    await page.setViewport({ width: 1024, height: 576, deviceScaleFactor: 1.875 });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
    await page.emulateTimezone("UTC");
    await page.goto(PAGE, { waitUntil: "networkidle2", timeout: 120000 });
    await page.waitForFunction(() => { const z = document.querySelector("#zone")?.innerText ?? ""; return z.includes("ZoneBatchVerified emitted") && z.includes("✓ true") && z.includes("InvalidProof"); }, { timeout: 120000, polling: 250 });
    await fontsReady(page).catch(() => fail("the page's Geist fonts did not load"));
    const all = await page.evaluate(() => document.body.innerText);
    assertFresh(all, "page (whole)");
    checkZoneText(await page.evaluate(() => document.querySelector("#zone").innerText), "on load");
    // Pipeline caption: "… took 25.5M cycles and N s …" must match the proving log.
    const cap = await page.evaluate(() => document.querySelector("#zone figcaption")?.innerText ?? "");
    const cm = cap.match(/([\d.]+)M cycles and (\d+) s/) ?? fail(`page caption changed: "${cap}"`);
    if (cm[1] !== (cycles / 1e6).toFixed(1)) fail(`page caption cycles ${cm[1]}M != log ${cycles}`);
    if (+cm[2] !== Math.round(wall)) {
      t.hidCaption = `the published page's pipeline caption says ${cm[2]} s (an earlier proof); the proving log of this attest says ${Math.round(wall)} s — caption hidden in the capture, the log's figure burned in`;
      log(`  ! ${t.hidCaption}`);
      await page.evaluate(() => { document.querySelector("#zone figcaption").style.display = "none"; });
    }
    const hdr = await page.evaluate(() => document.querySelector("header").getBoundingClientRect().height);
    const go = (sel, mode = "start", nth = 0, smooth = true) => page.evaluate((s, m, n, h, sm) => {
      const el = document.querySelectorAll(s)[n]; if (!el) return false;
      const r = el.getBoundingClientRect(); const top = r.top + scrollY;
      const y = m === "start" ? top - h - 14 : top - h - (innerHeight - h - r.height) / 2;
      scrollTo({ top: Math.max(0, y), behavior: sm ? "smooth" : "instant" }); return true;
    }, sel, mode, nth, hdr, smooth).then((ok) => ok || fail(`page: no ${sel}[${nth}]`));
    await go("#zone .section-head", "start", 0, false);
    await sleep(1500);

    const recorder = await newRecorder(page);
    await recorder.start(raw);
    const t0 = Date.now();
    const at = async (s) => sleep(Math.max(0, t0 + s * 1000 - Date.now()));
    const mark = (e) => { t.marks[e] = (Date.now() - t0) / 1000; log(`    ${t.marks[e].toFixed(1).padStart(5)} s  ${e}`); };
    mark("head");
    const rect = (sel) => page.evaluate((x) => { const r = document.querySelector(x).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }, sel);
    await at(3); await go("#zone figure", "center"); mark("pipeline");
    await sleep(1500); t.figRect = await rect("#zone figure");
    await at(10); await go("#zone .zone-card", "start"); mark("attest");
    await at(16); await go("#zone .zone-card .sub-head", "start", 0); mark("event");
    await at(23); await go("#zone .zone-card .sub-head", "start", 1); mark("immutables");
    await at(28); await go("#zone .zone-card.again", "start"); mark("again");
    await sleep(1200); t.btnRect = await rect("#zone .again button.btn");
    await at(30.5);
    const before = await page.evaluate(() => document.querySelector("#zone .again .readat")?.textContent ?? "");
    await page.click("#zone .again button.btn");
    mark("click");
    await page.waitForFunction((b) => { const r = document.querySelector("#zone .again .readat")?.textContent ?? ""; return r && r !== b && document.querySelector("#zone .again .calls"); }, { timeout: 30000, polling: 50 }, before);
    mark("results");
    t.calledBefore = before; t.calledAfter = await page.evaluate(() => document.querySelector("#zone .again .readat").textContent);
    await at(S1.pageA); mark("endA");
    await go("#zone .isnot", "start");
    await at(S1.pageA + 1.5); mark("startB");
    await at(S1.pageA + 1.5 + S1.pageB + 0.5); mark("end");
    t.wall = (Date.now() - t0) / 1000;
    await recorder.stop();
    checkZoneText(await page.evaluate(() => document.querySelector("#zone").innerText), "after the click");
    const ca = t.calledAfter.match(/Called at (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) UTC/) ?? fail(`page: "${t.calledAfter}"`);
    const dt = Math.abs(Date.now() - Date.parse(ca[1].replace(" ", "T") + "Z")) / 1000;
    if (dt > 120) fail(`page: "Called at" is ${dt.toFixed(0)} s from now`);
    if (t.marks.results - t.marks.click > 10) fail(`"Verify again" took ${(t.marks.results - t.marks.click).toFixed(1)} s`);
  } finally { await browser.close(); }
  log(`• page: ✓ checks passed on load and after the click (${t.calledBefore} → ${t.calledAfter}); click → results ${(t.marks.results - t.marks.click).toFixed(2)} s`);
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
    for (let i = 0; i < 3; i++) { // absolute time (UTC), the explorer's own toggle
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
      // the event row: smallest element holding topic0 and the emitter but not the next event
      const tl = leaves.find((e) => e.textContent.trim().toLowerCase() === t0);
      let row = tl;
      while (row && !(row.innerText.toLowerCase().includes(zv) && row.innerText.includes("Show details"))) row = row.parentElement;
      if (!card || !to || !row || row.innerText.includes("Transfer")) return null;
      const c = card.getBoundingClientRect(), s = st.getBoundingClientRect(), t = to.getBoundingClientRect(), r = row.getBoundingClientRect();
      return { card: { x: c.left, y: s.top - 22, width: c.width, height: t.bottom + 20 - (s.top - 22) }, row: { x: r.left, y: r.top, width: r.width, height: r.height }, rowText: row.innerText, cardText: card.innerText };
    }, lc(topic0), lc(ZV));
    if (!clips) fail("explorer: transaction card or event row not found");
    if (!/UTC|\d\d:\d\d/.test(clips.cardText) || /ago/.test(clips.cardText)) log(`  ! explorer time is not absolute: ${clips.cardText.match(/Time[^\n]*\n[^\n]*/)?.[0]}`);
    const card = await p.screenshot({ clip: clips.card, encoding: "base64" });
    const row = await p.screenshot({ clip: clips.row, encoding: "base64" });
    return { card: `data:image/png;base64,${card}`, row: `data:image/png;base64,${row}`, cw: clips.card.width, ch: clips.card.height, rw: clips.row.width, rh: clips.row.height };
  } finally { await br.close(); }
}

// ── scene 2: the live take ──────────────────────────────────────────────────────────────────────
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
const roles = M.dep.roles;
const R500 = 500n * 10n ** BigInt(M.bondDecimals);
// reserve: the dishonest-demo provider reserved 500
const dres = swornEvent(await receipt(L.dishonestReserve, "dishonest reserve"), evSig("Reserved"), "dishonest reserve");
if (dres.coverage !== R500) fail(`dishonest reserve coverage ${dres.coverage}`);
const qBlock = Number(dres.blockNumber);
// payment: status 1; Transfer from the client to ReceivePolicyGuard; guard +500 / R′ +0 at block−1/block
const GUARD_SRC = "tempo/crates/contracts/src/precompiles/mod.rs";
const GUARD = getAddress((read(GUARD_SRC, "Tempo precompile addresses").match(/RECEIVE_POLICY_GUARD_ADDRESS: Address =\s*address!\("(0x[0-9a-fA-F]{40})"\)/) ?? fail(`${GUARD_SRC}: no RECEIVE_POLICY_GUARD_ADDRESS`))[1]);
const payR = await receipt(L.paymentDivertedToReceivePolicyGuard, "payment");
const payBlock = parseInt(payR.blockNumber, 16);
if (payBlock !== L.paymentBlock) fail(`payment block ${payBlock} != moderato.json`);
const payTx = await rpc("eth_getTransactionByHash", [L.paymentDivertedToReceivePolicyGuard]);
const transferAbi = parseAbi(["function transfer(address,uint256) returns (bool)", "event Transfer(address indexed from, address indexed to, uint256 amount)", "function balanceOf(address) view returns (uint256)"]);
const TOKEN = getAddress(payTx.to);
if (!payTx.input.startsWith(toFunctionSelector("transfer(address,uint256)"))) fail("payment is not a TIP-20 transfer(address,uint256)");
const RPRIME = getAddress("0x" + payTx.input.slice(34, 74));
const tdec = Number(await call(TOKEN, "decimals() view returns (uint8)"));
const bal = async (who, b) => call(TOKEN, "balanceOf(address) view returns (uint256)", [who], b);
const gDelta = (await bal(GUARD, payBlock)) - (await bal(GUARD, payBlock - 1));
const rDelta = (await bal(RPRIME, payBlock)) - (await bal(RPRIME, payBlock - 1));
if (gDelta !== 500n * 10n ** BigInt(tdec) || rDelta !== 0n) fail(`payment: guard Δ ${gDelta}, R′ Δ ${rDelta} (want +500 / 0)`);
// challenge: Slashed 500 to the client, client +500
const chR = await receipt(L.challengeTx, "challenge");
const chBlock = parseInt(chR.blockNumber, 16);
const sl = swornEvent(chR, evSig("Slashed"), "challenge");
if (sl.coverage !== R500 || getAddress(sl.client) !== getAddress(roles.client)) fail("challenge: Slashed is not 500 to the client");
const cDelta = (await call(M.bondToken, "balanceOf(address) view returns (uint256)", [roles.client], chBlock)) - (await call(M.bondToken, "balanceOf(address) view returns (uint256)", [roles.client], chBlock - 1));
if (cDelta !== R500) fail(`challenge: client Δ ${cDelta}`);
// the take's own clock: proving time (its burned-in label) and the speed-up span
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
log(`• take: reserve ${short(L.dishonestReserve)} 500 at question block ${qBlock}; payment ${short(L.paymentDivertedToReceivePolicyGuard)} block ${payBlock}: guard ${short(GUARD)} +${fmt2(gDelta, tdec)}, R′ ${short(RPRIME)} +${fmt2(rDelta, tdec)}; challenge ${short(L.challengeTx)} Slashed 500, client +${fmt2(cDelta, M.bondDecimals)}; proving ${mmss(realProve)}; speed-up ${sped.toFixed(1)} s → ${SPED_TO} s`);

// ── scene 3: honest card, recheck, Sworn.sol, eth_simulateV1 ────────────────────────────────────
const hres = swornEvent(await receipt(L.honestReserve, "honest reserve"), evSig("Reserved"), "honest reserve");
if (hres.coverage !== R500) fail("honest reserve coverage != 500");
const RECHECK = "out/e2e/moderato-20261003T064745Z-honestReverts-recheck.log";
const rc = read(RECHECK, "honest recheck log").split("\n");
const rcDiff = rc.find((l) => l.startsWith("[sworn-challenge] fields that differ: ")) ?? fail(`${RECHECK}: no "fields that differ"`);
const rcDry = rc.find((l) => /^\[sworn-challenge\] dry-run .*"error":"AnswerCorrect","reverted":true/.test(l)) ?? fail(`${RECHECK}: no AnswerCorrect dry-run line`);
if (rcDiff !== "[sworn-challenge] fields that differ: []") fail(`${RECHECK}: ${rcDiff}`);
const recheckLines = ["$ sworn-challenge --proof <real Groth16> --dry-run", "fields that differ: []", "dry-run (eth_call only, nothing sent):", `  ${rcDry.replace(/^.*nothing sent\): /, "")}`].join("\n");
const solL = sol.split("\n");
const iv = solL.findIndex((l) => /ISP1Verifier\(SP1_VERIFIER\)\.verifyProof\(GUEST_VKEY/.test(l));
const ia = solL.findIndex((l) => /revert AnswerCorrect\(\)/.test(l));
if (iv < 0 || ia !== iv + 1) fail(`Sworn.sol: verifyProof (line ${iv + 1}) is no longer immediately followed by AnswerCorrect (line ${ia + 1})`);
const solLines = [iv - 1, iv, ia].map((i) => `${String(i + 1).padStart(4)}  ${solL[i].trim().replace(/\s*\/\/.*$/, "")}`).join("\n");
const honestPng = path.join(repo, TAKE, "honest-card.png");
if (!existsSync(honestPng)) fail(`${TAKE}/honest-card.png is missing`);
// eth_simulateV1: the agent's own transfer (same calldata) at the question's block.
const sim = await rpc("eth_simulateV1", [{ blockStateCalls: [{ calls: [{ from: payTx.from, to: TOKEN, data: payTx.input }] }] }, "0x" + qBlock.toString(16)]);
const sc = sim?.[0]?.calls?.[0] ?? fail("eth_simulateV1 returned no call result");
if (sc.status !== "0x1") fail(`eth_simulateV1: status ${sc.status}`);
const tr = sc.logs.filter((l) => getAddress(l.address) === TOKEN && l.topics[0] === toEventSelector(transferAbi[1])).map((l) => decodeEventLog({ abi: transferAbi, data: l.data, topics: l.topics }).args);
const toGuard = tr.find((x) => getAddress(x.to) === GUARD && getAddress(x.from) === getAddress(payTx.from));
if (!toGuard || toGuard.amount !== 500n * 10n ** BigInt(tdec)) fail(`eth_simulateV1: no 500 Transfer to the guard (${JSON.stringify(tr, (k, v) => typeof v === "bigint" ? String(v) : v)})`);
if (tr.some((x) => getAddress(x.to) === RPRIME)) fail("eth_simulateV1: a Transfer reaches R′");
log(`• eth_simulateV1 at block ${qBlock}: status 1, Transfer ${fmt2(toGuard.amount, tdec)} → ReceivePolicyGuard, none to R′`);

// ── scene 4 ─────────────────────────────────────────────────────────────────────────────────────
for (const s of ["**The batch is not from Moderato.**", "Tempo's zones integration tests", "Unaudited.", "Traction: none.", "Revenue today: zero.", "`challenge()` pays the reserved coverage to the client"])
  if (!flat(readmeText).includes(flat(s))) fail(`README no longer says "${s}"`);
const repoUrl = ghRepoPublic("psyto/sworn", "repo");

const sym = await call(TOKEN, "symbol() view returns (string)");
const data = {
  scenes: ["e1", "d3a", "d3b", "d4"],
  exUrl: `explore.testnet.tempo.xyz/tx/${short(Z.attest.tx)}`,
  exTopic: `topic0 ${short(topic0, 6)} = keccak256 of ${zev.name}(…) from SwornZoneVerifier.sol`,
  exFrom: `contract ${short(ZV, 6)} = SwornZoneVerifier in deployments/moderato.json`,
  honestSrc: "the demo app, the same take", recheckSrc: RECHECK.replace(/^out\/e2e\//, ""), recheckLines, solLines,
  simAsk: `the agent's same transfer of 500 ${sym} to R′ ${short(RPRIME)}, as of block ${qBlock.toLocaleString("en-US")}`,
  simGot: `✓ status 1 · Transfer ${fmt2(toGuard.amount, tdec)} → ReceivePolicyGuard ${short(GUARD)}`,
  simNot: `R′ receives nothing · the transaction "succeeds"`,
  limitsSrc: "README: “What the Zone verifier is, and is not” · Status: Moderato testnet only, unaudited, traction none",
  repo: repoUrl, pageUrl: PAGE.replace(/^https:\/\//, "").replace(/\/$/, ""),
};
for (const [k, v] of Object.entries(data)) if (typeof v === "string") assertFresh(v, `slot ${k}`);

// ── PREVIEW: slides + overflow report, nothing recorded ─────────────────────────────────────────
const shots = await explorerShots();
data.exCard = shots.card; data.exEvent = shots.row;
data.honestShot = "data:image/png;base64," + readFileSync(honestPng).toString("base64");
log(`• explorer: card ${Math.round(shots.cw)}×${Math.round(shots.ch)}, event row ${Math.round(shots.rw)}×${Math.round(shots.rh)} (CSS px), header excluded`);
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
const pill1 = (main, sub) => `<span style="display:inline-block;background:#2b3078;color:#fff;padding:7px 16px;font-family:'Geist Mono',ui-monospace,Menlo,monospace;font-weight:500;font-size:15px;letter-spacing:.06em;text-transform:uppercase">${main} <span style="font-weight:400;font-size:11px;color:#d4d4d4">· ${sub}</span></span>`;
const pill = (main, sub) => `<span style="display:inline-block;background:#2b3078;color:#fff;padding:10px 20px;text-align:left;font-family:'Geist Mono',ui-monospace,Menlo,monospace;font-weight:500;font-size:17px;letter-spacing:.06em;text-transform:uppercase">${main}${sub ? `<br><span style="font-weight:400;font-size:12px;letter-spacing:.06em;color:#d4d4d4">${sub}</span>` : ""}</span>`;

const ENC = ["-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-crf", "20", "-preset", "slow", "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart"];
const ff = (args) => execFileSync(FFMPEG, ["-v", "error", ...args, "-y"]);

// ── scene 1 ─────────────────────────────────────────────────────────────────────────────────────
log("• scene 1: recording the published page …");
const pg = await capturePage();
const P = { prove: path.join(work, "pill-prove.png"), click: path.join(work, "pill-click.png"), speed: path.join(work, "pill-speed.png") };
const factor = sped / SPED_TO;
await pills([
  // page coordinates are 1024×576 CSS px; the pill page is 1280×720 → ×1.25. The proving pill sits in the
  // figure's empty bottom strip (where the hidden caption was), the click pill beside the button.
  { file: P.prove, pos: `top:${((pg.figRect.bottom - 32) * 1.25).toFixed(0)}px;left:0;right:0;text-align:center`, html: pill1(`${(cycles / 1e6).toFixed(1)}M cycles · Groth16 proof in ${Math.round(wall)} s, locally`, `proving log of this attest`) },
  { file: P.click, pos: `top:${(((pg.btnRect.top + pg.btnRect.bottom) / 2) * 1.25 - 26).toFixed(0)}px;left:${((pg.btnRect.right + 24) * 1.25).toFixed(0)}px`, html: pill(`“Verify again” clicked · live`, "the page also ran this check when it loaded") },
  { file: P.speed, pos: "top:150px;right:24px;text-align:right", html: pill(`×${factor.toFixed(1)} · MPP charge + reserve`, `this run: ${sped.toFixed(1)} s real → ${SPED_TO} s · sped up in the edit`) },
]);
const rawDur = duration(pg.raw);
const k = rawDur / pg.wall;
const K = (e) => pg.marks[e] * k;
const s1a = path.join(work, "s1a.mp4"), s1b = path.join(work, "s1b.mp4"), s1x = path.join(work, "s1x.mp4");
const proveOn = pg.hidCaption ? `enable='between(t,${K("pipeline").toFixed(2)},${K("attest").toFixed(2)})'` : "enable='0'";
const clickOn = `enable='between(t,${(K("click") - 0.5).toFixed(2)},${(K("click") + 6).toFixed(2)})'`;
ff(["-i", pg.raw, "-loop", "1", "-framerate", "30", "-i", P.prove, "-loop", "1", "-framerate", "30", "-i", P.click, "-filter_complex",
  `[0:v]fps=30,scale=1920:1080,setsar=1[b];[b][1:v]overlay=0:0:shortest=1:${proveOn}[c];[c][2:v]overlay=0:0:shortest=1:${clickOn},scale=in_range=full:out_range=tv,format=yuv420p[v]`,
  "-map", "[v]", "-an", "-t", String(S1.pageA), ...ENC, s1a]);
ff(["-ss", K("startB").toFixed(3), "-i", pg.raw, "-vf", "fps=30,scale=1920:1080,setsar=1,scale=in_range=full:out_range=tv,format=yuv420p", "-an", "-t", String(S1.pageB), ...ENC, s1b]);
await recordSlides({ html: "demo.html", data, ids: ["e1"], holds: [S1.explorer], raw: path.join(work, "s1x.raw.mp4"), out: s1x });
const scene1 = path.join(work, "scene1.mp4");
concat([s1a, s1x, s1b], scene1);
rmSync(pg.raw, { force: true });

// ── scene 2: the take, re-cut ───────────────────────────────────────────────────────────────────
log("• scene 2: re-cutting the take …");
const scene2 = path.join(work, "scene2.mp4");
const kept = BUY + SPED_TO + (takeDur - ANSWER);
if (kept > holds[1]) fail(`scene 2 picture ${kept.toFixed(1)} s > its ${holds[1]} s`);
ff(["-i", takeClip, "-loop", "1", "-framerate", "30", "-i", P.speed, "-filter_complex", [
  `[0:v]fps=30,scale=1920:1080,setsar=1,split=3[s0][s1][s2]`,
  `[s0]trim=0:${BUY},setpts=PTS-STARTPTS[a]`,
  `[s1]trim=${BUY}:${ANSWER},setpts=(PTS-STARTPTS)/${factor},fps=30[b0]`, `[b0][1:v]overlay=0:0:shortest=1[b]`,
  `[s2]trim=${ANSWER}:${takeDur},setpts=PTS-STARTPTS[c]`,
  `[a][b][c]concat=n=3:v=1:a=0,tpad=stop_mode=clone:stop_duration=${(holds[1] - kept + 1).toFixed(2)},format=yuv420p[v]`].join(";"),
  "-map", "[v]", "-an", "-t", String(holds[1]), ...ENC, scene2]);

// ── scenes 3–4: slides ──────────────────────────────────────────────────────────────────────────
const scene3 = path.join(work, "scene3.mp4"), scene4 = path.join(work, "scene4.mp4");
const S3 = [13, holds[2] - 13];
await recordSlides({ html: "demo.html", data, ids: ["d3a", "d3b"], holds: S3, raw: path.join(work, "s3.raw.mp4"), out: scene3 });
await recordSlides({ html: "demo.html", data, ids: ["d4"], holds: [holds[3]], raw: path.join(work, "s4.raw.mp4"), out: scene4 });

// ── assemble ────────────────────────────────────────────────────────────────────────────────────
const parts = [scene1, scene2, scene3, scene4];
parts.forEach((f, i) => { const d = duration(f); if (Math.abs(d - holds[i]) > 0.12) fail(`scene ${i + 1} clip is ${d} s, expected ${holds[i]} s`); });
const out = path.join(dir, "demo.mp4");
concat(parts, out);
const got = duration(out);
if (Math.abs(got - TOTAL) > 0.25) fail(`demo.mp4 is ${got} s, expected ${TOTAL} s`);
if (got > MAX_TOTAL) fail(`demo.mp4 is ${got} s > ${MAX_TOTAL} s`);
const starts = holds.reduce((acc, h) => [...acc, acc.at(-1) + h], [0]);
const cues = writeSrt(scenes, starts, path.join(dir, "demo.srt"));
// End-of-scene frames for review.
for (let i = 0; i < 4; i++) ff(["-ss", (starts[i + 1] - 0.2).toFixed(2), "-i", out, "-frames:v", "1", path.join(dir, "frames", `demo-scene${i + 1}.png`)]);
rmSync(path.join(dir, "frames", "demo-scene5.png"), { force: true }); // v1 had five scenes
const s1 = (e) => +(K(e)).toFixed(2);
writeJson(path.join(dir, "demo.marks.json"), {
  name: "demo", script: "video/DEMO.md", version: 2, holds, titles: scenes.map((s) => s.title), words: scenes.map((s) => s.words),
  page: PAGE, take: TAKE,
  scene1: { pageA: S1.pageA, explorer: S1.explorer, pageB: S1.pageB, marks: { pipeline: s1("pipeline"), attest: s1("attest"), event: s1("event"), immutables: s1("immutables"), again: s1("again"), click: s1("click"), results: s1("results") },
    calledAt: [pg.calledBefore, pg.calledAfter], hiddenCaption: pg.hidCaption },
  scene2: { kept: [[0, BUY], [ANSWER, +takeDur.toFixed(3)]], spedUp: { from: [BUY, ANSWER], realSecs: +sped.toFixed(2), shownSecs: SPED_TO }, timelapse: { realProve: L.provingRealTime, shownSecs: 10, burnedInBy: "the v1 edit of this take" }, heldLastFrame: +(holds[1] - kept).toFixed(2) },
  scene3: { slides: { d3a: S3[0], d3b: S3[1] }, simulateBlock: qBlock },
  note: "Silent. Read each scene's lines over its clip (video/scenes/demo/). Scene 1 pauses at the explorer insert; scene 2 has silent time at the time-lapse.",
  recordedAt: new Date().toISOString(),
});
log(`\n✓ ${rel(out)}  (${got.toFixed(2)} s, holds ${holds.join(" / ")})`);
log(`✓ video/demo.srt  (${cues} cues) · video/demo.marks.json · video/frames/demo-scene{1..4}.png`);
log(`  next: node video/split-scenes.mjs demo`);
