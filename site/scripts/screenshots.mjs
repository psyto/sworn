// Screenshots of the built page (pnpm build && pnpm preview first, or pass a URL).
// puppeteer lives in ../video/node_modules. Classic headless; domcontentloaded + explicit waits (never networkidle0).
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../video/package.json"));
const puppeteer = require("puppeteer");

const url = process.argv[2] ?? "http://localhost:4173/";
const out = path.join(here, "../screenshots");

const shots = [
  { file: "desktop-light.png", width: 1280, height: 900, scheme: "light" },
  { file: "desktop-dark.png", width: 1280, height: 900, scheme: "dark" },
  { file: "mobile-390.png", width: 390, height: 844, scheme: "light", mobile: true },
];

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
try {
  for (const s of shots) {
    const page = await browser.newPage();
    await page.setViewport({ width: s.width, height: s.height, deviceScaleFactor: s.mobile ? 2 : 1, isMobile: !!s.mobile, hasTouch: !!s.mobile });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: s.scheme }]);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector(".zone-card .facts, .zone-card .error", { timeout: 90_000 });
    await page.waitForSelector(".calls, .again .error", { timeout: 90_000 });
    await page.waitForSelector(".timeline, #slashes .error", { timeout: 90_000 });
    await page.waitForSelector(".pins dl, .pins .error", { timeout: 90_000 });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > w + 1).map((e) => `${e.tagName}.${e.className}`);
      return { scrollWidth: document.documentElement.scrollWidth, clientWidth: w, wide: wide.slice(0, 8) };
    });
    console.log(s.file, JSON.stringify(overflow));
    await page.screenshot({ path: path.join(out, s.file), fullPage: true });
    await page.close();
  }
} finally {
  await browser.close();
}
