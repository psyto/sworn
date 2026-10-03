// Records video/pitch.mp4 — Sworn's ≤ 2 min CWF pitch, five scenes, SILENT, 1920×1080 — and
// video/pitch.srt with the narration of video/PITCH.md timed to where each scene landed.
//
//   node video/record-pitch.mjs            # then: node video/split-scenes.mjs pitch
//
// Scene holds come from PITCH.md (words ÷ 2.2 w/s, rounded up to 0.5 s). Every figure and quote on screen
// is read now from the source PITCH.md's claims table names; a missing or changed source THROWS:
//   deployments/moderato.json ↔ Moderato (codehash, GUEST_VKEY, SP1_VERIFIER, VERSION, MAX_AGE…),
//   the three first-slash receipts (reserve / payment / challenge) with balances at block−1 and block,
//   out/ac2_run.log, the vendored tempo source, tempoxyz/zones via `gh api`, mpp.dev, ethglobal.com,
//   GitHub (public repos), contracts/scripts/no-owner.sh (source scan, run now).
// Reads only. No keys, no transactions.
import path from "node:path";
import { writeFileSync } from "node:fs";
import { parseAbiItem, decodeEventLog, getAddress, formatUnits, toEventSelector } from "viem";
import {
  dir, repo, read, fail, log, rel, short, EXPLORER, parseScenes, rpc, call, receipt, fetchText, ghRepoPublic,
  zonesQuote, moderato, ac2Line, noOwner, recordSlides, checkOverflow, writeSrt, writeJson, duration,
} from "./lib/rec.mjs";

const MAX_TOTAL = 120;
const scenes = parseScenes("video/PITCH.md");
if (scenes.length !== 5) fail(`PITCH.md has ${scenes.length} scenes, expected 5`);
const TOTAL = scenes.reduce((a, s) => a + s.hold, 0);
log(`• pitch: scene holds (words ÷ 2.2 w/s, rounded up to 0.5 s)`);
for (const s of scenes) log(`    scene ${s.n}: ${String(s.words).padStart(3)} words → ${s.hold.toFixed(1)} s  (${s.title})`);
log(`    total ${TOTAL.toFixed(1)} s`);
if (TOTAL > MAX_TOTAL) fail(`pitch runs ${TOTAL} s > ${MAX_TOTAL} s — cut words in PITCH.md`);

// ── chain ────────────────────────────────────────────────────────────────────────────────────────
const M = await moderato();
const fs1 = M.dep.firstSlash ?? fail("moderato.json: no firstSlash");
const sol = read("contracts/src/Sworn.sol", "Sworn source");
const evSig = (name) => {
  const m = sol.match(new RegExp(`^\\s*event ${name}\\(([^)]*)\\);`, "m")) ?? fail(`Sworn.sol declares no ${name} event`);
  return parseAbiItem(`event ${name}(${m[1].replace(/\s+/g, " ").trim()})`);
};
const swornEvent = (r, ev, what) => {
  const lg = r.logs.find((l) => getAddress(l.address) === M.SWORN && l.topics[0] === toEventSelector(ev)) ?? fail(`${what}: no ${ev.name} event from Sworn`);
  return decodeEventLog({ abi: [ev], data: lg.data, topics: lg.topics }).args;
};
const blk = (r) => parseInt(r.blockNumber, 16);
const fmt = (v, d) => {
  const s = formatUnits(v, d);
  const [i, f = ""] = s.split(".");
  return `${i}.${(f + "00").slice(0, 2)}`;
};
const signed = (v, d) => (v > 0n ? "+" : v < 0n ? "−" : "+") + fmt(v < 0n ? -v : v, d);

