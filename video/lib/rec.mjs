// Shared pieces of the CWF video recorders (record-pitch.mjs, record-demo.mjs) and split-scenes.mjs.
// Same discipline as record-checkin.mjs: the script decides the scene lengths, every figure is read at
// record time from its source, and a source that is missing or says something unexpected THROWS.
// Reads only: eth_call / eth_getCode / eth_getTransactionReceipt / eth_getTransactionByHash. No keys.
import path from "node:path";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parseAbi, encodeFunctionData, decodeFunctionResult } from "viem";

export const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const repo = path.join(dir, "..");
export const FFMPEG = process.env.FFMPEG_PATH || "/opt/homebrew/bin/ffmpeg";
export const FFPROBE = FFMPEG.replace(/ffmpeg$/, "ffprobe");
export const RPC = "https://rpc.moderato.tempo.xyz";
export const EXPLORER = "https://explore.testnet.tempo.xyz";
export const WPS = 2.2; // words per second of the founder's narration
export const log = (s) => process.stderr.write(s + "\n");
export const fail = (s) => { throw new Error(s); };
export const rel = (p) => path.relative(repo, p);
export const short = (h, n = 4) => `${h.slice(0, 2 + n)}…${h.slice(-n)}`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Keep long headless recordings observable to a supervising terminal without changing their timing. */
export async function waitWithProgress(ms, label) {
  let left = ms;
  while (left > 0) {
    const step = Math.min(left, 5000);
    await sleep(step);
    left -= step;
    if (left > 0) log(`      ${label} … ${Math.ceil(left / 1000)} s`);
  }
}

export function read(p, what) {
  const f = path.join(repo, p);
  if (!existsSync(f)) fail(`${what}: ${p} is missing`);
  return readFileSync(f, "utf8");
}

// ── the script: "## Scene N — title · ≈ X s" sections, narration in "> " lines ────────────────────
// A word is a whitespace-separated token with a letter or digit in it (as in record-checkin.mjs).
// Hold = words ÷ 2.2 w/s, rounded UP to 0.5 s.
export const countWords = (t) => t.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
export function parseScenes(mdRel) {
  const md = read(mdRel, "script");
  const body = md.split(/^## Claims and sources/m)[0];
  const scenes = body.split(/^## /m).slice(1).filter((s) => /^Scene \d/.test(s)).map((chunk) => {
    const head = chunk.match(/^Scene (\d+)(?: —|:) (.+?) ·/) ?? fail(`${mdRel}: unreadable scene heading "${chunk.slice(0, 60)}…"`);
    const text = chunk.split("\n").filter((l) => l.startsWith("> ")).map((l) => l.slice(2).trim()).join(" ");
    const words = countWords(text);
    if (!words) fail(`${mdRel}, scene ${head[1]}: no narration`);
    return { n: +head[1], title: head[2].trim(), text, words, hold: Math.ceil((words / WPS) * 2) / 2 };
  });
  scenes.forEach((s, i) => s.n === i + 1 || fail(`${mdRel}: scene ${i + 1} is numbered ${s.n}`));
  return scenes;
}

// ── chain reads ───────────────────────────────────────────────────────────────────────────────────
let rpcId = 0;
export async function rpc(method, params) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(RPC, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
      });
      if (!res.ok) fail(`${RPC} ${method}: HTTP ${res.status}`);
      const j = await res.json();
      if (j.error) fail(`${RPC} ${method}: ${j.error.message}`);
      return j.result;
    } catch (e) {
      if (attempt >= 3 || /: (execution reverted|invalid)/i.test(e.message)) throw e;
      await sleep(1500 * attempt);
    }
  }
}
/** eth_call of `function <sig>` with args, at `block` ("latest" or a number). */
export async function call(to, sig, args = [], block = "latest") {
  const abi = parseAbi([`function ${sig}`]);
  const name = sig.slice(0, sig.indexOf("("));
  const tag = typeof block === "number" || typeof block === "bigint" ? "0x" + BigInt(block).toString(16) : block;
  const data = await rpc("eth_call", [{ to, data: encodeFunctionData({ abi, functionName: name, args }) }, tag]);
  return decodeFunctionResult({ abi, functionName: name, data });
}
export async function receipt(tx, what) {
  const r = await rpc("eth_getTransactionReceipt", [tx]);
  if (!r) fail(`${what}: no receipt for ${tx} on Moderato`);
  if (r.status !== "0x1") fail(`${what}: ${tx} has status ${r.status}, not 1`);
  return r;
}

