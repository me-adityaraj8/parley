/**
 * Screen-share test.
 *
 * Verifies the replaceTrack path: the sharer's outgoing video track is
 * swapped without renegotiation, the remote peer keeps the SAME connection,
 * and stopping restores the camera.
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
const room = Array.from({ length: 3 }, () =>
  Array.from({ length: 4 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join(""),
).join("-");

let pass = 0, fail = 0;
function ok(c, m) {
  if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.log(`  ❌ ${m}`); }
}

const launch = (share) =>
  trackBrowser(puppeteer.launch({
    executablePath: BRAVE,
    headless: true,
    args: [
      "--no-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      ...(share
        ? [
            // Accepts the screen picker automatically so the flow is testable.
            "--auto-select-desktop-capture-source=Entire screen",
            "--auto-accept-this-tab-capture",
          ]
        : []),
    ],
  }));

async function join(browser, name) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/r/${room}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("#display-name", { timeout: 20000 });
  await page.type("#display-name", name);
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Join call"));
    return b && !b.disabled;
  }, { timeout: 25000 });
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Join call"))?.click();
  });
  return { page, errors };
}

console.log(`\n🖥  Screen share test — room ${room}\n`);

const bA = await launch(true);
const bB = await launch(false);
const a = await join(bA, "Sharer");
const b = await join(bB, "Viewer");

for (const p of [a, b]) {
  await p.page.waitForFunction(
    () => {
      const v = [...document.querySelectorAll("[data-tile] video")];
      return v.length === 2 && v.every((x) => x.videoWidth > 0);
    },
    { timeout: 60000 },
  );
}
ok(true, "2-way call established before sharing");

// Record the remote track id so we can prove the connection was NOT rebuilt.
const trackIdBefore = await b.page.evaluate(() => {
  const vids = [...document.querySelectorAll("[data-tile] video")];
  const remote = vids[1] ?? vids[0];
  return remote?.srcObject?.getVideoTracks()[0]?.id ?? null;
});

console.log("\nstart sharing");
const shareBtn = await a.page.evaluate(() =>
  Boolean([...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Share your screen")),
);
ok(shareBtn, "share control is available");

await a.page.evaluate(() => {
  [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Share your screen")?.click();
});

await a.page.waitForFunction(
  () => document.body.innerText.includes("sharing your screen"),
  { timeout: 25000 },
);
ok(true, "sharer sees the 'You're sharing your screen' banner");

await b.page.waitForFunction(
  () => Boolean(document.querySelector('[aria-label="Sharing screen"]')),
  { timeout: 25000 },
);
ok(true, "remote peer is told the share started");

await b.page.waitForFunction(
  () => [...document.querySelectorAll("[data-tile] video")].every((v) => v.videoWidth > 0),
  { timeout: 25000 },
);
ok(true, "remote peer still has decoding video after the swap");

await a.page.screenshot({ path: `${SHOTS}/share_sharer.png` });
await b.page.screenshot({ path: `${SHOTS}/share_viewer.png` });
console.log(`\n📸 ${SHOTS}/share_sharer.png, share_viewer.png`);

console.log("\nstop sharing");
await a.page.evaluate(() => {
  const stop = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Stop sharing");
  if (stop) stop.click();
  else [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Stop sharing")?.click();
});

await b.page.waitForFunction(
  () => !document.querySelector('[aria-label="Sharing screen"]'),
  { timeout: 25000 },
);
ok(true, "remote peer sees the share end");

await b.page.waitForFunction(
  () => [...document.querySelectorAll("[data-tile] video")].every((v) => v.videoWidth > 0),
  { timeout: 25000 },
);
ok(true, "camera restored with frames still flowing");

const trackIdAfter = await b.page.evaluate(() => {
  const vids = [...document.querySelectorAll("[data-tile] video")];
  const remote = vids[1] ?? vids[0];
  return remote?.srcObject?.getVideoTracks()[0]?.id ?? null;
});
ok(
  trackIdBefore !== null && trackIdBefore === trackIdAfter,
  `remote track id unchanged through share+restore (replaceTrack, not renegotiation)`,
);

const errs = [...a.errors, ...b.errors].filter((e) => !e.includes("favicon"));
ok(errs.length === 0, `no page errors (${errs.length})`);
errs.slice(0, 4).forEach((e) => console.log("     " + e));

await bA.close();
await bB.close();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