// The real payment: status 1; its token Transfer goes to ReceivePolicyGuard; guard +amount, R′ +0.
const GUARD = getAddress((read("demo/src/chain/config.ts", "demo chain config").match(/RECEIVE_POLICY_GUARD[^"]*"(0x[0-9a-fA-F]{40})"/) ?? fail("demo config.ts: no RECEIVE_POLICY_GUARD"))[1]);
const runLog = read(fs1.run, "Moderato run log");
const dishonest = runLog.match(/dishonest response: (\{.*\})\s*$/m) ?? fail(`${fs1.run}: no dishonest response line`);
const rPrime = getAddress(JSON.parse(dishonest[1]).answer.receiver);
if (rPrime !== getAddress(M.dep.roles.deployer_and_challenger)) fail(`R′ ${rPrime} is not the deployer named in moderato.json`);
const payTx = fs1.realPaymentDivertedToReceivePolicyGuard;
const payR = await receipt(payTx, "payment");
const TRANSFER = toEventSelector(parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 amount)"));
const tl = payR.logs.find((l) => l.topics[0] === TRANSFER && getAddress("0x" + l.topics[2].slice(26)) === GUARD) ?? fail("payment: no Transfer to ReceivePolicyGuard");
const token = getAddress(tl.address);
const tdec = Number(await call(token, "decimals() view returns (uint8)"));
const bal = (who, b) => call(token, "balanceOf(address) view returns (uint256)", [who], b);
const pb = blk(payR);
const guardD = (await bal(GUARD, pb)) - (await bal(GUARD, pb - 1));
const rD = (await bal(rPrime, pb)) - (await bal(rPrime, pb - 1));
if (guardD !== BigInt(tl.data) || guardD <= 0n) fail(`payment: guard delta ${guardD} != transferred ${BigInt(tl.data)}`);
if (rD !== 0n) fail(`payment: R′ delta ${rD}, expected 0`);
log(`• payment ${short(payTx)} block ${pb}: guard ${signed(guardD, tdec)}, R′ ${signed(rD, tdec)}`);

// The vendored Tempo line that does it.
const TIP20 = "tempo/crates/precompiles/src/tip20/mod.rs";
const tip = read(TIP20, "vendored Tempo (scripts/fetch-tempo.sh)").split("\n");
const ti = tip.findIndex((l) => l.includes("If blocked, moves the funds into the guard"));
if (ti < 0) fail(`${TIP20}: the receive-policy comment is gone`);
const tip20Lines = [ti, ti + 1].map((i) => `${String(i + 1).padStart(4)}  ${tip[i].trim()}`).join("\n")
  .replace(/(returns `true`\.).*$/s, "$1"); // stop at the end of the sentence that says it
if (ti + 1 !== 1349) log(`  (note: PITCH.md cites ${TIP20}:1349; the line is now ${ti + 1})`);

// The reserve: Reserved from Sworn, coverage in the bond token.
const resR = await receipt(fs1.dishonestReserve, "reserve");
const reserved = swornEvent(resR, evSig("Reserved"), "reserve");
const challengeHours = Number(M.challengePeriod) / 3600;
// The slash: Slashed from Sworn; the client's bond-token balance +coverage at block−1 → block.
const slR = await receipt(fs1.challengeTx, "challenge");
const slashed = swornEvent(slR, evSig("Slashed"), "challenge");
const sb = blk(slR);
const cD = (await call(M.bondToken, "balanceOf(address) view returns (uint256)", [slashed.client], sb)) -
  (await call(M.bondToken, "balanceOf(address) view returns (uint256)", [slashed.client], sb - 1));
if (cD !== slashed.coverage) fail(`challenge: client delta ${cD} != coverage ${slashed.coverage}`);
log(`• reserve ${short(fs1.dishonestReserve)} coverage ${reserved.coverage}; slash ${short(fs1.challengeTx)} client +${cD}`);

// ── files, the web ───────────────────────────────────────────────────────────────────────────────
const ac2 = ac2Line();
const zones = zonesQuote();
const owner = noOwner();
const MPP_SENTENCE = "lets any client—agents, apps, or humans—pay for any service in the same HTTP request.";
const llms = await fetchText("https://mpp.dev/llms-full.txt", "mpp.dev");
if (!llms.includes(`The Machine Payments Protocol (MPP) ${MPP_SENTENCE}`)) fail(`mpp.dev/llms-full.txt no longer says "MPP ${MPP_SENTENCE}"`);
const REFUND = "Refund decisions are up to your service.";
const refunds = (await fetchText("https://mpp.dev/advanced/refunds", "mpp.dev refunds")).replace(/<[^>]+>/g, "");
if (!refunds.includes(REFUND)) fail(`mpp.dev/advanced/refunds no longer says "${REFUND}"`);
const repoUrl = ghRepoPublic("psyto/sworn", "repo");
const rethlabRepo = ghRepoPublic("psyto/rethlab", "rethlab");
await fetchText("https://rethlab.fabrknt.com", "rethlab site");
const EG = "https://ethglobal.com/showcase/reckn-47t6m";
const eg = (await fetchText(EG, "ETHGlobal showcase")).replace(/<!-- -->/g, "");
const prize = eg.match(/<h4[^>]*>\s*(Uniswap Foundation)\s*-\s*(.*?)\s*(3rd place)\s*<\/h4>/) ?? fail(`${EG}: no "Uniswap Foundation … 3rd place" prize`);
if (!/ETHGlobal Tokyo 2026/.test(eg)) fail(`${EG}: does not say ETHGlobal Tokyo 2026`);
log(`• web: mpp.dev quotes ok, zones quote ok, ${repoUrl} public, ETHGlobal: ${prize[1]} — ${prize[2]} ${prize[3]}`);

const data = {
  scenes: ["p1", "p2", "p3", "p4", "p5"],
  mppLine: `MPP ${MPP_SENTENCE}`, mppSrc: "mpp.dev/llms-full.txt", refundLine: REFUND, refundSrc: "mpp.dev/advanced/refunds",
  payStatus: payR.status === "0x1" ? "status 1 · success" : fail("unreachable"), payBlock: pb.toLocaleString("en-US"),
  rPrimeShort: short(rPrime), rPrimeDelta: signed(rD, tdec), guardShort: short(GUARD), guardDelta: signed(guardD, tdec),
  payUrl: `${EXPLORER}/tx/${payTx}`, tip20Src: `${TIP20} (vendored, pinned)`, tip20Lines,
  resStatus: "status 1", resCoverage: `${fmt(reserved.coverage, M.bondDecimals)} ${M.bondSymbol}`, challengeHours: `${challengeHours} h`,
  resUrl: `${EXPLORER}/tx/${fs1.dishonestReserve}`, noOwner: owner,
  verifierVersion: M.verifierVersion, zonesA: zones.a, zonesB: zones.b, zonesSrc: zones.src,
  ac2: ac2.matched, ac2Src: `out/ac2_run.log · ${ac2.note}`,
  slashStatus: "status 1 · Slashed event", slashBlock: sb.toLocaleString("en-US"),
  slashPaid: `+${fmt(cD, M.bondDecimals)} ${M.bondSymbol}`, slashUrl: `${EXPLORER}/tx/${fs1.challengeTx}`,
  repo: repoUrl, rethlab: `rethlab — ${rethlabRepo} · rethlab.fabrknt.com`,
  ethglobal: `ETHGlobal Tokyo 2026 — ${prize[1]}, ${prize[3]}`,
  ethglobalSrc: `with Reckn · ${prize[2].trim()} · ${EG.replace(/^https:\/\//, "")}`,
  sworn: M.SWORN, vkey: M.vkey, verifier: M.verifier,
};

// ── layout check, then record ────────────────────────────────────────────────────────────────────
await checkOverflow("pitch.html", data, data.scenes);
log("• layout: nothing outside its card or the frame");
const out = path.join(dir, "pitch.mp4");
const marks = await recordSlides({ html: "pitch.html", data, ids: data.scenes, holds: scenes.map((s) => s.hold), raw: path.join(dir, "pitch.raw.mp4"), out });
const got = duration(out);
if (Math.abs(got - TOTAL) > 0.1) fail(`pitch.mp4 is ${got} s, expected ${TOTAL} s`);
const starts = scenes.reduce((a, s) => [...a, a.at(-1) + s.hold], [0]);
const cues = writeSrt(scenes, starts, path.join(dir, "pitch.srt"));
writeJson(path.join(dir, "pitch.marks.json"), {
  name: "pitch", script: "video/PITCH.md", holds: scenes.map((s) => s.hold), titles: scenes.map((s) => s.title),
  recorderMarks: marks.map((m) => +m.toFixed(3)), recordedAt: new Date().toISOString(),
});
log(`\n✓ ${rel(out)}  (${got.toFixed(2)} s, holds ${scenes.map((s) => s.hold).join(" / ")})`);
log(`✓ video/pitch.srt  (${cues} cues)`);
log(`  next: node video/split-scenes.mjs pitch`);
