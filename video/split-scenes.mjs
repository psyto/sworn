// Split a recorded video into its scenes, each with the narration that belongs to it — for adding the
// founder's voice scene by scene (e.g. in Google Vids).
//
//   node video/split-scenes.mjs pitch-d   # after record-pitch-d.mjs → video/scenes/pitch-d/
//   node video/split-scenes.mjs demo-d    # after record-demo-d.mjs  → video/scenes/demo-d/
//   node video/split-scenes.mjs B         # after VARIANT=B record-checkin.mjs (or A) → video/scenes/checkin-3-B/
//
// Reads video/<name>.mp4 and its .marks.json (written by the recorder: the per-scene clip lengths), and
// the narration from the same script the recorder derived those lengths from (PITCH-D.md / DEMO-D.md /
// CHECKIN-3.md), so the words and the clip lengths cannot drift apart. Writes:
//   scene-N.mp4   (silent, re-encoded so each cut is frame-accurate)
//   scene-N.txt   (the lines to read over that clip)
//   NARRATION.md  (all scenes, with target lengths)
import path from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseScenes, countWords } from "./lib/rec.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2] || "";
const FFMPEG = process.env.FFMPEG_PATH || "/opt/homebrew/bin/ffmpeg";
const FFPROBE = FFMPEG.replace(/ffmpeg$/, "ffprobe");

let base, scenes, names, heading;
if (["pitch-d", "demo-d"].includes(arg)) {
  base = arg;
  const parsed = parseScenes(`video/${arg.toUpperCase()}.md`);
  scenes = parsed.map((s) => s.text);
  names = parsed.map((s) => s.title);
  heading = `${arg === "pitch-d" ? "Pitch D" : "Demo D"} — narration by scene`;
} else if (["A", "B"].includes(arg.toUpperCase())) {
  const V = arg.toUpperCase();
  base = `checkin-3-${V}`;
  const md = readFileSync(path.join(dir, "CHECKIN-3.md"), "utf8");
  const sec = md.split(`## Variant ${V}`)[1]?.split(/\n## /)[0];
  if (!sec) throw new Error(`CHECKIN-3.md: no "## Variant ${V}" section`);
  scenes = sec.split(/\*\*\[Screen \d/).slice(1).map((chunk) =>
    chunk.split("\n").filter((l) => l.startsWith("> ")).map((l) => l.slice(2).trim()).join(" "));
  names = ["what I changed", "what it does", "what I learned / next"];
  heading = `Check-in 3, variant ${V} — narration by scene`;
} else throw new Error("usage: node video/split-scenes.mjs pitch-d|demo-d|A|B");

const src = path.join(dir, `${base}.mp4`);
const marksFile = path.join(dir, `${base}.marks.json`);
for (const f of [src, marksFile]) if (!existsSync(f)) throw new Error(`missing ${path.relative(dir, f)} — record it first`);
const marks = JSON.parse(readFileSync(marksFile, "utf8"));
const holds = marks.holds;
if (holds?.length !== scenes.length || scenes.some((s) => !s)) throw new Error(`${path.basename(marksFile)}: ${holds?.length} holds for ${scenes.length} scenes with narration`);

const total = parseFloat(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src], { encoding: "utf8" }));
const sum = holds.reduce((a, b) => a + b, 0);
if (Math.abs(total - sum) > 0.1) throw new Error(`${path.basename(src)} is ${total}s but holds sum to ${sum}s — re-record`);

const out = path.join(dir, "scenes", base);
mkdirSync(out, { recursive: true });
const doc = [`# ${heading}\n`,
  `Read each block over its clip. Target pace ≈ 2.2 words/s (the clip lengths were derived from it).`,
  `Narration is the founder's own voice. Total ${+sum.toFixed(2)} s.\n`];
if (marks.note) doc.push(`${marks.note}\n`);
let start = 0;
for (let i = 0; i < scenes.length; i++) {
  const n = i + 1, hold = holds[i];
  const clip = path.join(out, `scene-${n}.mp4`);
  execFileSync(FFMPEG, ["-v", "error", "-y", "-ss", String(start), "-i", src, "-t", String(hold),
    "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "18", clip]);
  const got = parseFloat(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip], { encoding: "utf8" }));
  if (Math.abs(got - hold) > 0.1) throw new Error(`scene-${n}.mp4 is ${got}s, expected ${hold}s`);
  const words = countWords(scenes[i]);
  writeFileSync(path.join(out, `scene-${n}.txt`), scenes[i] + "\n");
  doc.push(`## Scene ${n} — ${names[i]} · ${+hold.toFixed(2)} s · ${words} words\n\n${scenes[i]}\n`);
  process.stderr.write(`✓ scene-${n}.mp4  ${got.toFixed(2)} s  (${words} words)\n`);
  start += hold;
}
writeFileSync(path.join(out, "NARRATION.md"), doc.join("\n"));
process.stderr.write(`✓ ${path.relative(path.join(dir, ".."), out)}/NARRATION.md\n`);
