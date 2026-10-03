// Records video/demo.mp4 — Sworn's ≤ 3 min CWF demo, five scenes, SILENT, 1920×1080 — and video/demo.srt
// with the narration of video/DEMO.md (+ video/CLAUDE-CODE-DEMO-BRIEF.md) timed to where each scene landed.
//
//   node video/record-demo.mjs --no-live                 # scenes 2–5 for real, scene 1 a labelled placeholder
//   DEMO_LIVE_OK=1 node video/record-demo.mjs --live     # scene 1 = a LIVE take in the running demo app
//   node video/record-demo.mjs --from-take video/takes/demo-…   # re-edit a saved live take (sends nothing)
//   then: node video/split-scenes.mjs demo
//
// Scene 1 (--live) SENDS REAL MODERATO TRANSACTIONS through the running demo app (demo/scripts/moderato.sh,
// UI on :5173, which holds the keys — this script holds none): Step 1 "Buy preflight" (honest provider:
// MPP charge + reserve), Step 2 "Buy preflight" (dishonest-demo provider: MPP charge + reserve), "Send 500
// to R′" (the agent's real payment), "Challenge the answer" (≈ 7 min local proof, then the challenge tx).
// It refuses unless DEMO_LIVE_OK=1, the app reports SDK + signer ready, both providers have ≥ 500 free
// bond, and Moderato's T12 (2026-10-08 14:00 UTC) is more than 45 min away. The challenge is recorded in
// full; the edit speeds up ONLY the proving span of THIS recording (found from the app's own phase list,
// cross-checked with the backend job clock) to ~10 s, burned-in label "time-lapse · this challenge · <real>
// → <n> s". The app's "recorded run" fast-forward is never clicked. Raw footage and marks are kept in
// video/takes/demo-<utc>/ so the edit can be redone with --from-take without another take.
//
// Scenes 2–5 send nothing: every figure is read now from the sources DEMO.md's claims table names, and a
// missing or changed source THROWS (as in record-checkin.mjs / record-pitch.mjs).
import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseAbiItem, decodeEventLog, getAddress, formatUnits, toEventSelector } from "viem";
import {
  dir, read, fail, log, rel, short, sleep, EXPLORER, FFMPEG, parseScenes, call, receipt, ghRepoPublic,
  zonesQuote, moderato, ac2Line, noOwner, launch, newRecorder, encode, recordSlides, checkOverflow,
  writeSrt, writeJson, duration, concat,
} from "./lib/rec.mjs";

const MAX_TOTAL = 180;
const T12 = 1791468000; // Moderato T12, 2026-10-08 14:00 UTC (DEMO.md, README "What is not done")
const APP = process.env.DEMO_APP_URL || "http://localhost:5173";
const TIMELAPSE_S = Number(process.env.TIMELAPSE_S || 10);
const args = process.argv.slice(2);
const MODE = args.includes("--live") ? "live" : args.includes("--no-live") ? "no-live" : args.includes("--from-take") ? "from-take" : null;
if (!MODE) fail("usage: record-demo.mjs --no-live | --live (DEMO_LIVE_OK=1) | --from-take <dir>");

// ── the script ───────────────────────────────────────────────────────────────────────────────────
const scenes = parseScenes("video/DEMO.md");
if (scenes.length !== 5) fail(`DEMO.md has ${scenes.length} scenes, expected 5`);
log(`• demo (${MODE}): scene holds (words ÷ 2.2 w/s, rounded up to 0.5 s)`);
for (const s of scenes) log(`    scene ${s.n}: ${String(s.words).padStart(3)} words → ${s.hold.toFixed(1)} s  (${s.title})`);
log(`    total ${scenes.reduce((a, s) => a + s.hold, 0).toFixed(1)} s (scene 1 in a live take is as long as the take's edit)`);
if (scenes.reduce((a, s) => a + s.hold, 0) > MAX_TOTAL) fail(`DEMO.md runs over ${MAX_TOTAL} s — cut words`);

