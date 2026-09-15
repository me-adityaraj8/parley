# WebRTC, explained through this codebase

Every concept below links to the file where Parley actually uses it.

---

## The mental model

WebRTC is three problems wearing one name:

1. **Capture** — get audio/video out of hardware (`getUserMedia`)
2. **Negotiate** — two browsers agree on codecs and find a network route
3. **Transport** — encrypted media flows directly between them

Only #2 needs a server, and only briefly.

---

## MediaStream and MediaStreamTrack

> `hooks/useLocalMedia.ts`

`getUserMedia()` returns a **MediaStream** — a container. Inside are
**MediaStreamTracks**, one per source (microphone, camera).

**Tracks are the real unit of WebRTC.** You send tracks, replace tracks, and
mute tracks. The stream is just a convenient bag to carry them in.

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: { width: { ideal: 1280 } },
});
stream.getAudioTracks(); // [MediaStreamTrack]
stream.getVideoTracks(); // [MediaStreamTrack]
```

### Muting: `enabled`, not `stop()`

```ts
track.enabled = false;  // ✅ transmits silence/black, instantly reversible
track.stop();           // ❌ permanently ends the track, camera light off
```

`enabled = false` keeps the track attached to the peer connection and needs
**no signaling and no renegotiation**. `stop()` is irreversible — re-enabling
means calling `getUserMedia` again and renegotiating.

### The most common leak in WebRTC apps

Dropping your reference to a MediaStream does **not** release the hardware.
The camera light stays on until every track is individually stopped:

```ts
for (const track of stream.getTracks()) track.stop();
```

---

## RTCPeerConnection

> `lib/webrtc/peer.ts`

The object that owns one connection to one remote peer. In a mesh with N
people, each browser holds N-1 of these.

---

## SDP: offer and answer

**SDP** (Session Description Protocol) is a plain-text document describing
what a peer can send and receive — codecs, resolutions, encryption
parameters.

```
A: createOffer()  → "here is what I support"   ──signaling──►  B
B: createAnswer() → "here is our intersection" ◄──signaling──   A
```

Parley uses the argument-less form, which creates the correct description
for the current state automatically:

```ts
await pc.setLocalDescription();          // offer or answer, as appropriate
signal({ k: "description", sdp: pc.localDescription });
```

---

## ICE, STUN and TURN

> `lib/webrtc/config.ts`

Your browser sits behind NAT and does not know its own public address.

- **STUN** answers "what IP and port does the internet see me as?" It is a
  tiny, cheap query. Enough for ~80% of networks.
- **ICE candidate** = one possible route to you. Peers exchange many and test
  pairs until one works.
- **TURN** relays media when no direct path exists (symmetric NAT, strict
  corporate firewalls). It carries real traffic, so it is never free.

### Trickle ICE

Candidates are sent **as they are discovered** rather than batched after
gathering completes. This cuts seconds off connection setup.

```ts
pc.onicecandidate = ({ candidate }) => {
  if (candidate) signal({ k: "candidate", candidate: candidate.toJSON() });
};
```

### The candidate queue — the bug that makes calls work "sometimes"

Candidates routinely arrive **before** the offer they belong to, because
signaling messages race. `addIceCandidate()` throws if there is no remote
description yet:

```ts
if (!pc.remoteDescription) {
  pendingCandidates.push(candidate);   // queue it
  return;
}
await pc.addIceCandidate(candidate);
```

Then flush the queue immediately after `setRemoteDescription()`. Skipping
this produces calls that connect most of the time — the worst kind of bug.

---

## Perfect Negotiation

> `lib/webrtc/peer.ts`

If both peers offer simultaneously ("glare"), the connection breaks. The fix
assigns roles:

- **Polite** peer yields — rolls back its own offer and accepts theirs
- **Impolite** peer ignores the incoming offer and continues

Roles come from comparing peer IDs, so both sides compute opposite, matching
answers with zero extra signaling:

```ts
this.polite = selfId < remoteId;
```

```ts
const readyForOffer =
  !makingOffer && (pc.signalingState === "stable" || settingRemoteAnswer);
const offerCollision = sdp.type === "offer" && !readyForOffer;

ignoreOffer = !polite && offerCollision;
if (ignoreOffer) return;

await pc.setRemoteDescription(sdp);   // polite peer rolls back automatically
```

This matters far beyond first connection: **every screen-share toggle
renegotiates.** Without this pattern, two people sharing at the same instant
deadlock the call.

---

## ontrack

> `lib/webrtc/peer.ts`

Fires once per incoming remote track. Collect them into a stream for a
`<video>` element:

```ts
pc.ontrack = (event) => {
  const [stream] = event.streams;
  onStream(stream);
};
```

`srcObject` must be assigned imperatively — it takes an object, not a string,
so React skips it as a JSX attribute:

```tsx
useEffect(() => {
  if (videoRef.current) videoRef.current.srcObject = stream;
}, [stream]);
```

---

## RTCRtpSender and replaceTrack

> `hooks/useScreenShare.ts`

`addTrack()` returns an **RTCRtpSender** — the object that actually transmits
a track. `replaceTrack()` hot-swaps its source:

```ts
await sender.replaceTrack(screenTrack);   // camera → screen
await sender.replaceTrack(cameraTrack);   // screen → camera
```

Same SSRC, same transport, same ICE path — **no renegotiation**. The remote
`<video>` simply starts showing different pixels.

Removing and re-adding a track instead forces a full offer/answer round trip
and a visible freeze. Our test asserts the remote track id is *unchanged*
through a share-and-restore cycle, which proves the fast path is being used.

### Handling the browser's own Stop button

The browser renders a "Stop sharing" bar outside the page. Clicking it ends
the track without telling your UI:

```ts
track.addEventListener("ended", () => void stop(), { once: true });
```

Without this, the app claims to be sharing a dead track.

---

## Data channels

> `lib/webrtc/peer.ts`, `hooks/useChat.ts`

An arbitrary-data pipe over the same peer connection as media, encrypted the
same way. Parley uses it for chat, typing indicators and media state.

### Negotiated channels avoid a race

```ts
pc.createDataChannel("parley", { negotiated: true, id: 0, ordered: true });
```

With in-band channels, only the offerer's channel exists until the answer
arrives — and under perfect negotiation you cannot be sure which side that
is. Fixing the id lets **both** sides create it independently, removing the
`ondatachannel` race entirely.

---

## Connection states

> `lib/webrtc/peer.ts`

`RTCPeerConnection.connectionState` has six values. Users care about three
ideas, so we map them:

| Browser state | Parley shows | Why |
|---|---|---|
| `new`, `connecting` | Connecting… | |
| `connected` | Connected | |
| `disconnected` | **Reconnecting…** | **Not fatal.** Packets stopped briefly; the browser is still trying. Showing "failed" here would be wrong and alarming. |
| `failed` | Failed | ICE exhausted every candidate pair |
| `closed` | Disconnected | |

On `failed` we call `restartIce()`, which gathers fresh candidates over the
existing connection. This is what lets a call survive a network change —
wifi to cellular — instead of dropping.

---

## What the signaling server never does

> `party/signal.ts`

It forwards JSON. It has no access to media, and it cannot decrypt anything.
Relay is **targeted, never broadcast** — an SDP offer is meant for exactly
one peer, and broadcasting it would make every other peer try to answer a
negotiation that is not theirs.

If the signaling server dies mid-call, existing connections keep working.
Only new joins would fail.
