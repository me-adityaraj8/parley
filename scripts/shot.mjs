#!/usr/bin/env node
/**
 * Visual verification harness — drives Brave via the DevTools Protocol.
 *
 * Usage:
 *   node scripts/shot.mjs <path> [--vp 1440x900] [--out name] [--wait 1200]
 *
 * Captures a screenshot AND reports console errors / failed requests, so a
 * visual check and an error check happen in the same pass.
 */

import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const BASE = process.env.PARLEY_URL ?? "http://localhost:3100";
const OUT_DIR = process.env.SHOT_DIR ?? "/private/tmp/parley-shots";

const args = process.argv.slice(2);
const path = args[0]?.startsWith("-") || !args[0] ? "/" : args[0];
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const [w, h] = (flag("vp", "1440x900")).split("x").map(Number);
const wait = Number(flag("wait", "1200"));
const name = flag("out", `${path.replace(/\W+/g, "_") || "root"}_${w}x${h}`);

mkdirSync(OUT_DIR, { recursive: true });
const file = resolve(OUT_DIR, `${name}.png`);

const browser = await puppeteer.launch({
  executablePath: BRAVE,
  headless: true,
  args: [
    "--no-sandbox",
    "--hide-scrollbars",
    "--force-color-profile=srgb",
    // Fake media devices — lets us test getUserMedia and real peer
    // connections headlessly, without a physical camera or mic.
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });

const problems = [];
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`console.error: ${m.text()}`);
});
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("requestfailed", (r) =>
  problems.push(`requestfailed: ${r.url()} — ${r.failure()?.errorText}`),
);

await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });
// Let fonts settle and entrance animations finish before capturing.
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, wait));

await page.screenshot({ path: file });

// Report anything still invisible — catches animations stuck at opacity 0.
const invisible = await page.evaluate(() =>
  [...document.querySelectorAll("[data-anim]")]
    .filter((el) => Number(getComputedStyle(el).opacity) < 0.95)
    .map((el) => `${el.dataset.anim}: opacity ${getComputedStyle(el).opacity}`),
);

await browser.close();

console.log(`📸 ${file}`);
console.log(problems.length ? `⚠️  ${problems.length} problem(s):` : "✅ no console errors");
problems.forEach((p) => console.log("   " + p));
if (invisible.length) {
  console.log(`⚠️  ${invisible.length} element(s) below full opacity after ${wait}ms:`);
  invisible.forEach((i) => console.log("   " + i));
}
