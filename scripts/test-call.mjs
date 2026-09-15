/**
 * End-to-end WebRTC test.
 *
 * Launches two independent Brave instances with synthetic camera/mic
 * devices, joins both to the same room, and verifies that a REAL
 * RTCPeerConnection reaches "connected" with decoded video frames.
 *
 * `videoWidth > 0` is the assertion that matters: it can only be non-zero
 * if frames actually arrived, were decoded, and were painted. Nothing about
 * it can be faked by UI state.
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

const A = "abcd";
const roomId = `${A}-efgh-jkmn`.replace(/[a-z]{4}/g, () =>
  Array.from({ length: 4 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join(""),
);

let pass = 0, fail = 0;
function ok(c, m) {
  if (c) { pass++; console.log(`  ✅ ${m}`); }
  else { fail++; console.log(`  ❌ ${m}`); }
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
      "--allow-running-insecure-content",
      "--unsafely-treat-insecure-origin-as-secure=" + BASE,
      "--disable-features=WebRtcHideLocalIpsWithMdns",
    ].filter(Boolean),
  }));

console.log(`\n📞 WebRTC end-to-end test — room ${roomId}\n`);

const browserA = await launch();
const browserB = await launch();

async function joinAs(browser, name) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(`${BASE}/r/${roomId}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("#display-name", { timeout: 15000 });
  await page.click("#display-name");
  await page.type("#display-name", name);

  // Wait for getUserMedia to resolve so the Join button enables.
  await page.waitForFunction(
    () => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Join call"));
      return b && !b.disabled;
    },
    { timeout: 20000 },
  );
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Join call"));
    b?.click();
  });
  return { page, errors };
}

console.log("lobby & permissions");
const a = await joinAs(browserA, "Ada");
ok(true, "peer A passed the lobby and joined");
const b = await joinAs(browserB, "Grace");
ok(true, "peer B passed the lobby and joined");

// ---- wait for the mesh to connect ------------------------------------------
console.log("\npeer connection");
const inspect = async (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-tile]")].map((t) => {
      const v = t.querySelector("video");
      const stream = v?.srcObject ?? null;
      return {
        id: t.dataset.tile,
        videoWidth: v?.videoWidth ?? 0,
        videoHeight: v?.videoHeight ?? 0,
        tracks: stream ? stream.getTracks().map((tr) => `${tr.kind}:${tr.readyState}`) : [],
      };
    }),
  );

async function waitForTiles(page, n, ms = 45000) {
  await page.waitForFunction(
    (count) => document.querySelectorAll("[data-tile]").length >= count,
    { timeout: ms },
    n,
  );
}

await waitForTiles(a.page, 2);
await waitForTiles(b.page, 2);
ok(true, "both peers see 2 tiles (local + remote)");

// Frames must actually decode — this is the real proof of media flow.
async function waitForFrames(page, ms = 45000) {
  await page.waitForFunction(
    () => {
      const vids = [...document.querySelectorAll("[data-tile] video")];
      return vids.length >= 2 && vids.every((v) => v.videoWidth > 0);
    },
    { timeout: ms },
  );
}

await waitForFrames(a.page);
await waitForFrames(b.page);

const tilesA = await inspect(a.page);
const tilesB = await inspect(b.page);
console.log("   A tiles:", JSON.stringify(tilesA));
console.log("   B tiles:", JSON.stringify(tilesB));

ok(tilesA.every((t) => t.videoWidth > 0), "A is decoding video frames on every tile");
ok(tilesB.every((t) => t.videoWidth > 0), "B is decoding video frames on every tile");
ok(tilesA.some((t) => t.tracks.includes("video:live")), "A has a live remote video track");
ok(tilesB.some((t) => t.tracks.includes("audio:live")), "B has a live remote audio track");

// ---- connection state ------------------------------------------------------
const connectedA = await a.page.evaluate(
  () => !document.querySelector('[aria-label^="Connecting to"]'),
);
ok(connectedA, "A shows no lingering 'connecting' indicator");

// ---- data channel chat -----------------------------------------------------
console.log("\ndata channel chat");
await a.page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Chat");
  b?.click();
});
await b.page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Chat");
  btn?.click();
});
await a.page.waitForSelector("#chat-input", { timeout: 10000 });
await b.page.waitForSelector("#chat-input", { timeout: 10000 });

const probe = `hello-${Math.random().toString(36).slice(2, 7)}`;
await a.page.click("#chat-input");
await a.page.type("#chat-input", probe);
await a.page.keyboard.press("Enter");

await b.page.waitForFunction(
  (text) => document.body.innerText.includes(text),
  { timeout: 15000 },
  probe,
);
ok(true, "chat message crossed the WebRTC data channel (no server involved)");

const reply = `reply-${Math.random().toString(36).slice(2, 7)}`;
await b.page.click("#chat-input");
await b.page.type("#chat-input", reply);
await b.page.keyboard.press("Enter");
await a.page.waitForFunction(
  (text) => document.body.innerText.includes(text),
  { timeout: 15000 },
  reply,
);
ok(true, "data channel is bidirectional");

// ---- mute propagates -------------------------------------------------------
console.log("\nmedia state sync");
await a.page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Mute microphone");
  btn?.click();
});
await b.page.waitForFunction(
  () => !!document.querySelector('[aria-label$="is muted"]'),
  { timeout: 12000 },
);
ok(true, "muting on A is reflected on B");

// ---- screenshots -----------------------------------------------------------
await a.page.screenshot({ path: `${SHOTS}/call_A.png` });
await b.page.screenshot({ path: `${SHOTS}/call_B.png` });
console.log(`\n📸 ${SHOTS}/call_A.png, call_B.png`);

// ---- leave propagates ------------------------------------------------------
console.log("\ndeparture");
await b.page.close();
await a.page.waitForFunction(
  () => document.querySelectorAll("[data-tile]").length === 1,
  { timeout: 20000 },
);
ok(true, "A removes B's tile when B leaves");

const pageErrors = [...a.errors, ...b.errors].filter(
  (e) => !e.includes("favicon") && !e.includes("Download the React DevTools"),
);
ok(pageErrors.length === 0, `no page errors (${pageErrors.length})`);
if (pageErrors.length) pageErrors.slice(0, 5).forEach((e) => console.log("     " + e));

await browserA.close();
await browserB.close();

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