// ── chain facts, shared ─────────────────────────────────────────────────────────────────────────
const M = await moderato();
const sol = read("contracts/src/Sworn.sol", "Sworn source");
const evSig = (name) => {
  const m = sol.match(new RegExp(`^\\s*event ${name}\\(([^)]*)\\);`, "m")) ?? fail(`Sworn.sol declares no ${name} event`);
  return parseAbiItem(`event ${name}(${m[1].replace(/\s+/g, " ").trim()})`);
};
const swornEvent = (r, ev, what) => {
  const lg = r.logs.find((l) => getAddress(l.address) === M.SWORN && l.topics[0] === toEventSelector(ev)) ?? fail(`${what}: no ${ev.name} event from Sworn`);
  return decodeEventLog({ abi: [ev], data: lg.data, topics: lg.topics }).args;
};
const fmt2 = (v, d) => { const [i, f = ""] = formatUnits(v, d).split("."); return `${i}.${(f + "00").slice(0, 2)}`; };

// ── scene 1: the live take (or a saved one) ──────────────────────────────────────────────────────
let take = null; // { dir, rawFile, marks… }
if (MODE === "live") {
  if (process.env.DEMO_LIVE_OK !== "1") fail("--live refused: it sends real Moderato transactions. Set DEMO_LIVE_OK=1 for the take, deliberately.");
  take = await liveTake();
} else if (MODE === "from-take") {
  const d = path.resolve(args[args.indexOf("--from-take") + 1] ?? fail("--from-take needs a directory"));
  const f = path.join(d, "take.json");
  if (!existsSync(f)) fail(`${f} is missing`);
  take = { dir: d, ...JSON.parse(readFileSync(f, "utf8")) };
}
let scene1 = null;
if (take) scene1 = await editScene1(take);

