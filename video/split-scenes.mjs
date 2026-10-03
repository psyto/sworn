// Split a recorded check-in into its three scenes, each with the narration that belongs to it —
// for adding voice scene by scene (e.g. in Google Vids).
//
//   node video/split-scenes.mjs B        # or A, after `VARIANT=A … record-checkin.mjs`
//
// Reads video/checkin-3-<V>.mp4 and its .marks.json (written by record-checkin.mjs), and the
// narration from video/CHECKIN-3.md — the same file the recorder derived the scene lengths from, so
// the words and the clip lengths cannot drift apart. Writes video/scenes/checkin-3-<V>/:
//   scene-1.mp4 scene-2.mp4 scene-3.mp4   (silent, re-encoded so each cut is frame-accurate)
//   scene-1.txt scene-2.txt scene-3.txt   (the lines to read over that clip)
//   NARRATION.md                          (all three, with target lengths)
import path from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const V = (process.argv[2] || "").toUpperCase();
if (!["A", "B"].includes(V)) throw new Error("usage: node video/split-scenes.mjs A|B");
const FFMPEG = process.env.FFMPEG_PATH || "/opt/homebrew/bin/ffmpeg";
const FFPROBE = FFMPEG.replace(/ffmpeg$/, "ffprobe");

const src = path.join(dir, `checkin-3-${V}.mp4`);
const marksFile = path.join(dir, `checkin-3-${V}.marks.json`);
for (const f of [src, marksFile]) if (!existsSync(f)) throw new Error(`missing ${path.relative(dir, f)} — record variant ${V} first`);
const { holds, variant } = JSON.parse(readFileSync(marksFile, "utf8"));
if (variant !== V || holds?.length !== 3) throw new Error(`${path.basename(marksFile)}: expected variant ${V} with 3 holds`);

// Narration per scene, from the same script the recorder read.
const md = readFileSync(path.join(dir, "CHECKIN-3.md"), "utf8");
const sec = md.split(`## Variant ${V}`)[1]?.split(/\n## /)[0];
if (!sec) throw new Error(`CHECKIN-3.md: no "## Variant ${V}" section`);
const scenes = sec.split(/\*\*\[Screen \d/).slice(1).map((chunk) =>
  chunk.split("\n").filter((l) => l.startsWith("> ")).map((l) => l.slice(2).trim()).join(" "));
if (scenes.length !== 3 || scenes.some((s) => !s)) throw new Error(`CHECKIN-3.md variant ${V}: expected 3 scenes with narration`);

const total = parseFloat(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src], { encoding: "utf8" }));
const sum = holds.reduce((a, b) => a + b, 0);
if (Math.abs(total - sum) > 0.1) throw new Error(`${path.basename(src)} is ${total}s but holds sum to ${sum}s — re-record`);

const out = path.join(dir, "scenes", `checkin-3-${V}`);
mkdirSync(out, { recursive: true });
const names = ["what I changed", "what it does", "what I learned / next"];
let start = 0;
const doc = [`# Check-in 3, variant ${V} — narration by scene\n`,
  `Read each block over its clip. Target pace ≈ 2.2 words/s (the clip lengths were derived from it).`,
  `Narration is the founder's own voice. Total ${sum} s.\n`];
for (let i = 0; i < 3; i++) {
  const n = i + 1, hold = holds[i];
  const clip = path.join(out, `scene-${n}.mp4`);
  execFileSync(FFMPEG, ["-v", "error", "-y", "-ss", String(start), "-i", src, "-t", String(hold),
    "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "18", clip]);
  const got = parseFloat(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip], { encoding: "utf8" }));
  if (Math.abs(got - hold) > 0.1) throw new Error(`scene-${n}.mp4 is ${got}s, expected ${hold}s`);
  const words = scenes[i].split(/\s+/).length;
  writeFileSync(path.join(out, `scene-${n}.txt`), scenes[i] + "\n");
  doc.push(`## Scene ${n} — ${names[i]} · ${hold} s · ${words} words\n\n${scenes[i]}\n`);
  process.stderr.write(`✓ scene-${n}.mp4  ${got.toFixed(2)} s  (${words} words)\n`);
  start += hold;
}
writeFileSync(path.join(out, "NARRATION.md"), doc.join("\n"));
process.stderr.write(`✓ ${path.relative(path.join(dir, ".."), out)}/NARRATION.md\n`);
