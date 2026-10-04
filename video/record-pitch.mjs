// Records video/pitch.mp4 — Sworn's ≤ 2 min CWF pitch v2, six scenes, SILENT, 1920×1080 — and
// video/pitch.srt with the narration of video/PITCH.md timed to where each scene landed.
//
//   node video/record-pitch.mjs            # then: node video/split-scenes.mjs pitch
//
// Scene holds come from PITCH.md (words ÷ 2.2 w/s, rounded up to 0.5 s). Every figure and quote on screen
// is read now from the source PITCH.md's claims table names; a missing or changed source THROWS:
//   Tempo's docs page (zones/proving.md) for both quoted sentences; tempoxyz/zones @ ac49071f via `gh api`
//   (README sentence, the reference Verifier.sol `return true`); the pinned checkout spikes/zone-spf/zones
//   (IVerifier.verify signature, NatSpec) against contracts/src/SwornZoneVerifier.sol (same selector);
//   deployments/moderato.json ↔ Moderato (SwornZoneVerifier codehash, the attest receipt and its decoded
//   ZoneBatchVerified event, the three slash receipts with Sworn's Slashed event); the explorer page of the
//   attest tx (screenshot cropped to the transaction card — no logo — plus its Events tab's topic0);
//   the proving log; the vendored zone_factory; README (T12 date, the "is not, yet" section);
//   patches/tempo.patch and spikes/zone-spf/patches/; GitHub (repos public); ethglobal.com.
// Reads only. No keys, no transactions.
import path from "node:path";
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseAbiItem, decodeEventLog, getAddress, formatUnits, toEventSelector, toFunctionSelector, keccak256 } from "viem";
import {
  dir, repo, read, fail, log, rel, short, EXPLORER, parseScenes, rpc, call, receipt, fetchText, ghFile, ghRepoPublic,
  moderato, recordSlides, checkOverflow, writeSrt, writeJson, duration, sleep,
} from "./lib/rec.mjs";

const MAX_TOTAL = 118;
const scenes = parseScenes("video/PITCH.md");
if (scenes.length !== 6) fail(`PITCH.md has ${scenes.length} scenes, expected 6`);
const TOTAL = scenes.reduce((a, s) => a + s.hold, 0);
log(`• pitch: scene holds (words ÷ 2.2 w/s, rounded up to 0.5 s)`);
for (const s of scenes) log(`    scene ${s.n}: ${String(s.words).padStart(3)} words → ${s.hold.toFixed(1)} s  (${s.title})`);
log(`    total ${TOTAL.toFixed(1)} s`);
if (TOTAL > MAX_TOTAL) fail(`pitch runs ${TOTAL} s > ${MAX_TOTAL} s — cut words in PITCH.md`);

const ZONES_REF = "ac49071f";
const ZONES_DIR = "spikes/zone-spf/zones";
const flat = (s) => s.replace(/\s+/g, " ").trim();