// ── the web, read at record time ──────────────────────────────────────────────────────────────────
export async function fetchText(url, what) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (sworn video recorder)" }, redirect: "follow" });
  if (!res.ok) fail(`${what}: ${url} → HTTP ${res.status}`);
  return res.text();
}
export function ghFile(repoName, file, what, ref) {
  let b64;
  try {
    b64 = execFileSync("gh", ["api", `repos/${repoName}/contents/${file}${ref ? `?ref=${ref}` : ""}`, "--jq", ".content"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) { fail(`${what}: gh api repos/${repoName}/contents/${file} failed: ${e.stderr ?? e.message}`); }
  return Buffer.from(b64.replace(/\s+/g, ""), "base64").toString("utf8");
}
export function ghRepoPublic(repoName, what) {
  let j;
  try {
    j = JSON.parse(execFileSync("gh", ["api", `repos/${repoName}`], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  } catch (e) { fail(`${what}: gh api repos/${repoName} failed: ${e.stderr ?? e.message}`); }
  if (j.private !== false) fail(`${what}: ${repoName} is not public`);
  return j.html_url.replace(/^https:\/\//, "");
}

// ── facts shared by both videos ───────────────────────────────────────────────────────────────────
/** The Tempo Zones header comment, joined into sentences; throws if either quoted sentence is gone. */
export function zonesQuote() {
  const src = ghFile("tempoxyz/zones", "crates/spf/src/lib.rs", "tempoxyz/zones");
  const doc = src.split("\n").filter((l) => l.startsWith("//!")).map((l) => l.replace(/^\/\/!\s?/, "")).join(" ").replace(/\s+/g, " ");
  const a = "Stateless state transition function for Tempo Zones.";
  const b = "It is presently a normal Rust verifier rather than a `no_std` proving guest.";
  for (const q of [a, b]) if (!doc.includes(q)) fail(`tempoxyz/zones crates/spf/src/lib.rs no longer says: "${q}"`);
  if (!/tempo_evm|tempo_revm|tempo-revm/.test(src)) fail("tempoxyz/zones crates/spf/src/lib.rs no longer uses Tempo's EVM");
  return { a, b: b.replace(/`/g, ""), src: "tempoxyz/zones · crates/spf/src/lib.rs · GitHub API, read while recording" };
}

/** deployments/moderato.json checked against Moderato; returns the contract facts. */
export async function moderato() {
  const { keccak256, getAddress } = await import("viem");
  const dep = JSON.parse(read("deployments/moderato.json", "deployments"));
  const SWORN = getAddress(dep?.Sworn?.address ?? fail("moderato.json: no Sworn.address"));
  const chainId = parseInt(await rpc("eth_chainId", []), 16);
  if (chainId !== dep.chainId) fail(`RPC chainId ${chainId} != moderato.json chainId ${dep.chainId}`);
  const code = await rpc("eth_getCode", [SWORN, "latest"]);
  if (!code || code === "0x") fail(`no code at Sworn ${SWORN}`);
  if (keccak256(code) !== dep.Sworn.codehash) fail(`Sworn codehash on chain != moderato.json`);
  const vkey = await call(SWORN, "GUEST_VKEY() view returns (bytes32)");
  const verifier = getAddress(await call(SWORN, "SP1_VERIFIER() view returns (address)"));
  if (verifier !== getAddress(dep.SP1VerifierGroth16.address)) fail(`Sworn.SP1_VERIFIER ${verifier} != moderato.json`);
  const vcode = await rpc("eth_getCode", [verifier, "latest"]);
  if (keccak256(vcode) !== dep.SP1VerifierGroth16.codehash) fail("verifier codehash on chain != moderato.json");
  const verifierVersion = await call(verifier, "VERSION() pure returns (string)");
  const bondToken = getAddress(await call(SWORN, "BOND_TOKEN() view returns (address)"));
  const bondDecimals = Number(await call(bondToken, "decimals() view returns (uint8)"));
  const bondSymbol = await call(bondToken, "symbol() view returns (string)");
  const maxAge = await call(SWORN, "MAX_AGE() view returns (uint256)");
  const challengePeriod = await call(SWORN, "CHALLENGE_PERIOD() view returns (uint256)");
  log(`• Moderato: Sworn ${SWORN} codehash ok, GUEST_VKEY ${vkey}, SP1_VERIFIER ${verifier} (${verifierVersion}), bond ${bondSymbol}, MAX_AGE ${maxAge}`);
  return { dep, chainId, SWORN, vkey, verifier, verifierVersion, bondToken, bondDecimals, bondSymbol, maxAge, challengePeriod };
}

export function ac2Line() {
  const line = (read("out/ac2_run.log", "AC-2 log").match(/^AC-2: matched .*$/gm) ?? fail("out/ac2_run.log has no \"AC-2: matched\" line")).at(-1);
  const m = line.match(/^AC-2: matched (\d+) \/ (\d+) \((.*)\)$/) ?? fail(`unexpected AC-2 line: ${line}`);
  if (m[1] !== m[2]) fail(`AC-2 matched ${m[1]} of ${m[2]}`);
  return { line, matched: `${m[1]} / ${m[2]}`, note: m[3] };
}

/** no-owner.sh's source scan of Sworn.sol, run now (no forge: the one-argument form). */
export function noOwner() {
  let out;
  try {
    out = execFileSync("bash", ["scripts/no-owner.sh", "src/Sworn.sol"], { cwd: path.join(repo, "contracts"), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) { fail(`contracts/scripts/no-owner.sh src/Sworn.sol failed:\n${e.stdout ?? ""}${e.stderr ?? ""}`); }
  const line = out.trim().split("\n").at(-1);
  if (line !== "no-owner: OK (src/Sworn.sol)") fail(`no-owner.sh printed "${line}"`);
  return line;
}

// ── recording authored slides ─────────────────────────────────────────────────────────────────────
export async function launch(viewport = { width: 1280, height: 720, deviceScaleFactor: 1.5 }) {
  const { default: puppeteer } = await import("puppeteer");
  return puppeteer.launch({
    timeout: 180000, // a loaded host (SP1 proving) can take >30 s to open the first tab
    headless: true, // Chromium 107 (puppeteer 19) predates --headless=new; "new" hangs at launch
    defaultViewport: viewport,
    args: ["--no-sandbox", "--hide-scrollbars", `--window-size=${viewport.width},${viewport.height}`, `--force-device-scale-factor=${viewport.deviceScaleFactor}`],
  });
}
export async function newRecorder(page) {
  const { PuppeteerScreenRecorder } = await import("puppeteer-screen-recorder");
  return new PuppeteerScreenRecorder(page, { fps: 30, videoFrame: { width: 1920, height: 1080 }, aspectRatio: "16:9", ffmpeg_Path: FFMPEG });
}

/** Encode silent, 1920×1080, web-safe; `-t total` because the recorder flushes ~1 s past stop(). */
export function encode(raw, out, total) {
  execFileSync(FFMPEG, [
    "-v", "error", "-i", raw, "-an", ...(total ? ["-t", String(total)] : []),
    "-vf", "fps=30,scale=1920:1080,scale=in_range=full:out_range=tv,format=yuv420p",
    "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-crf", "20", "-preset", "slow",
    "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-movflags", "+faststart", out, "-y",
  ]);
}
export const duration = (f) =>
  parseFloat(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }));

/**
 * Loads `html` (a file in video/), fills its [data-k] slots via window.__fill(data) (which throws on
 * an empty slot), then shows each scene id for its hold. Returns the scene start marks (s).
 */
export async function recordSlides({ html, data, ids, holds, raw, out, viewport }) {
  const browser = await launch(viewport);
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(600000);
    await page.goto("file://" + path.join(dir, html), { waitUntil: "load", timeout: 600000 });
    await page.evaluate((d) => window.__fill(d), data);
    await fontsReady(page);
    const recorder = await newRecorder(page);
    await recorder.start(raw);
    const t0 = Date.now();
    const marks = [];
    for (const [i, id] of ids.entries()) {
      marks.push((Date.now() - t0) / 1000);
      log(`    recording ${id} (${holds[i]} s)`);
      page.evaluate((x) => window.__show(x), id); // fades run in the page while the hold elapses
      const end = holds.slice(0, i + 1).reduce((a, h) => a + h, 0) * 1000;
      await waitWithProgress(Math.max(0, end - (Date.now() - t0)), `holding ${id}`);
    }
    marks.push((Date.now() - t0) / 1000);
    await recorder.stop();
    const total = holds.reduce((a, h) => a + h, 0);
    log(`• encoding ${path.basename(out)} (silent, 1920×1080) …`);
    encode(raw, out, total);
    rmSync(raw, { force: true });
    return marks;
  } finally {
    await browser.close();
  }
}

/** Geist / Geist Mono (Google Fonts) must be loaded — a fallback font would change every line break. */
export async function fontsReady(page) {
  const ok = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(["400 20px Geist", "300 20px Geist", "500 12px 'Geist Mono'"].map((f) => document.fonts.load(f)));
    return document.fonts.check("400 20px Geist") && document.fonts.check("500 12px 'Geist Mono'") &&
      [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Geist" && f.status === "loaded");
  });
  if (!ok) fail("Geist / Geist Mono did not load from Google Fonts — no network? (refusing to record with a fallback font)");
}

/** Overflow check: every [data-k] slot and .card in the shown scenes must sit inside its card / the frame. */
export async function checkOverflow(html, data, ids, viewport) {
  const browser = await launch(viewport);
  try {
    const page = await browser.newPage();
    await page.goto("file://" + path.join(dir, html), { waitUntil: "load", timeout: 600000 });
    await page.evaluate((d) => window.__fill(d), data);
    await fontsReady(page);
    const bad = [];
    for (const id of ids) {
      const r = await page.evaluate((x) => window.__overflow(x), id);
      bad.push(...r.map((m) => `#${id}: ${m}`));
    }
    if (bad.length) fail(`text overflows its card at ${viewport ? `${viewport.width}×${viewport.height}` : "1280×720"} CSS px (1920×1080):\n  ${bad.join("\n  ")}`);
  } finally {
    await browser.close();
  }
}

// ── captions ──────────────────────────────────────────────────────────────────────────────────────
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
/** Each scene's narration over the span [starts[i], starts[i+1]), split by sentence. */
export function writeSrt(scenes, starts, file) {
  const cues = [];
  for (const [i, s] of scenes.entries()) {
    let parts = s.text.match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g).map((x) => x.trim()).filter(Boolean);
    parts = parts.flatMap((p) => {
      const w = p.split(/\s+/);
      if (w.length <= 16) return [p];
      const cuts = w.map((x, j) => (/[,;:]$/.test(x) || w[j + 1] === "—") ? j + 1 : -1).filter((j) => j > 3 && j < w.length - 3);
      if (!cuts.length) return [p];
      const c = cuts.reduce((a, b) => (Math.abs(b - w.length / 2) < Math.abs(a - w.length / 2) ? b : a));
      return [w.slice(0, c).join(" "), w.slice(c).join(" ")];
    });
    const total = parts.reduce((a, p) => a + countWords(p), 0);
    const a = starts[i], b = starts[i + 1];
    let t = a;
    for (const p of parts) {
      const d = ((b - a) * countWords(p)) / total;
      cues.push({ a: t, b: t + d - 0.05, text: p });
      t += d;
    }
  }
  writeFileSync(file, cues.map((c, i) => `${i + 1}\n${ts(c.a)} --> ${ts(c.b)}\n${c.text}\n`).join("\n"));
  return cues.length;
}

/** Concatenate silent clips (same size/fps) into one web-safe mp4. */
export function concat(files, out) {
  const inputs = files.flatMap((f) => ["-i", f]);
  const fc = files.map((_, i) => `[${i}:v]fps=30,format=yuv420p,setsar=1[v${i}]`).join(";") + ";" +
    files.map((_, i) => `[v${i}]`).join("") + `concat=n=${files.length}:v=1:a=0[v]`;
  execFileSync(FFMPEG, ["-v", "error", ...inputs, "-filter_complex", fc, "-map", "[v]", "-an",
    "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-crf", "20", "-preset", "slow",
    "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-movflags", "+faststart", out, "-y"]);
}

export function writeJson(file, obj) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(obj, null, 1) + "\n");
}
