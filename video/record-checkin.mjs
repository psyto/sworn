// Records video/checkin-3-<A|B>.mp4 — Sworn's one-minute check-in 3, three scenes, SILENT — and
// video/checkin-3-<A|B>.srt with the narration timed to where the scenes actually landed.
//
//   VARIANT=B node video/record-checkin.mjs
//   VARIANT=A SLASH_TX=0x… node video/record-checkin.mjs
//
// The discipline (from Confide's record-checkin.js):
//   - scene holds come from the script's own words, not from numbers repeated here;
//   - every figure on screen is read at record time from its source, and a source that is missing
//     or does not say what it is expected to say THROWS — nothing stale, nothing placeholder;
//   - variant A says "this transaction, on Moderato", so it refuses to record without one: SLASH_TX
//     must be a status-1 receipt on Moderato carrying Sworn's Slashed event from the deployed Sworn.
// Reads only: eth_call / eth_getCode / eth_getTransactionReceipt. No keys, no transactions.
import path from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  parseAbi, parseAbiItem, decodeEventLog, encodeFunctionData, decodeFunctionResult,
  keccak256, formatUnits, getAddress, isHex, toEventSelector,
} from "viem";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(dir, "..");
const FFMPEG = process.env.FFMPEG_PATH || "/opt/homebrew/bin/ffmpeg";
const RPC = "https://rpc.moderato.tempo.xyz";
const EXPLORER = "https://explore.testnet.tempo.xyz";
const WPS = 2.2;           // words per second of the founder's narration
const MAX_TOTAL = 58;      // seconds; the check-in is one minute
const log = (s) => process.stderr.write(s + "\n");
const fail = (s) => { throw new Error(s); };
const rel = (p) => path.relative(repo, p);
const read = (p, what) => {
  const f = path.join(repo, p);
  if (!existsSync(f)) fail(`${what}: ${p} is missing`);
  return readFileSync(f, "utf8");
};

const VARIANT = process.env.VARIANT;
if (VARIANT !== "A" && VARIANT !== "B") fail(`VARIANT must be A or B (got ${JSON.stringify(VARIANT)})`);

// ── 1. the script: three scenes, their narration, their holds ────────────────────────────────────
const md = read("video/CHECKIN-3.md", "script");
const sec = md.split(/^## /m).find((s) => s.startsWith(`Variant ${VARIANT}`));
if (!sec) fail(`CHECKIN-3.md has no "## Variant ${VARIANT}" section`);
const scenes = sec.split(/^\*\*\[Screen /m).slice(1).map((chunk) => {
  const head = chunk.match(/^(\d+) — ([^\]]*)\]\*\*/);
  if (!head) fail(`Variant ${VARIANT}: unreadable screen note "${chunk.slice(0, 60)}…"`);
  const text = chunk.split("\n").filter((l) => l.startsWith("> ")).map((l) => l.slice(2).trim()).join(" ");
  const words = text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  if (!words) fail(`Variant ${VARIANT}, screen ${head[1]}: no narration`);
  return { n: +head[1], note: head[2], text, words, hold: Math.ceil((words / WPS) * 2) / 2 };
});
if (scenes.length !== 3) fail(`Variant ${VARIANT} has ${scenes.length} scenes, expected exactly 3`);
const TOTAL = scenes.reduce((a, s) => a + s.hold, 0);
log(`• variant ${VARIANT}: scene holds (words ÷ ${WPS} w/s, rounded up to 0.5 s)`);
for (const s of scenes) log(`    scene ${s.n}: ${String(s.words).padStart(3)} words → ${s.hold.toFixed(1)} s`);
log(`    total ${TOTAL.toFixed(1)} s`);
if (TOTAL > MAX_TOTAL) fail(`variant ${VARIANT} runs ${TOTAL} s > ${MAX_TOTAL} s — cut words`);

