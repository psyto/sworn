// DEMO D: a 90-second, value-first cut built from the verified source clips of demo C.
// It does not create transactions or re-run proving. The source clips remain the recordings made by
// record-demo-c.mjs; this script only renders D's intro/privacy/closing cards and makes frame-accurate trims.
import path from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { keccak256 } from "viem";
import {
  dir, read, fail, log, rpc, launch, parseScenes, recordSlides, checkOverflow, concat, duration, writeSrt, writeJson,
} from "./lib/rec.mjs";

const FFMPEG = process.env.FFMPEG_PATH || "/opt/homebrew/bin/ffmpeg";
const VIEWPORT = { width: 1024, height: 576, deviceScaleFactor: 1.875 };
const work = path.join(dir, "takes", "demo-d");
mkdirSync(work, { recursive: true });

const scenes = parseScenes("video/DEMO-D.md");
if (scenes.length !== 9) fail(`DEMO-D.md has ${scenes.length} scenes, expected 9`);
const targets = [...read("video/DEMO-D.md", "DEMO-D.md").matchAll(/^## Scene \d+ — .*· ≈ (\d+(?:\.\d+)?) s\s*$/gm)].map((m) => +m[1]);
if (targets.length !== scenes.length) fail("DEMO-D.md needs a target duration for every scene");
const holds = scenes.map((s, i) => Math.max(s.hold, targets[i]));
const expected = [10, 15, 8, 14, 5, 10, 10, 8, 10];
if (holds.some((v, i) => v !== expected[i])) fail(`demo D lengths drifted: ${holds.join(" / ")}`);
const total = holds.reduce((a, b) => a + b, 0);
if (total !== 90) fail(`demo D is ${total}s, expected 90s`);

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

const data = {
  scenes: ["dintrod", "dflowd", "dseparate", "dclosed"],
  digest: `0x${JSON.parse(read("contracts/test/vectors/zone-deposit_and_withdrawal_blocks5-6-sworn-sp1-groth16-v1.json", "fixture")).digest.slice(2, 10)}…`,
  ownZoneId: String(own.zoneId),
  ownBlocks: own.batches.at(-1).zoneBlocks,
  ownVerifier: `${ownVerifier.address.slice(0, 6)}…${ownVerifier.address.slice(-4)}`,
  repo: "github.com/psyto/sworn",
  pageUrl: "psyto.github.io/sworn",
};
await checkOverflow("demo.html", data, data.scenes, VIEWPORT);

const encodeTrim = (input, start, seconds, output) => {
  const src = path.join(dir, input);
  if (Math.abs(duration(src) - start) < seconds - 0.1) fail(`${input} is too short for ${start}s + ${seconds}s`);
  execFileSync(FFMPEG, ["-v", "error", "-ss", String(start), "-i", src, "-t", String(seconds), "-an",
    "-vf", "fps=30,scale=1920:1080,setsar=1,scale=in_range=full:out_range=tv,format=yuv420p",
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
    "-filter_complex", "[0:v]fps=30,scale=1920:1080,setsar=1[base];[base][1:v]overlay=0:0:shortest=1,scale=in_range=full:out_range=tv,format=yuv420p[v]",
    "-map", "[v]", "-an", "-t", String(seconds), "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-crf", "20", "-preset", "slow",
    "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", output, "-y"]);
};

// New filename intentionally invalidates the pre-separation title-card render.
const intro = path.join(work, "s1-hook10.mp4");
const privacy = path.join(work, "s3-learns.mp4");
const separate = path.join(work, "s5.mp4");
const close = path.join(work, "s9.mp4");
const renderCard = async (id, hold, raw, out) => {
  if (existsSync(out) && Math.abs(duration(out) - hold) < 0.12) return log(`• reusing ${path.basename(out)}`);
  await recordSlides({ html: "demo.html", data, ids: [id], holds: [hold], raw, out, viewport: VIEWPORT });
};
await renderCard("dintrod", holds[0], path.join(work, "s1.raw.mp4"), intro);
// D's compact flow reveals the result within eight seconds.
await renderCard("dflowd", holds[2], path.join(work, "s3.raw.mp4"), privacy);
await renderCard("dseparate", holds[4], path.join(work, "s5.raw.mp4"), separate);
await renderCard("dclosed", holds[8], path.join(work, "s9.raw.mp4"), close);

const job = path.join(work, "s2.mp4");
const verifyA = path.join(work, "s4a.mp4"), verifyX = path.join(work, "s4x.mp4"), verifyC = path.join(work, "s4c.mp4"), verify = path.join(work, "s4.mp4");
const payA = path.join(work, "s6a.mp4"), payX = path.join(work, "s6x.mp4"), pay = path.join(work, "s6-scoped.mp4");
const forged = path.join(work, "s7-scoped.mp4"), repeat = path.join(work, "s8.mp4");
encodeTrim("takes/demo-b/job-scene.mp4", 0, holds[1], job);
encodeTrim("takes/demo-c/b3a.mp4", 0, 5, verifyA);
encodeTrim("takes/demo-c/b3x.mp4", 0, 5, verifyX);
// b3c opens on the previous click's results; start just before the live click.
encodeTrim("takes/demo-c/b3c.mp4", 1.5, 4, verifyC);
concat([verifyA, verifyX, verifyC], verify);
await ownScopeOverlay();
encodeOwnScopeTrim("takes/demo-c/b4a.mp4", 0, 5, payA);
encodeOwnScopeTrim("takes/demo-c/b4x.mp4", 0, 5, payX);
concat([payA, payX], pay);
encodeOwnScopeTrim("takes/demo-c/b5.mp4", 0, holds[6], forged);
encodeTrim("takes/demo-c/b6.mp4", 0, holds[7], repeat);

const parts = [intro, job, privacy, verify, separate, pay, forged, repeat, close];
parts.forEach((f, i) => exact(f, holds[i]));
const out = path.join(dir, "demo-d.mp4");
concat(parts, out);
exact(out, total);
const pixel = execFileSync(FFMPEG, ["-v", "error", "-ss", "1", "-i", out, "-vf", "crop=1:1:1900:1060,format=rgb24", "-frames:v", "1", "-f", "rawvideo", "-"], { encoding: null });
if (![243, 242, 232].every((v, i) => pixel[i] === v)) fail(`background pixel is #${[...pixel.slice(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("")}, expected #f3f2e8`);
const starts = holds.reduce((a, h) => [...a, a.at(-1) + h], [0]);
const cues = writeSrt(scenes, starts, path.join(dir, "demo-d.srt"));
for (let i = 0; i < scenes.length; i++) {
  const image = path.join(dir, "frames", `demo-d-scene${i + 1}.png`);
  execFileSync(FFMPEG, ["-v", "error", "-ss", String(starts[i] + Math.min(2, holds[i] / 2)), "-i", out, "-frames:v", "1", image, "-y"]);
}
writeJson(path.join(dir, "demo-d.marks.json"), {
  name: "demo-d", version: "6-D", script: "video/DEMO-D.md", holds, titles: scenes.map((s) => s.title),
  words: scenes.map((s) => s.words), totalWords: scenes.reduce((n, s) => n + s.words, 0),
  source: "Demo C's verified recordings, rechecked against Moderato and trimmed into a 90-second two-result cut.",
  note: "Silent. The fixture proof job and OwnZone settlement are visibly separated; add founder narration from DEMO-D.md or demo-d.srt.",
});
log(`✓ video/demo-d.mp4 (${total}s) · video/demo-d.srt (${cues} cues) · video/demo-d.marks.json`);