async function liveTake() {
  const now = Math.floor(Date.now() / 1000);
  if (now > T12 - 45 * 60) fail(`--live refused: Moderato T12 (${new Date(T12 * 1000).toISOString()}) is less than 45 min away or past — the answerer refuses at T12`);
  const cfgRes = await fetch(`${APP}/api/config`).catch(() => fail(`--live refused: the demo app is not answering at ${APP} — start it with scripts/with-keys.sh demo/scripts/moderato.sh`));
  const cfg = await cfgRes.json();
  if (!cfg.sdk?.ready || !cfg.signer?.ready) fail(`--live refused: app SDK ready=${cfg.sdk?.ready} (${cfg.sdk?.reason ?? ""}), signer ready=${cfg.signer?.ready} (${cfg.signer?.reason ?? ""})`);
  for (const id of ["honest", "dishonest"]) if (!cfg.scenarios?.find((s) => s.id === id)) fail(`--live refused: the app has no ${id} scenario`);
  const roles = M.dep.roles;
  for (const [who, a] of [["honest", roles.honest_server], ["dishonest-demo", roles.dishonest_demo_server]]) {
    const [free] = await call(M.SWORN, "servers(address) view returns (uint128,uint128,uint64)", [a]);
    log(`• ${who} provider ${short(a)} free bond ${formatUnits(free, M.bondDecimals)} ${M.bondSymbol}`);
    if (free < 500n * 10n ** BigInt(M.bondDecimals)) fail(`--live refused: ${who} provider has < 500 free bond`);
  }
  const takeDir = path.join(dir, "takes", `demo-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`);
  mkdirSync(takeDir, { recursive: true });
  const rawFile = path.join(takeDir, "scene1.raw.mp4");
  log(`• LIVE take → ${rel(takeDir)}  (this sends real Moderato transactions)`);

  const browser = await launch();
  const t = { dir: takeDir, rawFile, events: [], jobs: [] };
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(600000);
    page.on("response", async (r) => { // the backend's own job clock, for the label and a cross-check
      if (/\/api\/challenge\//.test(r.url()) && r.ok()) { try { const j = await r.json(); t.jobs.push({ at: Date.now(), job: { phase: j.phase, startedAt: j.startedAt, phaseStartedAt: j.phaseStartedAt, txHash: j.txHash } }); } catch {} }
    });
    // The app polls continuously: never wait for network idle.
    await page.goto(APP + "/", { waitUntil: "domcontentloaded", timeout: 600000 });
    await page.waitForSelector("[data-testid=roles]", { timeout: 600000 });
    await page.waitForSelector("section.card.liar", { timeout: 600000 });
    await sleep(3000);
    const click = async (sel, text) => {
      const ok = await page.evaluate((s, x) => {
        const b = [...document.querySelectorAll(`${s} button`)].find((e) => e.textContent.includes(x) && !e.disabled);
        if (!b) return false; b.click(); return true;
      }, sel, text);
      if (!ok) fail(`no enabled "${text}" button in ${sel}`);
    };
    const waitFor = async (sel, what, ms) => {
      const err = `${sel.split(" ")[0]} [data-testid=error]`;
      const r = await page.waitForFunction((s, e) => document.querySelector(s) ? "ok" : document.querySelector(e) ? "error" : false,
        { timeout: ms, polling: 250 }, sel, err);
      if ((await r.jsonValue()) !== "ok") {
        const msg = await page.evaluate((e) => document.querySelector(e)?.textContent, err);
        fail(`${what} failed in the app: ${msg}`);
      }
    };
    const scrollTo = (sel, block) => page.evaluate((s, b) => {
      const el = document.querySelector(s); const top = el.getBoundingClientRect().top + scrollY;
      const y = b === "start" ? top - 76 : top - (innerHeight - el.getBoundingClientRect().height) / 2;
      scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }, sel, block);

    // Step 1 (honest provider), before the camera rolls: its card is scene 2's honest card.
    await click("section.card:not(.liar)", "Buy preflight");
    await waitFor("section.card:not(.liar) [data-testid=answer]", "honest preflight", 600000);
    await scrollTo("section.card:not(.liar)", "start"); await sleep(1500);
    const honestCard = await page.$("section.card:not(.liar)");
    await honestCard.screenshot({ path: path.join(takeDir, "honest-card.png") });
    t.honestReserveTx = await page.evaluate(() => [...document.querySelectorAll("section.card:not(.liar) [data-testid=answer] a")].find((a) => /reserve tx/.test(a.textContent))?.href.split("/tx/")[1]);
    if (!t.honestReserveTx) fail("honest card shows no reserve tx link");
    log(`• honest preflight reserved: ${t.honestReserveTx}`);
    await page.evaluate(() => scrollTo({ top: 0 })); await sleep(1500);

    // Scene 1: roles first, then Step 2 end to end.
    const recorder = await newRecorder(page);
    await recorder.start(rawFile);
    const t0 = Date.now();
    const mark = (e) => { const s = (Date.now() - t0) / 1000; t.events.push({ e, t: +s.toFixed(3) }); log(`    ${s.toFixed(1).padStart(6)} s  ${e}`); };
    mark("roles");
    await sleep(3500);
    await scrollTo("section.card.liar", "start"); await sleep(1800);
    mark("buy");
    await click("section.card.liar", "Buy preflight");
    await waitFor("section.card.liar [data-testid=answer]", "dishonest preflight", 600000);
    mark("answer");
    await scrollTo("section.card.liar [data-testid=answer]", "center"); await sleep(4500);
    mark("send");
    await click("section.card.liar", "Send 500");
    await waitFor("section.card.liar [data-testid=payment]", "payment", 600000);
    mark("succeeded");
    await scrollTo("section.card.liar [data-testid=payment]", "center"); await sleep(6500); // the contrast, held
    mark("challenge");
    await click("section.card.liar [data-testid=challenge]", "Challenge the answer");
    await page.waitForSelector("[data-testid=elapsed]", { timeout: 600000 });
    await scrollTo("[data-testid=challenge]", "start");
    // Phase watch: the app's own phase list (li.now) and its real elapsed clock.
    let last = "";
    for (;;) {
      const st = await page.evaluate(() => ({
        now: document.querySelector("[data-testid=challenge] .phases li.now")?.textContent ?? "",
        payout: !!document.querySelector("[data-testid=payout]"),
        failed: /Challenge failed/.test(document.querySelector("[data-testid=challenge]")?.textContent ?? ""),
        err: document.querySelector("[data-testid=challenge] [data-testid=error]")?.textContent ?? "",
        clock: document.querySelector("[data-testid=elapsed]")?.textContent ?? "",
      }));
      const ph = /^.?Proving/.test(st.now) ? "proving" : /^.?Submitting/.test(st.now) ? "submitting" : /^.?Witness/.test(st.now) ? "witness" : /^.?Paid/.test(st.now) ? "paid" : st.payout ? "payout" : st.now ? "other" : last;
      if (ph !== last) { mark(`phase:${ph} clock ${st.clock}`); last = ph; }
      if (st.failed || (st.err && !st.payout)) { mark("failed"); t.error = st.err; break; }
      if (st.payout) break;
      await sleep(250);
    }
    if (!t.error) {
      mark("payout");
      await scrollTo("[data-testid=payout]", "center"); await sleep(6000);
      t.payoutTx = await page.evaluate(() => [...document.querySelectorAll("[data-testid=payout] a")].find((a) => /payout tx/.test(a.textContent))?.href.split("/tx/")[1]);
      t.paymentTx = await page.evaluate(() => [...document.querySelectorAll("section.card.liar [data-testid=payment] a")].find((a) => /payment tx/.test(a.textContent))?.href.split("/tx/")[1]);
      t.reserveTx = await page.evaluate(() => [...document.querySelectorAll("section.card.liar [data-testid=answer] a")].find((a) => /reserve tx/.test(a.textContent))?.href.split("/tx/")[1]);
    }
    mark("end");
    t.wall = (Date.now() - t0) / 1000;
    await recorder.stop();
  } finally {
    writeJson(path.join(takeDir, "take.json"), { ...t, dir: undefined, rawFile: path.basename(rawFile) });
    await browser.close();
  }
  if (t.error) fail(`the challenge failed in the app: ${t.error} — raw footage kept in ${rel(takeDir)}`);
  return { ...t, rawFile: path.basename(rawFile) };
}