// ── 2. the chain: one JSON-RPC helper, reads only ─────────────────────────────────────────────────
let rpcId = 0;
async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  if (!res.ok) fail(`${RPC} ${method}: HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) fail(`${RPC} ${method}: ${j.error.message}`);
  return j.result;
}
async function call(to, sig) {
  const abi = parseAbi([`function ${sig}`]);
  const name = sig.slice(0, sig.indexOf("("));
  const data = await rpc("eth_call", [{ to, data: encodeFunctionData({ abi, functionName: name }) }, "latest"]);
  return decodeFunctionResult({ abi, functionName: name, data });
}

// ── 3. deployments/moderato.json, checked against the chain ──────────────────────────────────────
const dep = JSON.parse(read("deployments/moderato.json", "deployments"));
const SWORN = getAddress(dep?.Sworn?.address ?? fail("moderato.json: no Sworn.address"));
const VERIFIER_JSON = getAddress(dep?.SP1VerifierGroth16?.address ?? fail("moderato.json: no SP1VerifierGroth16.address"));
const chainId = parseInt(await rpc("eth_chainId", []), 16);
if (chainId !== dep.chainId) fail(`RPC chainId ${chainId} != moderato.json chainId ${dep.chainId}`);
const code = await rpc("eth_getCode", [SWORN, "latest"]);
if (!code || code === "0x") fail(`no code at Sworn ${SWORN} on Moderato`);
if (keccak256(code) !== dep.Sworn.codehash) fail(`Sworn codehash on chain ${keccak256(code)} != moderato.json ${dep.Sworn.codehash}`);
const vkey = await call(SWORN, "GUEST_VKEY() view returns (bytes32)");
const verifier = getAddress(await call(SWORN, "SP1_VERIFIER() view returns (address)"));
if (verifier !== VERIFIER_JSON) fail(`Sworn.SP1_VERIFIER ${verifier} != moderato.json ${VERIFIER_JSON}`);
const vcode = await rpc("eth_getCode", [verifier, "latest"]);
if (keccak256(vcode) !== dep.SP1VerifierGroth16.codehash) fail(`verifier codehash on chain != moderato.json`);
const verifierVersion = await call(verifier, "VERSION() pure returns (string)");
const bondToken = getAddress(await call(SWORN, "BOND_TOKEN() view returns (address)"));
const decimals = Number(await call(bondToken, "decimals() view returns (uint8)"));
const symbol = await call(bondToken, "symbol() view returns (string)");
const deployRcpt = await rpc("eth_getTransactionReceipt", [dep.Sworn.tx]);
if (!deployRcpt || deployRcpt.status !== "0x1" || getAddress(deployRcpt.contractAddress ?? "0x0000000000000000000000000000000000000000") !== SWORN)
  fail(`moderato.json Sworn.tx ${dep.Sworn.tx} is not a successful deployment of ${SWORN}`);
log(`• Moderato: Sworn ${SWORN} codehash ok, GUEST_VKEY ${vkey}, SP1_VERIFIER ${verifier} (${verifierVersion}), bond ${symbol}`);

// ── 4. variant A's guard: the real slash, or nothing ─────────────────────────────────────────────
// The Slashed signature is read from the contract source and cross-checked against the demo's
// generated ABI, so a renamed or re-shaped event cannot pass on a stale copy.
let slash = null;
if (VARIANT === "A") {
  const tx = process.env.SLASH_TX;
  if (!tx) fail("variant A refused: SLASH_TX is not set. A says \"this transaction, on Moderato\" — record B until the slash exists.");
  if (!isHex(tx) || tx.length !== 66) fail(`variant A refused: SLASH_TX ${tx} is not a 32-byte tx hash`);
  const sol = read("contracts/src/Sworn.sol", "Sworn source");
  const ev = sol.match(/^\s*event Slashed\(([^)]*)\);/m) ?? fail("contracts/src/Sworn.sol declares no Slashed event");
  const slashedAbi = parseAbiItem(`event Slashed(${ev[1].replace(/\s+/g, " ").trim()})`);
  const genAbi = JSON.parse(read("demo/src/chain/sworn.abi.ts", "generated ABI")
    .replace(/^[\s\S]*?export const swornAbi = /, "").replace(/\]\s*as const;?\s*$/, "]"));
  const genEv = genAbi.find((x) => x.type === "event" && x.name === "Slashed") ?? fail("sworn.abi.ts has no Slashed event");
  if (toEventSelector(genEv) !== toEventSelector(slashedAbi)) fail("Slashed in Sworn.sol and sworn.abi.ts disagree — regenerate the ABI");
  const r = await rpc("eth_getTransactionReceipt", [tx]);
  if (!r) fail(`variant A refused: no receipt for ${tx} on Moderato`);
  if (r.status !== "0x1") fail(`variant A refused: ${tx} has status ${r.status}, not 1`);
  const topic0 = toEventSelector(slashedAbi);
  const lg = r.logs.find((l) => getAddress(l.address) === SWORN && l.topics[0] === topic0);
  if (!lg) fail(`variant A refused: ${tx} emits no Slashed event from Sworn ${SWORN}`);
  const d = decodeEventLog({ abi: [slashedAbi], data: lg.data, topics: lg.topics }).args;
  // The narration also says Tempo's receive policy diverted the payment. CHECKIN-3.md's claims
  // table allows that only if the Moderato run that produced this slash passed
  // S-2.trueAnswerIsDiversion — so the run's log must name this tx and that check.
  const logs = readdirSync(path.join(repo, "out/e2e")).filter((f) => /^moderato-.*\.log$/.test(f) && !/dry-run/.test(f));
  const runLog = process.env.MODERATO_LOG ?? (logs.length ? path.join("out/e2e", logs.sort().at(-1)) : null);
  if (!runLog) fail("variant A refused: no out/e2e/moderato-*.log (set MODERATO_LOG) to show S-2.trueAnswerIsDiversion");
  const rl = read(runLog, "Moderato run log");
  if (!/^CHECK S-2\.trueAnswerIsDiversion PASS/m.test(rl)) fail(`variant A refused: ${runLog} has no "CHECK S-2.trueAnswerIsDiversion PASS"`);
  if (!new RegExp(`^CHECK S-2\\.challengePays PASS .*${tx}`, "mi").test(rl)) fail(`variant A refused: ${runLog} does not name ${tx} in S-2.challengePays`);
  slash = {
    slashTx: tx, slashUrl: `${EXPLORER}/tx/${tx}`, slashBlock: parseInt(r.blockNumber, 16).toLocaleString("en-US"),
    slashStatus: "status 1", slashClient: d.client, slashServer: d.server,
    paid: `${formatUnits(d.coverage, decimals)} ${symbol}`,
  };
  log(`• slash: ${tx} status 1, Slashed from Sworn, paid ${slash.paid} to ${d.client} (${runLog})`);
}

// ── 5. the logs ──────────────────────────────────────────────────────────────────────────────────
const ac2 = (read("out/ac2_run.log", "AC-2 log").match(/^AC-2: matched .*$/gm) ?? fail("out/ac2_run.log has no \"AC-2: matched\" line")).at(-1);
const ac2m = ac2.match(/^AC-2: matched (\d+) \/ (\d+) \((.*)\)$/) ?? fail(`unexpected AC-2 line: ${ac2}`);
if (ac2m[1] !== ac2m[2]) fail(`AC-2 matched ${ac2m[1]} of ${ac2m[2]} — the replay does not all match`);
log(`• ${ac2}`);

const LOCAL = "out/e2e/localnet-full-gate.log";
const local = read(LOCAL, "localnet log").split("\n");
const jsonAfter = (line, label) => JSON.parse(line.slice(line.indexOf(label) + label.length));
// The out-of-gas lesson: the proven true answer used the whole limit and failed, and the limit
// itself is the question's gasLimit. Both lines are quoted with their line numbers.
// The demo's gas limit is read from the honest response (the dishonest response line does not echo the
// question). Both questions used the same DEFAULT_GAS_LIMIT, and the check below requires the blocked
// transfer's proven gasUsed to equal it exactly — so the label says 'both questions', not 'honest'.
const iLimit = local.findIndex((l) => /(^|[^s])honest response: /.test(l) && /"gasLimit":"\d+"/.test(l));
if (iLimit < 0) fail(`${LOCAL}: no honest response line carrying the question's gasLimit`);
if (iLimit < 0) fail(`${LOCAL}: no honest response line with a gasLimit`);
const limit = jsonAfter(local[iLimit], "honest response: ").question.gasLimit;
const iOog = local.findIndex((l) => /challenge result: /.test(l) && !/honest challenge/.test(l));
if (iOog < 0) fail(`${LOCAL}: no challenge result line`);
const ta = jsonAfter(local[iOog], "challenge result: ").trueAnswer ?? fail(`${LOCAL}:${iOog + 1}: no trueAnswer`);
if (ta.gasUsed !== limit || ta.success !== false)
  fail(`${LOCAL}:${iOog + 1}: proven answer gasUsed ${ta.gasUsed} success ${ta.success} — not an out-of-gas at the ${limit} limit`);
const gasLines = [
  `line ${iLimit + 1}  demo gas limit (both questions)   gasLimit ${limit}`,
  `line ${iOog + 1}  blocked transfer · proven answer  gasUsed  ${ta.gasUsed}   success ${ta.success}`,
].join("\n");
log(`• gas: limit ${limit} (line ${iLimit + 1}), proven gasUsed ${ta.gasUsed} success false (line ${iOog + 1})`);
const slashLineRaw = local.find((l) => /^CHECK S-2\.challengePays PASS /.test(l)) ?? fail(`${LOCAL}: no "CHECK S-2.challengePays PASS"`);
const sl = slashLineRaw.match(/challenge tx (0x[0-9a-f]{64}) status (0x1), Slashed event true, client (\S+) \+(\d+) \(coverage (\d+)\)/)
  ?? fail(`${LOCAL}: unexpected S-2.challengePays line: ${slashLineRaw}`);
const slashLine = [
  "CHECK S-2.challengePays PASS",
  `  challenge tx ${sl[1].slice(0, 18)}…${sl[1].slice(-6)}  status ${sl[2]}`,
  `  Slashed event true · client ${sl[3]} +${sl[4]} (coverage ${sl[5]})`,
].join("\n");

// The gate. scripts/check-e2e.sh is run as committed at HEAD by default (GATE=worktree runs the
// working-tree copy). It must print verdict PASS with every required item "ok".
const GATE = process.env.GATE ?? "head";
const env = { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", TERM: "dumb" };
let gateOut, gateRev;
try {
  if (GATE === "worktree") {
    gateRev = "working tree";
    gateOut = execFileSync("bash", ["scripts/check-e2e.sh", "--log", LOCAL], { cwd: repo, encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] });
  } else if (GATE === "head") {
    gateRev = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
    const src = execFileSync("git", ["show", "HEAD:scripts/check-e2e.sh"], { cwd: repo, encoding: "utf8" });
    // $0 = scripts/check-e2e.sh so the script's own `cd "$(dirname "$0")/.."` lands on the repo.
    gateOut = execFileSync("bash", ["-c", src, "scripts/check-e2e.sh", "--log", LOCAL], { cwd: repo, encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] });
  } else fail(`GATE must be head or worktree (got ${GATE})`);
} catch (e) {
  if (e.stdout !== undefined) fail(`scripts/check-e2e.sh (${gateRev}) --log ${LOCAL} failed:\n${String(e.stdout).split("\n").filter((l) => !/^ok /.test(l)).join("\n")}`);
  throw e;
}
gateOut = gateOut.replace(/\u001b\[[0-9;]*m/g, "");
const gm = gateOut.match(/required: (\d+)\s+verdict: (\w+)/) ?? fail("check-e2e.sh printed no verdict line");
const oks = (gateOut.match(/^ok\s+\S+/gm) ?? []).length;
if (gm[2] !== "PASS" || oks !== +gm[1] || /^MISSING|^a check FAILED/m.test(gateOut))
  fail(`check-e2e.sh (${gateRev}): ${oks} ok of ${gm[1]} required, verdict ${gm[2]}`);
log(`• gate (check-e2e.sh @ ${gateRev}): ${oks} / ${gm[1]} PASS`);

// ── 6. the real-proof forge test, run now (build output kept inside video/) ──────────────────────
let forge = "";
if (VARIANT === "B") {
  log("• forge test --match-path test/RealGroth16.t.sol …");
  let out;
  try {
    out = execFileSync("forge", ["test", "--match-path", "test/RealGroth16.t.sol",
      "--out", path.join(dir, ".forge/out"), "--cache-path", path.join(dir, ".forge/cache")],
      { cwd: path.join(repo, "contracts"), encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) { fail(`forge test failed:\n${e.stdout ?? ""}${e.stderr ?? ""}`); }
  out = out.replace(/\u001b\[[0-9;]*m/g, "");
  const passes = out.match(/^\[PASS\] \S+/gm) ?? [];
  const sum = out.match(/^Ran \d+ test suites?.*?: (\d+) tests passed, (\d+) failed, (\d+) skipped/m) ?? fail("forge printed no summary");
  if (!passes.length || sum[2] !== "0" || +sum[1] !== passes.length) fail(`forge: ${sum[0]}`);
  forge = [...passes.map((p) => p.replace(/\(\)$/, "")), `${sum[1]} passed, ${sum[2]} failed`].join("\n");
  log(`• forge: ${sum[1]} passed, ${sum[2]} failed`);
}

// ── 7. the one-line claim, from the README's opening line ────────────────────────────────────────
const claim = (read("README.md", "README").match(/^\*\*(.+)\*\*\s*$/m) ?? fail("README.md has no bold one-line claim"))[1];

const data = {
  scenes: ["s1", `s2${VARIANT}`, "s3"],
  claim, network: dep.network, chainId: String(chainId),
  sworn: SWORN, swornTx: dep.Sworn.tx, swornUrl: `${EXPLORER}/address/${SWORN}`, vkey,
  verifier, verifierVersion: `SP1 Groth16 ${verifierVersion}`,
  forge, slashLine, gateCount: `${oks} / ${gm[1]}`, gateVerdict: "PASS",
  ac2: `${ac2m[1]} / ${ac2m[2]}`, ac2Src: `out/ac2_run.log · ${ac2m[3]}`,
  gasLines, ...(slash ?? {}),
};

// ── 8. record ────────────────────────────────────────────────────────────────────────────────────
const { default: puppeteer } = await import("puppeteer");
const { PuppeteerScreenRecorder } = await import("puppeteer-screen-recorder");
const outFile = path.join(dir, `checkin-3-${VARIANT}.mp4`);
const rawFile = path.join(dir, `checkin-3-${VARIANT}.raw.mp4`);
const browser = await puppeteer.launch({
  timeout: 120000, // other agents prove SP1 on this machine; a loaded host can take >30 s to open the first tab
  headless: true, // Chromium 107 (puppeteer 19) predates --headless=new; "new" hangs at launch
  defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1.5 },
  args: ["--no-sandbox", "--hide-scrollbars", "--window-size=1280,720", "--force-device-scale-factor=1.5"],
});
const page = await browser.newPage();
await page.goto("file://" + path.join(dir, "checkin-3.html"), { waitUntil: "load" });
await page.evaluate((d) => window.__fill(d), data); // throws on any empty slot
const recorder = new PuppeteerScreenRecorder(page, {
  fps: 30, videoFrame: { width: 1920, height: 1080 }, aspectRatio: "16:9", ffmpeg_Path: FFMPEG,
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await recorder.start(rawFile);
const t0 = Date.now();
const marks = [];
for (const [i, id] of data.scenes.entries()) {
  marks.push((Date.now() - t0) / 1000);
  page.evaluate((x) => window.__show(x), id); // fades run in the page while the hold elapses
  const end = scenes.slice(0, i + 1).reduce((a, s) => a + s.hold, 0) * 1000;
  await sleep(Math.max(0, end - (Date.now() - t0)));
}
marks.push((Date.now() - t0) / 1000);
await recorder.stop();
await browser.close();

log("• encoding (silent, 1920×1080, web-safe) …");
execFileSync(FFMPEG, [
  "-v", "error", "-i", rawFile, "-an", "-t", String(TOTAL), // the recorder flushes ~1 s past stop()
  "-vf", "scale=1920:1080,scale=in_range=full:out_range=tv,format=yuv420p",
  "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-crf", "20", "-preset", "slow",
  "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
  "-movflags", "+faststart", outFile, "-y",
]);
rmSync(rawFile, { force: true });

// ── 9. captions: each scene's narration over the span it actually got, split by sentence ─────────
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const cues = [];
for (const [i, s] of scenes.entries()) {
  let parts = s.text.match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g).map((x) => x.trim()).filter(Boolean);
  // a long sentence is split at the comma or dash nearest its middle, so a cue fits two lines
  parts = parts.flatMap((p) => {
    const w = p.split(/\s+/);
    if (w.length <= 16) return [p];
    const cuts = w.map((x, j) => (/[,;:]$/.test(x) || w[j + 1] === "—") ? j + 1 : -1).filter((j) => j > 3 && j < w.length - 3);
    if (!cuts.length) return [p];
    const c = cuts.reduce((a, b) => (Math.abs(b - w.length / 2) < Math.abs(a - w.length / 2) ? b : a));
    return [w.slice(0, c).join(" "), w.slice(c).join(" ")];
  });
  const count = (p) => p.split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x)).length;
  const total = parts.reduce((a, p) => a + count(p), 0);
  const a = marks[i], b = marks[i + 1];
  let t = a;
  for (const p of parts) {
    const d = ((b - a) * count(p)) / total;
    cues.push({ a: t, b: t + d - 0.05, text: p });
    t += d;
  }
}
const srtFile = path.join(dir, `checkin-3-${VARIANT}.srt`);
writeFileSync(srtFile, cues.map((c, i) => `${i + 1}\n${ts(c.a)} --> ${ts(c.b)}\n${c.text}\n`).join("\n"));

log(`\n✓ ${rel(outFile)}  (${marks[3].toFixed(2)} s, holds ${scenes.map((s) => s.hold).join(" / ")})`);
for (let i = 0; i < 3; i++) log(`   scene ${i + 1}: ${marks[i].toFixed(2)} → ${marks[i + 1].toFixed(2)} s`);
log(`✓ ${rel(srtFile)}  (${cues.length} cues)`);
writeFileSync(path.join(dir, `checkin-3-${VARIANT}.marks.json`), JSON.stringify(
  { variant: VARIANT, holds: scenes.map((s) => s.hold), marks: marks.map((m) => +m.toFixed(3)), gate: gateRev }, null, 1) + "\n");
