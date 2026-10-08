// CHECK-IN 4 (video/CHECKIN-4.md → video/checkin-4.mp4): under a minute, built from Demo D's verified source clips
// (video/takes/demo-c/, recorded by record-demo-c.mjs) plus two cards in demo.html. Reads only; sends nothing.
import path from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { keccak256 } from "viem";
import {
  dir, read, fail, log, rpc, launch, parseScenes, recordSlides, checkOverflow, concat, duration, writeSrt, writeJson,
} from "./lib/rec.mjs";

const FFMPEG = process.env.FFMPEG_PATH || "/opt/homebrew/bin/ffmpeg";
const VIEWPORT = { width: 1024, height: 576, deviceScaleFactor: 1.875 };
const work = path.join(dir, "takes", "checkin-4");
mkdirSync(work, { recursive: true });

const scenes = parseScenes("video/CHECKIN-4.md");
if (scenes.length !== 3) fail(`CHECKIN-4.md has ${scenes.length} scenes, expected 3`);
const targets = [...read("video/CHECKIN-4.md", "CHECKIN-4.md").matchAll(/^## Scene \d+ — .*· ≈ (\d+(?:\.\d+)?) s\s*$/gm)].map((m) => +m[1]);
if (targets.length !== scenes.length) fail("CHECKIN-4.md needs a target duration for every scene");
const holds = scenes.map((s, i) => Math.max(s.hold, targets[i]));
const expected = [25, 15, 10];
if (holds.some((v, i) => v !== expected[i])) fail(`check-in 4 lengths drifted: ${holds.join(" / ")}`);
const total = holds.reduce((a, b) => a + b, 0);
if (total > 58) fail(`check-in 4 is ${total}s, over 58s`);

// The retained clips were originally recorded by record-demo-c.mjs, which verifies every visible
// receipt, trace, call and page value before recording. Re-read the facts that identify D's two
// separate demonstrations now; assembly stops rather than silently blending stale or mismatched evidence.
const dep = JSON.parse(read("deployments/moderato.json", "deployments/moderato.json"));
const fixture = dep.SwornZoneVerifierWithdrawal ?? fail("no SwornZoneVerifierWithdrawal record");
const own = dep.OwnZone ?? fail("no OwnZone record");
const ownVerifier = own.SwornZoneVerifier ?? fail("no OwnZone verifier record");
const ownPortal = own.OwnZonePortal ?? fail("no OwnZonePortal record");
const lower = (v) => String(v).toLowerCase();
const receipt = async (tx, status, to, label) => {
  const r = await rpc("eth_getTransactionReceipt", [tx]);
  if (!r || r.status !== status || lower(r.to) !== lower(to))
    fail(`${label}: expected status ${status} to ${to}, got ${r ? `${r.status} to ${r.to}` : "no receipt"}`);
  return r;
};
const codehash = async (address, expected, label) => {
  const code = await rpc("eth_getCode", [address, "latest"]);
  if (!code || code === "0x" || lower(keccak256(code)) !== lower(expected)) fail(`${label}: deployed codehash differs`);
};
await codehash(fixture.address, fixture.codehash, "fixture verifier");
await codehash(ownVerifier.address, ownVerifier.codehash, "OwnZone verifier");
await codehash(ownPortal.address, ownPortal.codehash, "OwnZone portal");
await receipt(fixture.attest.tx, "0x1", fixture.address, "fixture attestation");
for (const batch of own.batches) await receipt(batch.submitTx, "0x1", ownPortal.address, `OwnZone batch ${batch.zoneBlocks}`);
await receipt(own.payout.tx, "0x1", ownPortal.address, "OwnZone payout");
await receipt(own.forgedBatch.tx, "0x0", ownPortal.address, "forged OwnZone batch");
if (own.zoneId !== 4242 || own.batches.at(-1)?.zoneBlocks !== "56-61" || ownVerifier.address !== "0x15D192a08F41150cae9178D14D55c04F27FF2733")
  fail("OwnZone record no longer matches the stated distinct batch/verifier");

const data = { scenes: ["c4learn", "c4next"], repo: "github.com/psyto/sworn", pageUrl: "psyto.github.io/sworn" };
await checkOverflow("demo.html", data, data.scenes, VIEWPORT);

const encodeTrim = (input, start, seconds, output) => {
  const src = path.join(dir, input);
  if (Math.abs(duration(src) - start) < seconds - 0.1) fail(`${input} is too short for ${start}s + ${seconds}s`);
  execFileSync(FFMPEG, ["-v", "error", "-ss", String(start), "-i", src, "-t", String(seconds), "-an",
    "-vf", "fps=30,scale=1920:1080,setsar=1,format=yuv420p",
    "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-crf", "20", "-preset", "slow",
    "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", output, "-y"]);
};
const exact = (f, seconds) => {
  const got = duration(f);
  if (Math.abs(got - seconds) > 0.12) fail(`${path.basename(f)} is ${got}s, expected ${seconds}s`);
};
const OWN_SCOPE = path.join(work, "own-zone-scope.png");
async function ownScopeOverlay() {
  if (existsSync(OWN_SCOPE)) return;
  const browser = await launch({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><div style="position:absolute;right:28px;bottom:28px;background:#2b3078;color:#fff;padding:11px 16px;font:500 17px ui-monospace,Menlo,monospace;letter-spacing:.055em">OWN ZONE · ONE OPERATOR · NOT TEMPO-CREATED</div>`, { waitUntil: "load" });
    await page.screenshot({ path: OWN_SCOPE, omitBackground: true });
  } finally { await browser.close(); }
}
const encodeOwnScopeTrim = (input, start, seconds, output) => {
  const src = path.join(dir, input);
  if (Math.abs(duration(src) - start) < seconds - 0.1) fail(`${input} is too short for ${start}s + ${seconds}s`);
  execFileSync(FFMPEG, ["-v", "error", "-ss", String(start), "-i", src, "-loop", "1", "-framerate", "30", "-i", OWN_SCOPE,
    "-filter_complex", "[0:v]fps=30,scale=1920:1080,setsar=1[base];[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]",
    "-map", "[v]", "-an", "-t", String(seconds), "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-crf", "20", "-preset", "slow",
    "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", output, "-y"]);
};

const learn = path.join(work, "s2.mp4"), next = path.join(work, "s3.mp4");
const renderCard = async (id, hold, raw, out) => {
  if (existsSync(out) && Math.abs(duration(out) - hold) < 0.12) return log(`• reusing ${path.basename(out)}`);
  await recordSlides({ html: "demo.html", data, ids: [id], holds: [hold], raw, out, viewport: VIEWPORT });
};
await renderCard("c4learn", holds[1], path.join(work, "s2.raw.mp4"), learn);
await renderCard("c4next", holds[2], path.join(work, "s3.raw.mp4"), next);
await ownScopeOverlay();
// Scene 1: the own-Zone section (8 s), the payout on Tempo's explorer (7 s), the forged batch's failed trace (rest).
const page = path.join(work, "s1a.mp4"), payout = path.join(work, "s1b.mp4"), forged = path.join(work, "s1c.mp4"), built = path.join(work, "s1.mp4");
encodeOwnScopeTrim("takes/demo-c/b4a.mp4", 0, 8, page);
encodeOwnScopeTrim("takes/demo-c/b4x.mp4", 0, 7, payout);
encodeOwnScopeTrim("takes/demo-c/b5.mp4", 0, holds[0] - 15, forged);
concat([page, payout, forged], built);
const parts = [built, learn, next];
parts.forEach((f, i) => exact(f, holds[i]));
const out = path.join(dir, "checkin-4.mp4");
concat(parts, out);
exact(out, total);
const starts = holds.reduce((a, h) => [...a, a.at(-1) + h], [0]);
for (const [t, label] of [[starts[1] + 1, "scene 2 card"], [3, "scene 1 page"]]) {
  const px = execFileSync(FFMPEG, ["-v", "error", "-ss", String(t), "-i", out, "-vf", "crop=1:1:1900:1060,format=rgb24", "-frames:v", "1", "-f", "rawvideo", "-"], { encoding: null });
  if (px[0] < 0xf0) fail(`${label} background is #${[...px.slice(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("")}: wrong range`);
}
const cues = writeSrt(scenes, starts, path.join(dir, "checkin-4.srt"));
for (let i = 0; i < scenes.length; i++) {
  const image = path.join(dir, "frames", `checkin-4-scene${i + 1}.png`);
  execFileSync(FFMPEG, ["-v", "error", "-ss", String(starts[i] + Math.min(2, holds[i] / 2)), "-i", out, "-frames:v", "1", image, "-y"]);
}
writeJson(path.join(dir, "checkin-4.marks.json"), {
  name: "checkin-4", version: "1", script: "video/CHECKIN-4.md", holds, titles: scenes.map((s) => s.title),
  words: scenes.map((s) => s.words), totalWords: scenes.reduce((n, s) => n + s.words, 0),
  note: "Silent. Founder narration from CHECKIN-4.md or checkin-4.srt.",
});
log(`✓ video/checkin-4.mp4 (${total}s) · video/checkin-4.srt (${cues} cues) · video/checkin-4.marks.json`);