// ── scene 1: Tempo's own words ───────────────────────────────────────────────────────────────────
const zonesReadme = flat(ghFile("tempoxyz/zones", "README.md", "tempoxyz/zones README", ZONES_REF));
const ZONES_LINE = "Zones are private blockchains anchored to";
if (!zonesReadme.includes(ZONES_LINE)) fail(`tempoxyz/zones README @ ${ZONES_REF} no longer says "${ZONES_LINE}"`);
const DOCS = "https://tempo.xyz/developers/docs/protocol/zones/proving.md";
const docs = flat(await fetchText(DOCS, "Tempo docs (zones/proving)"));
if (!/^# Tempo Zone proving and settlement/.test(docs)) fail(`${DOCS}: title changed`);
const STUB = "The Zones Solidity reference verifier still returns `true` without checking execution.";
const ZK = "ZK proof generation is not implemented.";
const NITRO = "Tempo also implements a native Nitro attestation verifier";
for (const q of [STUB, ZK, NITRO]) if (!docs.includes(q)) fail(`${DOCS} no longer says "${q}"`);
const VERIFIER_SOL = "crates/contracts/src/runtime/tempo/Verifier.sol";
const vsol = ghFile("tempoxyz/zones", VERIFIER_SOL, "zones reference verifier", ZONES_REF).split("\n");
const vi = vsol.findIndex((l) => l.trim() === "return true;");
if (vi < 0) fail(`${VERIFIER_SOL} @ ${ZONES_REF} has no "return true;"`);
log(`• docs: both quotes present; ${VERIFIER_SOL}:${vi + 1} return true`);

// ── scene 2: the Zone proof on Moderato ──────────────────────────────────────────────────────────
const M = await moderato();
const Z = M.dep.SwornZoneVerifier ?? fail("moderato.json: no SwornZoneVerifier");
const ZV = getAddress(Z.address);
const zcode = await rpc("eth_getCode", [ZV, "latest"]);
if (keccak256(zcode) !== Z.codehash) fail("SwornZoneVerifier codehash on chain != moderato.json");
const zsol = read("contracts/src/SwornZoneVerifier.sol", "SwornZoneVerifier source");
const zev = parseAbiItem(`event ${flat(zsol.match(/event (ZoneBatchVerified\([^)]*\));/)?.[1] ?? fail("no ZoneBatchVerified in SwornZoneVerifier.sol"))}`);
const atR = await receipt(Z.attest.tx, "attest");
const atBlock = parseInt(atR.blockNumber, 16);
if (atBlock !== Z.attest.block) fail(`attest block ${atBlock} != moderato.json ${Z.attest.block}`);
const atLog = atR.logs.find((l) => getAddress(l.address) === ZV && l.topics[0] === toEventSelector(zev)) ?? fail("attest: no ZoneBatchVerified from SwornZoneVerifier");
const ev = decodeEventLog({ abi: [zev], data: atLog.data, topics: atLog.topics }).args;
// moderato.json's summary line must agree with what the chain says (prefixes / suffixes as written there).
const evLine = Z.attest.event;
const agrees = (label, v) => {
  const m = evLine.match(new RegExp(`${label} (0x[0-9a-f]+)…([0-9a-f]+)`));
  if (!m || !v.startsWith(m[1]) || !v.endsWith(m[2])) fail(`attest event ${label} ${v} disagrees with moderato.json "${evLine}"`);
};
agrees("prevBlockHash", ev.prevBlockHash); agrees("nextBlockHash", ev.nextBlockHash); agrees("digest", ev.digest);
if (!evLine.includes(`zoneId ${ev.zoneId}`) || !evLine.includes(`nextZoneHeight ${ev.nextZoneHeight}`)) fail("attest event zoneId/height disagree with moderato.json");
const fx = JSON.parse(read(Z.attest.fixture, "zone fixture"));
if (fx.digest.toLowerCase() !== ev.digest.toLowerCase()) fail("attest digest != fixture digest");
log(`• attest ${short(Z.attest.tx)} block ${atBlock}: ZoneBatchVerified zone ${ev.zoneId} height ${ev.nextZoneHeight} digest ${short(ev.digest)}`);

// verify(…) in SwornZoneVerifier has IVerifier.verify's selector, taken from the pinned zones checkout.
const head = execFileSync("git", ["-C", path.join(repo, ZONES_DIR), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!head.startsWith(ZONES_REF)) fail(`${ZONES_DIR} is at ${head}, not ${ZONES_REF}`);
const IZONE = `${ZONES_DIR}/crates/contracts/src/runtime/interfaces/IZone.sol`;
const izone = read(IZONE, "zones IZone.sol");
function verifySelector(src, what) {
  const strip = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const structs = {};
  for (const m of strip.matchAll(/struct (\w+)\s*\{([^}]*)\}/g))
    structs[m[1]] = m[2].split(";").map((f) => f.trim().split(/\s+/)[0]).filter(Boolean);
  const body = (strip.match(/function verify\(([^)]*)\)/) ?? fail(`${what}: no verify(`))[1];
  const ty = (t) => (structs[t] ? `(${structs[t].map(ty).join(",")})` : t);
  const types = body.split(",").map((p) => ty(p.trim().split(/\s+/)[0]));
  return { sel: toFunctionSelector(`verify(${types.join(",")})`), n: types.length };
}
const a = verifySelector(izone, IZONE), b = verifySelector(zsol, "SwornZoneVerifier.sol");
if (a.sel !== b.sel) fail(`verify selector differs: zones ${a.sel} vs Sworn ${b.sel}`);
log(`• verify selector ${a.sel} (${a.n} params) = IVerifier.verify @ ${ZONES_REF}`);