async function editScene1(t) {
  const raw = path.join(t.dir, t.rawFile);
  if (!existsSync(raw)) fail(`${raw} is missing`);
  // The recorder's file can drift from wall time under load; map wall-clock marks onto it proportionally.
  const rawDur = duration(raw);
  const k = Math.min(1, rawDur / t.wall);
  const at = (e) => (t.events.find((x) => x.e.startsWith(e)) ?? fail(`take has no "${e}" mark`)).t * k;
  const ps = at("phase:proving");
  const pe = t.events.find((x) => /^phase:(submitting|paid|payout)/.test(x.e) || x.e === "payout").t * k;
  const end = Math.min(at("end"), rawDur);
  // The real proving duration, from the backend's job clock when it was captured (else the DOM span).
  const lastJob = t.jobs?.at(-1)?.job;
  const realProve = lastJob?.phaseStartedAt?.proving && lastJob?.phaseStartedAt?.submitting
    ? (lastJob.phaseStartedAt.submitting - lastJob.phaseStartedAt.proving) / 1000 : (pe - ps) / k;
  const rest = ps + (end - pe);
  const target = scenes.slice(1).reduce((a, s) => a + s.hold, 0);
  let tl = TIMELAPSE_S;
  if (rest + tl + target > MAX_TOTAL - 1) tl = Math.max(6, MAX_TOTAL - 1 - target - rest);
  const factor = (pe - ps) / tl;
  const total1 = +(rest + tl).toFixed(3);
  const mmss = (s) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s`;
  const label = `time-lapse · this challenge · ${mmss(realProve)} → ${tl} s`;
  log(`• scene 1 edit: proving ${ps.toFixed(1)}–${pe.toFixed(1)} s of the take (${mmss(realProve)} real) → ${tl} s (×${factor.toFixed(1)}); scene 1 = ${total1} s`);

  // Burned-in overlays, rendered as transparent 1920×1080 PNGs (this ffmpeg has no drawtext).
  const tlPng = path.join(t.dir, "timelapse.png"), discPng = path.join(t.dir, "disclosure.png");
  const browser = await launch();
  try {
    const p = await browser.newPage();
    const pill = (html, pos) => `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=block"></head><body style="margin:0;width:1280px;height:720px;background:transparent">
      <div style="position:absolute;${pos};left:0;right:0;text-align:center;font:600 22px/1.35 Inter,-apple-system,system-ui,sans-serif">${html}</div></body></html>`;
    await p.setContent(pill(`<span style="display:inline-block;background:#2b3078;color:#fff;padding:10px 20px;text-align:left;font-family:'Geist Mono',ui-monospace,Menlo,monospace;font-weight:500;font-size:17px;letter-spacing:.06em;text-transform:uppercase">${label}<br>
      <span style="font-weight:400;font-size:12px;letter-spacing:.06em;color:#d4d4d4">the app's clock shows the real elapsed time · same run, not a recording</span></span>`, "top:120px;text-align:right!important;padding-right:110px"));
    await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: tlPng, omitBackground: true });
    await p.setContent(pill(`<span style="display:inline-block;background:#fffdf8;border:1px solid #e2dccf;color:#1d1b2e;padding:6px 14px;font-family:'Geist Mono',ui-monospace,Menlo,monospace;font-weight:500;font-size:11px;letter-spacing:.06em;text-transform:uppercase">
      Tempo Moderato testnet · unaudited · no users, revenue or mainnet · compensation is capped by the reserved bond · it covers the answer about one block, not a later payment</span>`, "bottom:10px"));
    await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: discPng, omitBackground: true });
  } finally { await browser.close(); }

  const out = path.join(t.dir, "scene1.mp4");
  const fc = [
    `[0:v]fps=30,scale=1920:1080,setsar=1,split=3[s0][s1][s2]`,
    `[s0]trim=0:${ps},setpts=PTS-STARTPTS[a]`,
    `[s1]trim=${ps}:${pe},setpts=(PTS-STARTPTS)/${factor},fps=30[b0]`,
    `[b0][1:v]overlay=0:0:shortest=1[b]`,
    `[s2]trim=${pe}:${end},setpts=PTS-STARTPTS[c]`,
    `[a][b][c]concat=n=3:v=1:a=0[v1]`,
    `[v1][2:v]overlay=0:0:shortest=1,scale=in_range=full:out_range=tv,format=yuv420p[v]`,
  ].join(";");
  execFileSync(FFMPEG, ["-v", "error", "-i", raw, "-loop", "1", "-framerate", "30", "-i", tlPng, "-loop", "1", "-framerate", "30", "-i", discPng,
    "-filter_complex", fc, "-map", "[v]", "-an", "-t", String(total1),
    "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-crf", "20", "-preset", "slow",
    "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", out, "-y"]);
  const got = duration(out);
  if (Math.abs(got - total1) > 0.15) fail(`scene1.mp4 is ${got} s, expected ${total1} s`);

  // The take's challenge, read back from Moderato: status 1, Slashed from the deployed Sworn.
  if (t.payoutTx) {
    const r = await receipt(t.payoutTx, "live challenge");
    const s = swornEvent(r, evSig("Slashed"), "live challenge");
    log(`• live challenge ${t.payoutTx}: status 1, Slashed coverage ${formatUnits(s.coverage, M.bondDecimals)} ${M.bondSymbol} to ${s.client}`);
  }
  const answerAt = at("answer"), paidAt = ps + tl + (at("payout") - pe);
  log(`  by 0:60? answer ${answerAt.toFixed(1)} s · succeeded ${at("succeeded").toFixed(1)} s · payout ${paidAt.toFixed(1)} s`);
  return { file: out, hold: got, realProve, tl, payoutAt: paidAt };
}

