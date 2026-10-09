// Records pitch-d.mp4: pitch C's story, scaled to the frame, with Tempo Zones named first, one evidence scene, the
// business (buyer, Proof Operations, beside TEE) and the scope said aloud. Earlier pitch versions are untouched.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { getAddress, keccak256 } from "viem";
import { dir, read, fail, log, rpc, parseScenes, checkOverflow, recordSlides, duration, writeSrt, writeJson, fetchText } from "./lib/rec.mjs";

const scenes = parseScenes("video/PITCH-D.md");
const expected = [15, 15, 18, 20, 22, 20, 16];
if (scenes.length !== expected.length) fail(`PITCH-D.md has ${scenes.length} scenes, expected ${expected.length}`);
const holds = scenes.map((s, i) => { if (s.hold > expected[i]) fail(`scene ${s.n} needs ${s.hold}s at 2.2 words/s, above its ${expected[i]}s target`); return expected[i]; });
const total = holds.reduce((a, b) => a + b, 0); if (total !== 126) fail(`pitch D is ${total}s, expected 126s`);

const dep = JSON.parse(read("deployments/moderato.json", "deployments/moderato.json"));
const fixture = dep.SwornZoneVerifierWithdrawal ?? fail("missing fixture record");
const own = dep.OwnZone ?? fail("missing OwnZone record");
const lower = (x) => String(x).toLowerCase();
async function checkedReceipt(tx, status, to, label) { const r = await rpc("eth_getTransactionReceipt", [tx]); if (!r || r.status !== status || lower(r.to) !== lower(to)) fail(`${label}: receipt no longer matches`); return r; }
async function checkedCode(address, expected, label) { const code = await rpc("eth_getCode", [address, "latest"]); if (!code || code === "0x" || lower(keccak256(code)) !== lower(expected)) fail(`${label}: bytecode no longer matches deployment record`); }
await checkedCode(fixture.address, fixture.codehash, "fixture verifier"); await checkedCode(own.SwornZoneVerifier.address, own.SwornZoneVerifier.codehash, "OwnZone verifier"); await checkedCode(own.OwnZonePortal.address, own.OwnZonePortal.codehash, "OwnZone portal");
await checkedReceipt(fixture.attest.tx, "0x1", fixture.address, "fixture attestation"); for (const b of own.batches) await checkedReceipt(b.submitTx, "0x1", own.OwnZonePortal.address, `OwnZone batch ${b.zoneBlocks}`); await checkedReceipt(own.payout.tx, "0x1", own.OwnZonePortal.address, "OwnZone payout"); await checkedReceipt(own.forgedBatch.tx, "0x0", own.OwnZonePortal.address, "forged batch");
if (own.zoneId !== 4242 || own.batches.at(-1)?.zoneBlocks !== "56-61" || getAddress(own.SwornZoneVerifier.address) !== getAddress("0x15D192a08F41150cae9178D14D55c04F27FF2733")) fail("OwnZone facts no longer match the stated scope");

const cargo = read("tempo/Cargo.toml", "Tempo Cargo.toml"); if (!cargo.includes("github.com/paradigmxyz/reth") || !/^revm = \{ version = /m.test(cargo)) fail("Tempo Cargo.toml no longer verifies the Reth/Revm statement");
const dojo = (await fetchText("https://fabrknt.com/dojo", "Fabrknt Dojo")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " "); if (!dojo.includes("21 courses") || !dojo.includes("234 atomic lessons") || !dojo.includes("Alloy")) fail("Fabrknt Dojo counts or curriculum changed");
const eg = (await fetchText("https://ethglobal.com/showcase/reckn-47t6m", "ETHGlobal showcase")).replace(/<!-- -->/g, ""); if (!/<h4[^>]*>\s*Uniswap Foundation\s*-\s*.*?\s*3rd place\s*<\/h4>/.test(eg) || !eg.includes("ETHGlobal Tokyo 2026")) fail("ETHGlobal award details changed");
const superteam = await fetchText("https://superteam.fun/earn/listing/superteam-japan-cypherpunk-hackathon-ntt-docomo-randd-side-track", "Superteam Japan Cypherpunk Hackathon"); if (!superteam.includes("Superteam Japan Cypherpunk Hackathon NTT DOCOMO R&D Side Track") || !/"winnerPosition":3,"user":\{[^}]*"username":"psyto"[^}]*"firstName":"Hiroyuki","lastName":"Saito"/.test(superteam)) fail("Superteam winner record no longer identifies psyto / Hiroyuki Saito as 3rd Place");

// The payout amount and the README statements the narration relies on.
const payout = await checkedReceipt(own.payout.tx, "0x1", own.OwnZonePortal.address, "OwnZone payout");
if (!/amount 500000/.test(own.payout.event) || own.payout.userPathUSD?.delta !== "500000") fail("payout is no longer 0.5 pathUSD (500000, 6 decimals)");
const readme = read("README.md", "README.md").replace(/\s+/g, " ");
for (const phrase of ["the verification logic is Tempo's, unchanged", "15 years building banking systems in Japan", "Uniswap Foundation sponsor prize", "Superteam Japan × NTT DOCOMO R&D side track"]) if (!readme.includes(phrase)) fail(`README missing: ${phrase}`);
const short = (h) => `${h.slice(0,6)}…${h.slice(-4)}`;
const data = { scenes: ["d1","d2","d3","d4","d5","d6","d7"], zoneId: String(own.zoneId), ownVerifier: short(own.SwornZoneVerifier.address), settled: String(own.batches.length), paid: "0.5", payoutTx: short(payout.transactionHash), forgedTx: short(own.forgedBatch.tx) };
const viewport = { width: 1280, height: 720, deviceScaleFactor: 1.5 }; await checkOverflow("pitch-d.html", data, data.scenes, viewport);
const work = path.join(dir, "takes", "pitch-d"); mkdirSync(work, { recursive: true }); const out = path.join(dir, "pitch-d.mp4"); await recordSlides({ html: "pitch-d.html", data, ids: data.scenes, holds, raw: path.join(work, "pitch-d.raw.mp4"), out, viewport });
if (Math.abs(duration(out) - total) > .12) fail(`pitch-d.mp4 duration ${duration(out)}s, expected ${total}s`);
const starts = holds.reduce((a,h)=>[...a,a.at(-1)+h],[0]); const cues = writeSrt(scenes, starts, path.join(dir,"pitch-d.srt")); writeJson(path.join(dir,"pitch-d.marks.json"), { name:"pitch-d", version:"8-D", script:"video/PITCH-D.md", holds, titles:scenes.map(s=>s.title), words:scenes.map(s=>s.words), totalWords:scenes.reduce((a,s)=>a+s.words,0), source:"Chain receipts and bytecode plus Fabrknt Dojo, ETHGlobal, and Superteam reread while recording.", note:"Silent. Founder narration from PITCH-D.md or pitch-d.srt." });
log(`✓ video/pitch-d.mp4 (${total}s) · video/pitch-d.srt (${cues} cues)`);