const plog = read(Z.attest.proving.log, "Zone proving log");
const cycles = +(plog.match(/cycles\(total_instruction_count\): (\d+)/) ?? fail("proving log: no cycle count"))[1];
const wall = +(plog.match(/PROVE groth16 wall: ([\d.]+)s/) ?? fail("proving log: no groth16 wall time"))[1];
if (cycles !== Z.attest.proving.cycles) fail(`proving log cycles ${cycles} != moderato.json`);

// The explorer, captured now, cropped to its transaction card (the site header carries Tempo's wordmark).
const exUrl = `${EXPLORER}/tx/${Z.attest.tx}`;
const topic0 = toEventSelector(zev);
async function explorerShot() {
  const { default: puppeteer } = await import("puppeteer");
  const br = await puppeteer.launch({ headless: true, timeout: 180000, args: ["--no-sandbox", "--hide-scrollbars"], defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 2 } });
  try {
    const p = await br.newPage();
    await p.emulateTimezone("UTC");
    await p.goto(`${exUrl}?tab=events`, { waitUntil: "networkidle2", timeout: 120000 });
    await p.waitForFunction((t) => document.body.innerText.includes("Success") && document.body.innerText.toLowerCase().includes(t), { timeout: 90000 }, topic0.toLowerCase());
    const text = await p.evaluate(() => document.body.innerText);
    for (const want of [Z.attest.tx.toLowerCase(), String(atBlock), "success", topic0.toLowerCase(), ZV.toLowerCase()])
      if (!text.toLowerCase().includes(want)) fail(`explorer page does not show ${want}`);
    // Absolute time (UTC) instead of "N min. ago": the explorer's own toggle, clicked until it leaves "relative".
    for (let i = 0; i < 3; i++) {
      const t = await p.evaluate(() => { const b = document.querySelector('button[title^="Showing "][title$="click to change"]'); return b ? b.title : null; });
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

// Three slashes by the same engine.
const sol = read("contracts/src/Sworn.sol", "Sworn source");
const slashedEv = parseAbiItem(`event ${flat(sol.match(/^\s*event (Slashed\([^)]*\));/m)?.[1] ?? fail("Sworn.sol declares no Slashed"))}`);
const slashTxs = [M.dep.firstSlash.challengeTx, M.dep.demoLiveTakeFirst.challengeTx, M.dep.demoLiveTake.challengeTx];
const fmt = (v, d) => { const [i, f = ""] = formatUnits(v, d).split("."); return `${i}.${(f + "00").slice(0, 2)}`; };
const slashes = [];
for (const tx of slashTxs) {
  const r = await receipt(tx, "slash");
  const lg = r.logs.find((l) => getAddress(l.address) === M.SWORN && l.topics[0] === toEventSelector(slashedEv)) ?? fail(`${tx}: no Slashed from Sworn`);
  const args = decodeEventLog({ abi: [slashedEv], data: lg.data, topics: lg.topics }).args;
  slashes.push([`${short(tx)} · block ${parseInt(r.blockNumber, 16).toLocaleString("en-US")}`, `+${fmt(args.coverage, M.bondDecimals)} ${M.bondSymbol} to the client`]);
}
log(`• slashes: ${slashTxs.map((t) => short(t)).join(", ")} — Slashed from Sworn, status 1`);

// ── scene 3 ──────────────────────────────────────────────────────────────────────────────────────
const nat = izone.match(/\/\/\/\s+1\. (Valid state transition[^\n]*)[\s\S]*?\/\/\/\s+6\. ([^\n]*withdrawalQueueHash[^\n]*)/) ?? fail(`${IZONE}: IVerifier NatSpec changed`);

// ── scene 4 ──────────────────────────────────────────────────────────────────────────────────────
const FACTORY = "tempo/crates/precompiles/src/zone_factory/mod.rs";
const fac = read(FACTORY, "vendored zone_factory").split("\n");
const fv = fac.findIndex((l) => l.trim() === "verifier: ZONE_VERIFIER_ADDRESS,");
const fo = fac.findIndex((l) => l.includes("if msg_sender != self.owner()?"));
if (fv < 0 || fo < 0) fail(`${FACTORY}: verifier assignment or owner check moved`);
const readme = read("README.md", "README");
const t12 = readme.match(/T12, activates at (\d{4}-\d\d-\d\d \d\d:\d\d UTC)/) ?? fail("README: no T12 activation date");

// ── scene 5 ──────────────────────────────────────────────────────────────────────────────────────
const tp = read("patches/tempo.patch", "tempo.patch");
const ids = [...new Set([...tp.matchAll(/SPIKE-PATCH-(\d+)/g)].map((m) => +m[1]))].sort();
if (ids.join() !== "1,2,3") fail(`patches/tempo.patch SPIKE-PATCH ids ${ids}`);
const zp = readdirSync(path.join(repo, "spikes/zone-spf/patches")).filter((f) => f.endsWith(".patch")).sort();
const zkvm = zp.filter((f) => /-zkvm\.patch$/.test(f));
if (zkvm.length !== 4) fail(`spikes/zone-spf/patches: ${zkvm.length} *-zkvm.patch files, expected 4`);
const rethlabRepo = ghRepoPublic("psyto/rethlab", "rethlab");
const EG = "https://ethglobal.com/showcase/reckn-47t6m";
const eg = (await fetchText(EG, "ETHGlobal showcase")).replace(/<!-- -->/g, "");
const prize = eg.match(/<h4[^>]*>\s*(Uniswap Foundation)\s*-\s*(.*?)\s*(3rd place)\s*<\/h4>/) ?? fail(`${EG}: no "Uniswap Foundation … 3rd place" prize`);
if (!/ETHGlobal Tokyo 2026/.test(eg)) fail(`${EG}: does not say ETHGlobal Tokyo 2026`);

// ── scene 6 ──────────────────────────────────────────────────────────────────────────────────────
for (const s of ["## What the Zone verifier is, and is not", "**The batch is not from Moderato.**", "Tempo's zones integration tests"])
  if (!flat(readme).includes(flat(s))) fail(`README no longer says "${s}"`);
const repoUrl = ghRepoPublic("psyto/sworn", "repo");
log(`• README limits section present; ${repoUrl} public; ETHGlobal: ${prize[1]} ${prize[3]}`);

const data = {
  scenes: ["p1", "p2", "p3", "p4", "p5", "p6"],
  zonesLine: `Tempo Zones: “${ZONES_LINE} Tempo.”`,
  zonesSrc: `tempoxyz/zones README @ ${ZONES_REF} · GitHub API, read while recording`,
  docStub: STUB.replace(/`/g, ""), stubLine: `tempoxyz/zones · ${VERIFIER_SOL}:${vi + 1}   return true;`,
  docsSrc: DOCS.replace(/^https:\/\//, "").replace(/\.md$/, ""), docZk: ZK,

  proveSrc: `zone_spf::prove_zone_batch from tempoxyz/zones @ ${ZONES_REF} · ${cycles.toLocaleString("en-US")} cycles · Groth16 in ${Math.round(wall)} s, locally`,
  atStatus: "✓ status 1 · ZoneBatchVerified emitted", atTx: short(Z.attest.tx, 8),
  atBlock: `${atBlock.toLocaleString("en-US")} · ${parseInt(atR.gasUsed, 16).toLocaleString("en-US")} gas`,
  evZone: String(ev.zoneId), evHeight: String(ev.nextZoneHeight),
  evPrev: short(ev.prevBlockHash, 10), evNext: short(ev.nextBlockHash, 10), evDigest: short(ev.digest, 10),
  sigSrc: `verify(…) selector ${a.sel} = Tempo's IVerifier.verify (${a.n} inputs) · codehash matches deployment`,
  exUrl: `explore.testnet.tempo.xyz/tx/${short(Z.attest.tx)}`, exShot: shot.png,
  exNote: `captured while recording · its Events tab: topic0 ${short(topic0, 6)} = ZoneBatchVerified`,
  slash1: slashes[0][0], paid1: slashes[0][1], slash2: slashes[1][0], paid2: slashes[1][1], slash3: slashes[2][0], paid3: slashes[2][1],

  ivSrc: `Tempo's IVerifier: “The proof validates: 1. ${nat[1].trim()} … 6. ${nat[2].trim()}”`,
  nitroSrc: "Tempo's native Nitro attestation verifier",

  factorySrc: `Tempo picks the verifier: ${FACTORY}:${fv + 1}  verifier: ZONE_VERIFIER_ADDRESS  · zones created by the factory owner only (:${fo + 1})`,
  upgradeSrc: `Next Tempo upgrade: T12 on Moderato, ${t12[1]} · Sworn's answerer stops there until its guest is re-checked (README)`,

  rethlab: `rethlab — Reth source-reading courses · ${rethlabRepo}`,
  ethglobal: `ETHGlobal Tokyo 2026 — ${prize[1]}, ${prize[3]}`,
  ethglobalSrc: `with Reckn · ${prize[2].trim()} · ${EG.replace(/^https:\/\//, "")}`,
  patchTempo: `patches/tempo.patch — SPIKE-PATCH-1, -2, -3`,
  patchZone: `spikes/zone-spf/patches/ — ${[...zkvm.filter((f) => /^(tempo|zones)-/.test(f)), ...zkvm.filter((f) => !/^(tempo|zones)-/.test(f))].map((f) => f.replace(/\.patch$/, "")).join(" · ")}`,

  limitsSrc: "README: “What the Zone verifier is, and is not” · Moderato is Tempo's testnet",
  repo: repoUrl,
};

// ── layout check, then record ────────────────────────────────────────────────────────────────────
// PREVIEW=<dir>: write one PNG per scene (everything faded in) and the overflow report, record nothing.
if (process.env.PREVIEW) {
  const { launch } = await import("./lib/rec.mjs");
  const { mkdirSync } = await import("node:fs");
  const outDir = path.resolve(process.env.PREVIEW);
  mkdirSync(outDir, { recursive: true });
  const br = await launch();
  try {
    const page = await br.newPage();
    await page.goto("file://" + path.join(dir, "pitch.html"), { waitUntil: "load" });
    await page.evaluate((d) => window.__fill(d), data);
    await page.evaluate(() => document.fonts.ready);
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
const starts = scenes.reduce((acc, s) => [...acc, acc.at(-1) + s.hold], [0]);
const cues = writeSrt(scenes, starts, path.join(dir, "pitch.srt"));
writeJson(path.join(dir, "pitch.marks.json"), {
  name: "pitch", script: "video/PITCH.md", version: 2, holds: scenes.map((s) => s.hold), titles: scenes.map((s) => s.title),
  recorderMarks: marks.map((m) => +m.toFixed(3)), recordedAt: new Date().toISOString(),
});
log(`\n✓ ${rel(out)}  (${got.toFixed(2)} s, holds ${scenes.map((s) => s.hold).join(" / ")})`);
log(`✓ video/pitch.srt  (${cues} cues)`);
log(`  next: node video/split-scenes.mjs pitch`);