// ── scenes 2–5: sources ──────────────────────────────────────────────────────────────────────────
const fs1 = M.dep.firstSlash ?? fail("moderato.json: no firstSlash");
const RUN = fs1.run;
const runLog = read(RUN, "Moderato run log");
const line = (re, what) => (runLog.match(re) ?? fail(`${RUN}: no ${what}`))[0];

// Scene 2 — the honest card: the live take's screenshot, else the honest S-1 answer from the run log.
let honest;
if (take && existsSync(path.join(take.dir, "honest-card.png"))) {
  honest = { hide: ["d2log"], honestShot: "data:image/png;base64," + readFileSync(path.join(take.dir, "honest-card.png")).toString("base64"),
    honestSrc: "the demo app, this take" };
} else {
  const hr = JSON.parse(line(/honest response: \{.*\}\s*$/m, "honest response").replace(/^.*?honest response: /, ""));
  const reservedLine = line(/^CHECK S-1\.reserved PASS .*$/m, "S-1.reserved");
  const rtx = (reservedLine.match(/reserveTx (0x[0-9a-f]{64})/) ?? fail("S-1.reserved names no reserveTx"))[1];
  const rr = await receipt(rtx, "honest reserve");
  const ev = swornEvent(rr, evSig("Reserved"), "honest reserve");
  if (BigInt(hr.question.blockNumber) !== ev.blockNumber) fail("honest reserve: Reserved.blockNumber != the run log's question");
  const tdec = Number(await call(getAddress(hr.question.token), "decimals() view returns (uint8)"));
  const delta = BigInt(hr.answer.receiverAfter) - BigInt(hr.answer.receiverBefore);
  honest = { hide: ["d2live"], honestSrc: "Moderato run log, S-1 (not the app)", honestBlock: Number(ev.blockNumber).toLocaleString("en-US"),
    honestAnswer: `receiver ${delta >= 0n ? "+" : "−"}${fmt2(delta < 0n ? -delta : delta, tdec)}`,
    honestReserved: `${fmt2(ev.coverage, M.bondDecimals)} ${M.bondSymbol} · status 1`, honestReserveTx: `${EXPLORER}/tx/${rtx}` };
}
const RECHECK = "out/e2e/moderato-20261003T064745Z-honestReverts-recheck.log";
const rc = read(RECHECK, "honest recheck log").split("\n");
const rcDiff = rc.find((l) => l.startsWith("[sworn-challenge] fields that differ: ")) ?? fail(`${RECHECK}: no "fields that differ"`);
const rcDry = rc.find((l) => /^\[sworn-challenge\] dry-run .*"error":"AnswerCorrect","reverted":true/.test(l)) ?? fail(`${RECHECK}: no AnswerCorrect dry-run line`);
if (rcDiff !== "[sworn-challenge] fields that differ: []") fail(`${RECHECK}: ${rcDiff}`);
const recheckLines = ["$ sworn-challenge --proof <real Groth16> --dry-run", "fields that differ: []",
  "dry-run (eth_call only, nothing sent):", `  ${rcDry.replace(/^.*nothing sent\): /, "")}`].join("\n");
