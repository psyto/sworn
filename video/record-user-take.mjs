// Records one live, user-facing payment journey from the running demo app.
// It sends a Moderato testnet payment and a challenge only when DEMO_LIVE_OK=1.
// Keys remain in demo/scripts/moderato.sh's child processes; this recorder has none.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { launch, newRecorder, sleep, writeJson } from "./lib/rec.mjs";

const APP = process.env.DEMO_APP_URL || "http://127.0.0.1:5173";
if (process.env.DEMO_LIVE_OK !== "1") throw new Error("refused: DEMO_LIVE_OK=1 is required because this records real Moderato testnet transactions");

const outDir = path.join("video", "takes", `user-flow-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`);
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "raw.mp4");
const browser = await launch();
const take = { app: APP, recordedAt: new Date().toISOString(), events: [], jobs: [] };

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(600000);
  await page.setViewport({ width: 430, height: 860, deviceScaleFactor: 2 });
  page.on("response", async (r) => {
    if (/\/api\/challenge\//.test(r.url()) && r.ok()) {
      try { const j = await r.json(); take.jobs.push({ phase: j.phase, phaseStartedAt: j.phaseStartedAt, txHash: j.txHash }); } catch { /* polling response */ }
    }
  });
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("section.card.liar");
  await page.waitForFunction(() => document.body.innerText.includes("Send 500 USD"));
  const rec = await newRecorder(page);
  await rec.start(out);
  const t0 = Date.now();
  const mark = (name) => {
    const t = +((Date.now() - t0) / 1000).toFixed(3);
    take.events.push({ name, t });
    process.stdout.write(`  ${t.toFixed(1).padStart(6)} s  ${name}\n`);
  };
  const click = async (text) => {
    const ok = await page.evaluate((label) => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === label && !x.disabled);
      if (!b) return false;
      b.click(); return true;
    }, text);
    if (!ok) throw new Error(`no enabled button: ${text}`);
  };
  const scroll = (sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ behavior: "smooth", block: "center" }), sel);

  mark("payment-review");
  await sleep(2500);
  mark("check-recipient");
  await click("Check recipient");
  await page.waitForSelector("[data-testid=answer]");
  await scroll("[data-testid=answer]");
  mark("protection-reserved");
  await sleep(3500);
  mark("send-payment");
  await click("Send 500 USD");
  await page.waitForSelector("[data-testid=payment]");
  await scroll("[data-testid=payment]");
  mark("not-delivered");
  await sleep(5000);
  mark("claim-protection");
  await click("Prove the check was wrong");
  await page.waitForSelector("[data-testid=elapsed]");
  await scroll("[data-testid=challenge]");

  let last = "";
  for (;;) {
    const state = await page.evaluate(() => ({
      phase: document.querySelector("[data-testid=challenge] .phases li.now")?.textContent ?? "",
      payout: !!document.querySelector("[data-testid=payout]"),
      error: document.querySelector("[data-testid=challenge] [data-testid=error]")?.textContent ?? "",
    }));
    const phase = /Proving/.test(state.phase) ? "proving" : /Submitting/.test(state.phase) ? "submitting" : /Witness/.test(state.phase) ? "witness" : state.payout ? "paid" : state.phase ? "other" : last;
    if (phase !== last) { mark(`phase-${phase}`); last = phase; }
    if (state.error && !state.payout) throw new Error(`challenge failed: ${state.error}`);
    if (state.payout) break;
    await sleep(250);
  }
  await scroll("[data-testid=payout]");
  mark("protection-paid");
  await sleep(4500);
  await page.goto(`${APP.replace(/\/$/, "")}/phone`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=phone]");
  await page.waitForFunction(() => document.body.innerText.includes("Protection paid"));
  mark("phone-notification");
  await sleep(5000);
  mark("end");
  take.wallSeconds = +((Date.now() - t0) / 1000).toFixed(3);
  await rec.stop();
  writeJson(path.join(outDir, "take.json"), take);
  process.stdout.write(`✓ ${out}\n`);
} finally {
  await browser.close();
}
