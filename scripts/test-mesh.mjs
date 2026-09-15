/**
 * Multi-party mesh test: three independent browsers in one room.
 *
 * With 3 peers each browser must hold 2 peer connections, so this is the
 * first configuration that actually exercises mesh logic — roster fan-out,
 * simultaneous negotiation, and per-peer teardown.
 */

import puppeteer from "puppeteer-core";

/**
 * Always release browsers, even when an assertion throws. Without this a
 * failed run leaves headless instances alive; they pile up across runs, eat
 * CPU, and make later runs fail for reasons unrelated to the code.
 */
const OPEN = [];
async function trackBrowser(p) {
  const b = await p;
  OPEN.push(b);
  return b;
}
async function closeAll() {
  await Promise.allSettled(OPEN.map((b) => b.close()));
  OPEN.length = 0;
}
process.on("unhandledRejection", async (err) => {
  console.error("\n💥", err instanceof Error ? err.message : err);
  await closeAll();
  process.exit(1);
});


const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const BASE = process.env.PARLEY_URL ?? "http://localhost:3100";
const SHOTS = "/private/tmp/parley-shots";
const rid = () =>
  Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join(""),
  ).join("-");

const room = rid();
let pass = 0, fail = 0;
function ok(c, m) {
  if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.log(`  ❌ ${m}`); }
}

const launch = () =>
  trackBrowser(puppeteer.launch({
    executablePath: BRAVE,
    headless: true,
    args: [
      "--no-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  }));

async function join(browser, name) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${BASE}/r/${room}`, { waitUntil: "networkidle0", timeout: 30000 });
  await page.waitForSelector("#display-name", { timeout: 20000 });
  await page.type("#display-name", name);
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Join call"));
    return b && !b.disabled;
  }, { timeout: 25000 });
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Join call"))?.click();
  });
  return { page, errors, name };
}

const tileCount = (page) => page.evaluate(() => document.querySelectorAll("[data-tile]").length);
const framesFlowing = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-tile] video")].every((v) => v.videoWidth > 0),
  );

console.log(`\n🕸  Mesh test (3 peers) — room ${room}\n`);

const browsers = await Promise.all([launch(), launch(), launch()]);
const peers = [];

console.log("staggered joins");
for (const [i, name] of ["Ada", "Grace", "Alan"].entries()) {
  peers.push(await join(browsers[i], name));
}

for (const p of peers) {
  await p.page.waitForFunction(
    () => document.querySelectorAll("[data-tile]").length === 3,
    { timeout: 60000 },
  );
}
ok(true, "all 3 peers see 3 tiles (full mesh roster)");

for (const p of peers) {
  await p.page.waitForFunction(
    () => {
      const v = [...document.querySelectorAll("[data-tile] video")];
      return v.length === 3 && v.every((x) => x.videoWidth > 0);
    },
    { timeout: 60000 },
  );
}
ok(true, "every peer is decoding video from both others (6 directed streams)");

const counts = await Promise.all(peers.map((p) => tileCount(p.page)));
ok(counts.every((c) => c === 3), `tile counts consistent: ${counts.join(", ")}`);

await peers[0].page.screenshot({ path: `${SHOTS}/mesh_3way.png` });
console.log(`\n📸 ${SHOTS}/mesh_3way.png`);

// ---- chat fans out to every peer -------------------------------------------
console.log("\ndata channel fan-out");
for (const p of peers) {
  await p.page.evaluate(() => {
    [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Chat")?.click();
  });
  await p.page.waitForSelector("#chat-input", { timeout: 10000 });
}
const probe = `mesh-${Math.random().toString(36).slice(2, 7)}`;
await peers[0].page.click("#chat-input");
await peers[0].page.type("#chat-input", probe);
await peers[0].page.keyboard.press("Enter");

for (const p of peers.slice(1)) {
  await p.page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 20000 }, probe);
}
ok(true, "one message reached both remote peers over separate data channels");

// ---- mid-call departure ----------------------------------------------------
console.log("\nmid-call departure");
await peers[2].page.close();
for (const p of peers.slice(0, 2)) {
  await p.page.waitForFunction(
    () => document.querySelectorAll("[data-tile]").length === 2,
    { timeout: 25000 },
  );
}
ok(true, "remaining peers drop the departed tile and keep talking");
ok(await framesFlowing(peers[0].page), "surviving connection still has live frames");

const errs = peers.flatMap((p) => p.errors).filter((e) => !e.includes("favicon"));
ok(errs.length === 0, `no page errors (${errs.length})`);
errs.slice(0, 4).forEach((e) => console.log("     " + e));

await Promise.all(browsers.map((b) => b.close()));
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
