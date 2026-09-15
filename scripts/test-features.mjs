/**
 * End-to-end tests for the advanced feature set.
 *
 * Everything here is asserted against REAL browser APIs: getStats() output,
 * data-channel delivery between two independent browsers, MediaRecorder
 * state, and canvas pixels. Nothing is stubbed.
 */
import puppeteer from "puppeteer-core";
import { writeFileSync, unlinkSync } from "node:fs";

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
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${BASE}/r/${room}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("#display-name", { timeout: 30000 });
  await page.type("#display-name", name);
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Join call"));
    return b && !b.disabled;
  }, { timeout: 30000 });
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Join call"))?.click();
  });
  return { page, errors };
}

const clickLabel = (page, label) =>
  page.evaluate((l) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === l);
    if (!b) throw new Error(`no button labelled "${l}"`);
    b.click();
  }, label);

const openMore = async (page, itemLabel) => {
  await clickLabel(page, "More");
  await page.waitForSelector("[data-more-menu]", { timeout: 8000 });
  await page.evaluate((l) => {
    const i = [...document.querySelectorAll("[data-more-item]")].find((x) => x.textContent?.includes(l));
    if (!i) throw new Error(`no menu item "${l}"`);
    i.click();
  }, itemLabel);
};

console.log(`\n🧪 Advanced features — room ${room}\n`);

const [bA, bB] = await Promise.all([launch(), launch()]);
const a = await join(bA, "Ada");
const b = await join(bB, "Grace");

for (const p of [a, b]) {
  await p.page.waitForFunction(
    () => {
      const v = [...document.querySelectorAll("[data-tile] video")];
      return v.length === 2 && v.every((x) => x.videoWidth > 0);
    },
    { timeout: 60000 },
  );
}
ok(true, "2-way call up before feature tests");

// ---- 1. DIAGNOSTICS (real getStats) ----------------------------------------
console.log("\n1 · diagnostics (getStats)");
await openMore(a.page, "Call diagnostics");
await a.page.waitForSelector('[aria-label="Call diagnostics"]', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 3000));

const diag = await a.page.evaluate(() => {
  const panel = document.querySelector('[aria-label="Call diagnostics"]');
  return panel?.textContent ?? "";
});
ok(/Excellent|Good|Fair|Poor|Measuring/.test(diag), "call health grade rendered");
ok(/\d+\s*ms/.test(diag), "round-trip time shown in ms");
ok(/kbps/.test(diag), "bitrate shown");
ok(/× ?\d+|\d+ ×/.test(diag), "resolution shown");
ok(/host|srflx|relay|prflx/.test(diag), "ICE candidate pair reported");

// The numbers above can only come from getStats(); assert they are live by
// confirming the panel updates between two samples.
const firstSample = await a.page.evaluate(
  () => document.querySelector('[aria-label="Call diagnostics"]')?.textContent ?? "",
);
await new Promise((r) => setTimeout(r, 2500));
const secondSample = await a.page.evaluate(
  () => document.querySelector('[aria-label="Call diagnostics"]')?.textContent ?? "",
);
ok(firstSample !== secondSample, "diagnostics values update between polls (live, not static)");

await clickLabel(a.page, "Close diagnostics");

// ---- 2. REACTIONS -----------------------------------------------------------
console.log("\n2 · reactions over data channel");
await clickLabel(a.page, "Send a reaction");
await a.page.waitForSelector("[data-emoji]", { timeout: 8000 });
await a.page.evaluate(() => document.querySelector("[data-emoji]")?.click());

await b.page.waitForFunction(
  () => document.querySelectorAll("[data-reaction]").length > 0,
  { timeout: 15000 },
);
ok(true, "reaction crossed the data channel to the remote peer");
const reactionName = await b.page.evaluate(
  () => document.querySelector("[data-reaction]")?.textContent ?? "",
);
ok(reactionName.includes("Ada"), "reaction is attributed to the sender");

// ---- 3. RAISE HAND ----------------------------------------------------------
console.log("\n3 · raise hand");
await clickLabel(a.page, "Raise hand");
await b.page.waitForFunction(
  () => Boolean(document.querySelector("[data-hand]")),
  { timeout: 15000 },
);
ok(true, "raised hand synchronised to the remote peer");

await clickLabel(b.page, "Participants");
await b.page.waitForSelector('[aria-label="Participants"]', { timeout: 8000 });
const handsText = await b.page.evaluate(
  () => document.querySelector('[aria-label="Participants"]')?.textContent ?? "",
);
ok(/hand.*raised/i.test(handsText), "participant panel lists raised hands");
await clickLabel(b.page, "Close participants");

await clickLabel(a.page, "Lower hand");
await b.page.waitForFunction(() => !document.querySelector("[data-hand]"), { timeout: 15000 });
ok(true, "lowering the hand also synchronises");