const solL = sol.split("\n");
const iv = solL.findIndex((l) => /ISP1Verifier\(SP1_VERIFIER\)\.verifyProof\(GUEST_VKEY/.test(l));
const ia = solL.findIndex((l) => /revert AnswerCorrect\(\)/.test(l));
if (iv < 0 || ia < 0 || ia !== iv + 1) fail(`Sworn.sol: verifyProof (line ${iv + 1}) is no longer immediately followed by AnswerCorrect (line ${ia + 1})`);
const solLines = [iv - 1, iv, ia].map((i) => `${String(i + 1).padStart(4)}  ${solL[i].trim().replace(/\s*\/\/.*$/, "")}`).join("\n");

// Scene 3 — the five checks, from the run log's own lines (read, not typed).
const sdk = line(/^CHECK S-1\.sdkVerify PASS .*$/m, "S-1.sdkVerify");
const wit = line(/^CHECK S-1\.witness PASS .*$/m, "S-1.witness");
const other = line(/^CHECK S-3\.otherContract PASS .*$/m, "S-3.otherContract");
const pick = (s, re, what) => (s.match(re) ?? fail(`${RUN}: ${what} not in "${s.slice(0, 80)}…"`))[0];
const c2 = pick(sdk, /Reserved by 0x[0-9a-fA-F]{40} for client=self/, "reservation for self").replace(/0x[0-9a-fA-F]{40}/, (a) => short(a));
const wms = Number(pick(wit, /witness protected in (\d+) ms/, "witness time").match(/\d+/)[0]);
const rejects = runLog.match(/^CHECK S-3\.\S+ PASS rejected with [A-Z_0-9]+/gm) ?? fail(`${RUN}: no S-3 rejections`);
const codes = [...new Set(rejects.map((l) => l.match(/with ([A-Z_0-9]+)/)[1]))];

// Scene 4 — AC-2 tail, the three patches, Zones, the deployed contracts.
const ac2 = ac2Line();
const ac2Tail = read("out/ac2_run.log", "AC-2 log").trim().split("\n").slice(-6)
  .map((l) => l.replace(/0x[0-9a-f]{64}/g, (h) => short(h)).replace(/ mismatches=\[\]$/, " ✓")).join("\n");
const patch = read("patches/tempo.patch", "Tempo patches");
const ids = [...new Set((patch.match(/SPIKE-PATCH-\d+/g) ?? []).map((x) => x.match(/\d+$/)[0]))].sort();
if (ids.join(",") !== "1,2,3") fail(`patches/tempo.patch marks SPIKE-PATCH ${ids.join(",")} — expected exactly 1,2,3`);
const files = patch.split(/^diff --git a\//m).slice(1).map((c) => ({
  f: c.slice(0, c.indexOf(" ")).replace(/^crates\//, ""), hunks: (c.match(/^@@ /gm) ?? []).length,
  ids: [...new Set((c.match(/SPIKE-PATCH-\d/g) ?? []).map((x) => x.slice(-1)))].join(","),
}));
const why = ids.map((n) => {
  const m = patch.match(new RegExp(`SPIKE-PATCH-${n}: ([^\\n]+)`)) ?? fail(`SPIKE-PATCH-${n} has no description`);
  return `#${n} ${m[1].split(/; |: /)[0].replace(/\.$/, "").slice(0, 56)}`;
});
const patchLines = [...why, "", ...files.map((x) => `${x.f.padEnd(44).slice(0, 44)} ${String(x.hunks).padStart(2)} @@  #${x.ids}`)].join("\n");
const hunks = files.reduce((a, x) => a + x.hunks, 0);
const zones = zonesQuote();
const owner = noOwner();

