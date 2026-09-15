/**
 * Protocol test for the PartyKit signaling server.
 * Drives real WebSocket clients against a running `npm run dev:party`.
 */

const HOST = process.env.PARTYKIT_HOST ?? "127.0.0.1:1999";
const room = `test${Math.random().toString(36).slice(2, 8)}`;
const url = (r) => `ws://${HOST}/parties/main/${r}`;

let pass = 0, fail = 0;
function ok(c, m) {
  if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.log(`  ❌ ${m}`); }
}

function client(name, r = room) {
  const ws = new WebSocket(url(r));
  const inbox = [];
  const waiters = [];
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    inbox.push(msg);
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].match(msg)) { waiters[i].resolve(msg); waiters.splice(i, 1); }
    }
  });
  return {
    name, ws, inbox,
    open: () => new Promise((res, rej) => {
      if (ws.readyState === 1) return res();
      ws.addEventListener("open", () => res(), { once: true });
      ws.addEventListener("error", rej, { once: true });
    }),
    send: (m) => ws.send(JSON.stringify(m)),
    waitFor: (match, ms = 4000) => {
      const hit = inbox.find(match);
      if (hit) return Promise.resolve(hit);
      return new Promise((resolve, reject) => {
        const w = { match, resolve };
        waiters.push(w);
        setTimeout(() => reject(new Error(`${name}: timeout waiting for message`)), ms);
      });
    },
    close: () => ws.close(),
  };
}

const t = (x) => (m) => m.t === x;

console.log(`\n🔌 Signaling protocol test — room ${room}\n`);

// ---- 1. join / welcome -----------------------------------------------------
console.log("join & roster");
const a = client("A");
await a.open();
a.send({ t: "join", name: "Ada", media: { audio: true, video: true, screen: false } });
const welcomeA = await a.waitFor(t("welcome"));
ok(welcomeA.peers.length === 0, "first peer gets an empty roster");
ok(typeof welcomeA.self === "string" && welcomeA.self.length > 0, "server assigns a peer id");
ok(welcomeA.roomId === room, "welcome echoes the room id");

const b = client("B");
await b.open();
b.send({ t: "join", name: "Grace", media: { audio: true, video: false, screen: false } });
const welcomeB = await b.waitFor(t("welcome"));
ok(welcomeB.peers.length === 1, "second peer sees one existing peer");
ok(welcomeB.peers[0].name === "Ada", "roster carries display names");
ok(welcomeB.peers[0].media.video === true, "roster carries media flags");

const joinEvt = await a.waitFor(t("peer-join"));
ok(joinEvt.peer.id === welcomeB.self, "existing peer is told who joined");
ok(joinEvt.peer.media.video === false, "join event carries the joiner's media state");

// ---- 2. targeted relay -----------------------------------------------------
console.log("\nSDP / ICE relay");
a.send({ t: "relay", to: welcomeB.self, data: { k: "description", sdp: { type: "offer", sdp: "v=0-FAKE" } } });
const relayed = await b.waitFor(t("relay"));
ok(relayed.from === welcomeA.self, "relay is stamped with the sender id");
ok(relayed.data.k === "description" && relayed.data.sdp.sdp === "v=0-FAKE", "SDP survives the round trip");

b.send({ t: "relay", to: welcomeA.self, data: { k: "candidate", candidate: { candidate: "candidate:FAKE", sdpMid: "0" } } });
const cand = await a.waitFor(t("relay"));
ok(cand.data.k === "candidate", "ICE candidates relay too");

const beforeCount = b.inbox.length;
a.send({ t: "relay", to: "no-such-peer", data: { k: "candidate", candidate: {} } });
const err = await a.waitFor(t("error"));
ok(err.code === "peer-gone", "relay to a departed peer returns peer-gone");
ok(b.inbox.length === beforeCount, "relay is targeted — B received nothing");

// ---- 3. media state --------------------------------------------------------
console.log("\nmedia state broadcast");
b.send({ t: "media", media: { audio: false, video: true, screen: false } });
const mediaEvt = await a.waitFor(t("media"));
ok(mediaEvt.id === welcomeB.self && mediaEvt.media.audio === false, "mute broadcasts to other peers");

b.send({ t: "rename", name: "Grace H" });
const renameEvt = await a.waitFor(t("rename"));
ok(renameEvt.name === "Grace H", "rename broadcasts");

// ---- 4. leave --------------------------------------------------------------
console.log("\ndeparture");
b.close();
const leaveEvt = await a.waitFor(t("peer-leave"));
ok(leaveEvt.id === welcomeB.self, "peer-leave fires on socket close");

// ---- 5. capacity -----------------------------------------------------------
console.log("\nroom capacity");
const capRoom = `cap${Math.random().toString(36).slice(2, 8)}`;
const filler = [];
for (let i = 0; i < 6; i++) {
  const c = client(`F${i}`, capRoom);
  await c.open();
  c.send({ t: "join", name: `P${i}`, media: { audio: true, video: true, screen: false } });
  await c.waitFor(t("welcome"));
  filler.push(c);
}
const overflow = client("X", capRoom);
await overflow.open();
overflow.send({ t: "join", name: "Late", media: { audio: true, video: true, screen: false } });
const full = await overflow.waitFor(t("room-full"));
ok(full.limit === 6, "7th participant is rejected with room-full");

// ---- 6. malformed input ----------------------------------------------------
console.log("\nbad input");
a.ws.send("this is not json");
const badJson = await a.waitFor((m) => m.t === "error" && m.code === "bad-json");
ok(!!badJson, "malformed JSON returns an error instead of crashing the room");
a.send({ t: "nonsense" });
const unknown = await a.waitFor((m) => m.t === "error" && m.code === "unknown-type");
ok(!!unknown, "unknown message type is rejected");

for (const c of [a, overflow, ...filler]) c.close();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