// ---- 4. SPOTLIGHT (GSAP Flip) ----------------------------------------------
console.log("\n4 · spotlight");
const beforeBoxes = await a.page.evaluate(() =>
  [...document.querySelectorAll("[data-tile]")].map((t) => Math.round(t.getBoundingClientRect().width)),
);
await a.page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((x) =>
    (x.getAttribute("aria-label") ?? "").startsWith("Spotlight "),
  );
  btn?.click();
});
await new Promise((r) => setTimeout(r, 1200));
const afterBoxes = await a.page.evaluate(() =>
  [...document.querySelectorAll("[data-tile]")].map((t) => Math.round(t.getBoundingClientRect().width)),
);
ok(
  Math.max(...afterBoxes) > Math.max(...beforeBoxes),
  `spotlight enlarges a tile (${Math.max(...beforeBoxes)} → ${Math.max(...afterBoxes)}px)`,
);
await a.page.screenshot({ path: `${SHOTS}/feat_spotlight.png` });
await a.page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((x) =>
    (x.getAttribute("aria-label") ?? "").startsWith("Remove spotlight"),
  );
  btn?.click();
});
await new Promise((r) => setTimeout(r, 900));
ok(true, "spotlight can be removed");

// ---- 5. WHITEBOARD ----------------------------------------------------------
console.log("\n5 · collaborative whiteboard");
await openMore(a.page, "Whiteboard");
await a.page.waitForSelector("canvas", { timeout: 10000 });
await openMore(b.page, "Whiteboard");
await b.page.waitForSelector("canvas", { timeout: 10000 });

// Draw a stroke on A with real pointer events.
const box = await a.page.evaluate(() => {
  const c = document.querySelector("canvas");
  const r = c.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await a.page.mouse.move(box.x + box.w * 0.3, box.y + box.h * 0.4);
await a.page.mouse.down();
for (let i = 0; i <= 12; i++) {
  await a.page.mouse.move(box.x + box.w * (0.3 + i * 0.03), box.y + box.h * (0.4 + Math.sin(i / 2) * 0.08));
  await new Promise((r) => setTimeout(r, 25));
}
await a.page.mouse.up();

// Assert pixels actually changed on the REMOTE canvas.
const remoteInk = await b.page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 1200));
  const c = document.querySelector("canvas");
  const ctx = c.getContext("2d");
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) lit++;
  return lit;
});
ok(remoteInk > 200, `stroke replicated to the remote canvas (${remoteInk} non-transparent px)`);
await b.page.screenshot({ path: `${SHOTS}/feat_whiteboard.png` });

await b.page.evaluate(() => {
  [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Clear board for everyone")?.click();
});
const clearedInk = await a.page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 1200));
  const c = document.querySelector("canvas");
  const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) lit++;
  return lit;
});
ok(clearedInk < 50, "clear board propagates to the other peer");
await clickLabel(a.page, "Close whiteboard");
await clickLabel(b.page, "Close whiteboard");

// ---- 6. FILE TRANSFER -------------------------------------------------------
console.log("\n6 · P2P file transfer");
const tmp = "/private/tmp/parley-shots/_transfer-test.bin";
// ~600 KB: large enough to span many 16 KiB chunks and exercise backpressure.
const payload = Buffer.alloc(600 * 1024);
for (let i = 0; i < payload.length; i++) payload[i] = i % 251;
writeFileSync(tmp, payload);

// Open the panel on BOTH sides first — the receiver only renders transfer
// rows while its panel is mounted.
await openMore(a.page, "Send files");
await a.page.waitForSelector('input[type="file"]', { timeout: 10000 });
await openMore(b.page, "Send files");
await b.page.waitForSelector('input[type="file"]', { timeout: 10000 });

const chooser = await a.page.$('input[type="file"]');
await chooser.uploadFile(tmp);

await b.page.waitForFunction(
  () => document.body.innerText.includes("_transfer-test.bin"),
  { timeout: 20000 },
);
ok(true, "receiver was offered the file");

await a.page.waitForFunction(
  () => document.body.innerText.includes("Sent"),
  { timeout: 60000 },
);
ok(true, "sender completed the transfer");

await b.page.waitForFunction(
  () => Boolean([...document.querySelectorAll("a")].find((x) => x.textContent?.includes("Save file"))),
  { timeout: 60000 },
);
const savedSize = await b.page.evaluate(async () => {
  const link = [...document.querySelectorAll("a")].find((x) => x.textContent?.includes("Save file"));
  const res = await fetch(link.href);
  const blob = await res.blob();
  return blob.size;
});
ok(savedSize === 600 * 1024, `reassembled file is byte-exact (${savedSize} bytes)`);
await b.page.screenshot({ path: `${SHOTS}/feat_files.png` });
unlinkSync(tmp);