// Scene 5 — the reserve receipt's fee, the README hero.
const FEE_TX = "0xb2bf1aec2cf0214b7b266c01984b3d27974b9f959d8c211c6008800bea6c7529";
if (!runLog.includes(`TX S-1-reserve ${FEE_TX}`)) fail(`${RUN} does not name ${FEE_TX} as S-1-reserve`);
const fr = await receipt(FEE_TX, "reserve (fee)");
const gasUsed = BigInt(fr.gasUsed), price = BigInt(fr.effectiveGasPrice);
const feeToken = getAddress(fr.feeToken ?? fail("reserve receipt has no feeToken"));
const fdec = Number(await call(feeToken, "decimals() view returns (uint8)"));
const fsym = await call(feeToken, "symbol() view returns (string)");
const units = (gasUsed * price) / 10n ** 12n; // DEMO.md: gasUsed × effectiveGasPrice / 1e12 = fee in base units
const feeHuman = formatUnits(units, fdec);
const hero = (read("README.md", "README").match(/^\*\*(.+)\*\*\s*$/m) ?? fail("README.md has no bold one-line claim"))[1];
const repoUrl = ghRepoPublic("psyto/sworn", "repo");

const data = {
  scenes: [...(scene1 ? [] : ["d1p"]), "d2", "d3", "d4", "d5"],
  placeholderHold: `${scenes[0].hold} s (DEMO.md scene 1 words ÷ 2.2)`,
  ...honest, recheckSrc: RECHECK.replace(/^out\/e2e\//, ""), recheckLines, solLines,
  runSrc: path.basename(RUN),
  c1: pick(sdk, /question=asked/, "question=asked"), c2, c3: pick(sdk, /digest local==digestOf==event/, "digest"),
  c4: `${pick(sdk, /GUEST_VKEY pinned/, "GUEST_VKEY pinned")} · ${pick(other, /rejected with WRONG_CONTRACT/, "WRONG_CONTRACT")}`,
  c5: pick(wit, /witness protected in \d+ ms/, "witness"), witnessSecs: `in ${(wms / 1000).toFixed(1)} s`,
  rejectCount: String(rejects.length), rejectCodes: codes.join(" · "),
  maxAge: `${M.maxAge} blocks`, vkey: M.vkey,
  ac2Tail, patchCount: `3 patches (SPIKE-PATCH-1..3) · ${files.length} files · ${hunks} hunks`, patchLines,
  zonesSrc: "tempoxyz/zones crates/spf/src/lib.rs, via GitHub API now", zonesB: zones.b,
  sworn: M.SWORN, verifier: M.verifier, verifierVersion: M.verifierVersion, noOwner: owner,
  feeTx: short(FEE_TX), feeAmount: `${feeHuman} ${fsym}`,
  feeCalc: `gasUsed            ${gasUsed.toLocaleString("en-US")}\n× effectiveGasPrice ${price.toLocaleString("en-US")}\n÷ 1e12             = ${units} units (${fdec} decimals)`,
  challengeHours: `${Number(M.challengePeriod) / 3600} h (CHALLENGE_PERIOD)`, repo: repoUrl, hero,
};
log(`• sources: recheck AnswerCorrect ok, Sworn.sol ${iv + 1}/${ia + 1}, 5 SDK checks, ${rejects.length} S-3 rejections, ${ac2.line}, patches 1..3 (${hunks} hunks), fee ${units} units = ${feeHuman} ${fsym}`);

// ── record scenes (2–5, or 1p–5) ─────────────────────────────────────────────────────────────────
await checkOverflow("demo.html", data, data.scenes);
log("• layout: nothing outside its card or the frame");
const slideHolds = scenes.slice(scene1 ? 1 : 0).map((s) => s.hold);
const slidesOut = path.join(dir, scene1 ? "demo.slides.mp4" : "demo.mp4");
await recordSlides({ html: "demo.html", data, ids: data.scenes, holds: slideHolds, raw: path.join(dir, "demo.raw.mp4"), out: slidesOut });
const out = path.join(dir, "demo.mp4");
if (scene1) { concat([scene1.file, slidesOut], out); rmSync(slidesOut, { force: true }); }
const holds = [scene1 ? +scene1.hold.toFixed(3) : scenes[0].hold, ...scenes.slice(1).map((s) => s.hold)];
const TOTAL = holds.reduce((a, b) => a + b, 0);
const got = duration(out);
if (Math.abs(got - TOTAL) > 0.2) fail(`demo.mp4 is ${got} s, expected ${TOTAL} s`);
if (got > MAX_TOTAL) fail(`demo.mp4 is ${got} s > ${MAX_TOTAL} s`);
const starts = holds.reduce((a, h) => [...a, a.at(-1) + h], [0]);
const cues = writeSrt(scenes, starts, path.join(dir, "demo.srt"));
writeJson(path.join(dir, "demo.marks.json"), {
  name: "demo", script: "video/DEMO.md", mode: MODE, holds, titles: scenes.map((s) => s.title),
  take: take ? rel(take.dir) : null, timelapse: scene1 ? { realProveSecs: +scene1.realProve.toFixed(1), shownSecs: scene1.tl } : null,
  note: scene1 ? `Scene 1 is a live take (${rel(take.dir)}); its clip is ${scene1.hold.toFixed(1)} s against ${scenes[0].hold} s of narration — pause where the screen is silent.`
    : "Scene 1 is a PLACEHOLDER (recorded without --live). Do not publish this file as the demo.",
  recordedAt: new Date().toISOString(),
});
log(`\n✓ ${rel(out)}  (${got.toFixed(2)} s, holds ${holds.join(" / ")}${scene1 ? "" : " — scene 1 is a placeholder"})`);
log(`✓ video/demo.srt  (${cues} cues)`);
log(`  next: node video/split-scenes.mjs demo`);