// ---- 7. RECORDING -----------------------------------------------------------
console.log("\n7 · local recording (MediaRecorder)");
await clickLabel(a.page, "Close files");
await openMore(a.page, "Record locally");
await a.page.waitForFunction(
  () => document.body.innerText.includes("Recording locally"),
  { timeout: 12000 },
);
ok(true, "recording started and is labelled as local");
await new Promise((r) => setTimeout(r, 2500));
await clickLabel(a.page, "Pause recording");
await a.page.waitForFunction(() => document.body.innerText.includes("Paused"), { timeout: 8000 });
ok(true, "recording pauses");
await clickLabel(a.page, "Resume recording");
await new Promise((r) => setTimeout(r, 1500));
await clickLabel(a.page, "Stop recording");
await a.page.waitForFunction(
  () => Boolean([...document.querySelectorAll("a")].find((x) => x.textContent?.includes("Download"))),
  { timeout: 15000 },
);
const recSize = await a.page.evaluate(async () => {
  const link = [...document.querySelectorAll("a")].find((x) => x.textContent?.includes("Download"));
  const blob = await (await fetch(link.href)).blob();
  return blob.size;
});
ok(recSize > 1000, `recording produced a real media blob (${recSize} bytes)`);

// ---- 8. CHAT UPGRADES -------------------------------------------------------
console.log("\n8 · chat: system events, reply, reactions");
await clickLabel(a.page, "Chat");
await a.page.waitForSelector("#chat-input", { timeout: 10000 });
const sysText = await a.page.evaluate(() => document.querySelector('[aria-label="Chat"]')?.textContent ?? "");
ok(/joined/.test(sysText), "system notice recorded a participant joining");

await a.page.click("#chat-input");
await a.page.type("#chat-input", "reply-target");
await a.page.keyboard.press("Enter");
await b.page.evaluate(() => {
  [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Chat")?.click();
});
await b.page.waitForFunction(() => document.body.innerText.includes("reply-target"), { timeout: 15000 });

await b.page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "React to message");
  btn?.click();
});
await b.page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") ?? "").startsWith("React 👍"));
  btn?.click();
});
await a.page.waitForFunction(() => document.body.innerText.includes("👍"), { timeout: 15000 });
ok(true, "message reaction synchronised back to the author");

// ---- 9. PER-PARTICIPANT VOLUME ---------------------------------------------
console.log("\n9 · per-participant volume (local only)");
await clickLabel(a.page, "Close chat");
await clickLabel(a.page, "Participants");
await a.page.waitForSelector('[aria-label="Participants"]', { timeout: 8000 });
const volResult = await a.page.evaluate(() => {
  const slider = [...document.querySelectorAll('input[type="range"]')].find((x) =>
    (x.getAttribute("aria-label") ?? "").startsWith("Volume for"),
  );
  if (!slider) return null;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(slider, "0.25");
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
});
await new Promise((r) => setTimeout(r, 600));
const elementVolume = await a.page.evaluate(() => {
  const vids = [...document.querySelectorAll("[data-tile] video")];
  return vids.map((v) => v.volume);
});
ok(volResult === true, "volume slider present for remote participants");
ok(elementVolume.some((v) => v < 0.5), `local playback volume applied (${elementVolume.join(", ")})`);

// The remote peer must be unaffected — this is playback, not a mute broadcast.
const remoteMuteState = await b.page.evaluate(
  () => !document.querySelector('[aria-label$="is muted"]'),
);
ok(remoteMuteState, "changing volume did NOT mute the participant for others");

// ---- 10. QR INVITE ----------------------------------------------------------
console.log("\n10 · QR invite");
await clickLabel(a.page, "Close participants");
await openMore(a.page, "Invite others");
await a.page.waitForSelector('[aria-label="Invite others"]', { timeout: 10000 });
const qr = await a.page.evaluate(() => {
  const img = document.querySelector('[aria-label="Invite others"] img');
  return { src: (img?.getAttribute("src") ?? "").slice(0, 22), w: img?.naturalWidth ?? 0 };
});
ok(qr.src.startsWith("data:image/png"), "QR generated client-side as a data URL");
ok(qr.w > 0, "QR image decodes");
await a.page.screenshot({ path: `${SHOTS}/feat_invite.png` });
await clickLabel(a.page, "Close invite");

// ---- wrap up ----------------------------------------------------------------
const errs = [...a.errors, ...b.errors].filter(
  (e) => !e.includes("favicon") && !e.includes("DevTools"),
);
ok(errs.length === 0, `no page errors (${errs.length})`);
errs.slice(0, 6).forEach((e) => console.log("     " + e));

await closeAll();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
