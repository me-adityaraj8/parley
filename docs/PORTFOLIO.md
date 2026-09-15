# Portfolio material

---

## Project description (long)

**Parley — peer-to-peer video calling**

Parley is a browser-based video calling application built on raw WebRTC. Up
to six participants connect in a full mesh, where every browser holds a
direct encrypted connection to every other browser. Audio, video and chat
never pass through a server — a PartyKit signaling layer introduces peers to
each other and then plays no further part in the call.

The project implements the WebRTC handshake directly rather than using an SDK:
offer/answer exchange, trickle ICE with a candidate queue, the Perfect
Negotiation pattern for glare-free renegotiation, `replaceTrack` screen
sharing that swaps the outgoing video source without a renegotiation, and
negotiated data channels carrying chat and presence.

The interface is a dark, cinematic design system driven by a reusable GSAP
animation layer — ScrollTrigger section reveals, SplitText headline staggers,
and FLIP transitions that make video tiles glide into position as the grid
re-flows when someone joins. Every animation is gated on
`prefers-reduced-motion` in a way that still leaves content visible.

Correctness is verified by an automated suite that drives real headless
browsers with synthetic camera devices, asserting on decoded frame
dimensions rather than UI state.

## Project description (short)

Peer-to-peer video calling for up to six people, built on raw WebRTC with a
full-mesh topology. Media never touches a server. Implements offer/answer,
trickle ICE, Perfect Negotiation, `replaceTrack` screen sharing and data
channel chat, wrapped in a GSAP-animated dark interface. Verified by an
end-to-end suite that runs real browsers with fake media devices.

## One line

Serverless-media video calling in the browser — WebRTC mesh, PartyKit
signaling, GSAP interface.

---

## Résumé bullet points

Pick three or four; don't use all of them.

- Built a peer-to-peer video calling application on raw WebRTC APIs
  (`RTCPeerConnection`, SDP offer/answer, trickle ICE, data channels)
  supporting six-participant mesh calls with no media server.

- Implemented the **Perfect Negotiation** pattern with deterministic
  polite/impolite role assignment, eliminating SDP glare during mid-call
  renegotiation such as screen sharing.

- Engineered screen sharing via `RTCRtpSender.replaceTrack()`, swapping the
  outgoing video source with no renegotiation; verified by asserting the
  remote track identity is preserved across a share-and-restore cycle.

- Designed a typed signaling protocol on PartyKit (Cloudflare Workers) with a
  message contract shared by client and server, giving compile-time safety
  across the network boundary.

- Built an automated WebRTC test suite driving multiple headless Chromium
  instances with synthetic media devices, asserting on decoded video frame
  dimensions to prove real media flow rather than UI state.

- Solved production WebRTC edge cases including ICE candidate arrival before
  remote description, ICE restart on connection failure, device hot-swapping
  mid-call, and browser-initiated screen-share termination.

- Created a reusable GSAP animation system (ScrollTrigger, SplitText, FLIP)
  with `prefers-reduced-motion` handling built into every primitive and
  automatic context cleanup to prevent memory leaks in a long-lived call UI.

- Built the interface in Next.js 15, React 19 and TypeScript under strict
  mode with `noUncheckedIndexedAccess`, catching peer-map race conditions at
  compile time.

---

## Technical interview questions and answers

### 1. Walk me through what happens when two users connect.

Browser A opens a WebSocket to the signaling server and joins a room. The
server replies with a roster of who is already present and tells existing
peers that A joined. For each peer, A constructs an `RTCPeerConnection` and
attaches its local tracks.

Attaching tracks fires `onnegotiationneeded`, so A calls
`setLocalDescription()`, producing an SDP offer, and relays it through the
signaling server to B. B applies it with `setRemoteDescription()`, calls
`setLocalDescription()` to produce an answer, and relays that back.

In parallel both sides emit ICE candidates as they are discovered and forward
them to each other. ICE tests candidate pairs until one succeeds, DTLS
negotiates encryption keys, and media flows directly between the browsers.
From that point the signaling server is idle.

### 2. What is the difference between STUN and TURN, and when do you need each?

STUN answers one question: "what public IP and port does the internet see me
as?" It is a single small request/response and costs almost nothing, which is
why public STUN servers exist. It works whenever a direct path between peers
is possible — roughly 80% of real networks.

TURN *relays the media itself*. You need it when no direct path exists —
symmetric NAT, or corporate firewalls that block UDP. Because it forwards
every byte of every call, it costs real bandwidth and is never free.

Parley ships with STUN only and accepts that 10–20% of connections will fail
on hostile networks. TURN credentials can be supplied via environment
variables to close that gap.

### 3. What is SDP glare, and how do you handle it?

Glare is when both peers send an offer at the same moment. Neither is in a
stable signaling state to accept the other's, and the connection wedges.

The fix is the Perfect Negotiation pattern. Each peer is assigned a role —
polite or impolite — by comparing peer IDs, so both sides independently
compute opposite, consistent answers with no extra messages. On collision,
the polite peer yields: `setRemoteDescription()` with an incoming offer
performs an automatic rollback of its own pending offer. The impolite peer
ignores the incoming offer and proceeds with its own.

This matters most for renegotiation, not first connect. Every screen-share
toggle triggers a new negotiation, so without this, two people sharing
simultaneously would deadlock.

### 4. How does screen sharing work without interrupting the call?

`addTrack()` returns an `RTCRtpSender`, which is the object that actually
transmits a track. `replaceTrack()` swaps the sender's source while keeping
the same SSRC, transport and ICE path — so no renegotiation is required and
the remote `<video>` simply starts showing different pixels.

The alternative — removing the camera track and adding a screen track —
forces a full offer/answer round trip and a visible freeze.

Two edge cases matter. The browser draws its own "Stop sharing" control
outside the page, so you must listen for `track.onended` or your UI will
claim to be sharing a dead track. And dismissing the picker throws
`NotAllowedError`, which is a user choice rather than an error, so it should
surface nothing.

### 5. Why is the room capped at six people?

Mesh topology means each browser uploads its own video once per remote peer.
With six people that is five simultaneous outbound streams. At 720p that
saturates a typical residential uplink, and the failure mode is ugly —
everyone's quality degrades at once rather than one clear error.

Scaling further requires an SFU: peers upload once to a server that forwards
streams to everyone else. That trades the privacy property away, because the
server now handles your media, and it is a substantially different
architecture rather than a tuning change.

### 6. Why queue ICE candidates?

`addIceCandidate()` throws if the peer connection has no remote description
yet. Because signaling messages race, candidates routinely arrive before the
offer they belong to.

If you do not queue them, you silently drop valid network routes. The call
still connects whenever the timing happens to work out, so it presents as
"connects most of the time" — which is much harder to diagnose than a
consistent failure.

### 7. `track.enabled = false` or `track.stop()` for mute?

`enabled = false`. The track stays attached to the peer connection and
transmits silence or black frames. It is instant, reversible, and requires no
signaling or renegotiation.

`stop()` permanently ends the track and releases the hardware — the camera
light goes out. Undoing it means calling `getUserMedia` again and
renegotiating. It is correct for leaving a call, wrong for muting.

Related: dropping a reference to a MediaStream does not release the camera.
You must stop every track individually, or the camera light stays on. That is
the most common resource leak in WebRTC applications.

### 8. What does `connectionState === "disconnected"` mean?

That packets have stopped arriving, but the browser is still trying. It is
**not** terminal — it commonly resolves on its own within a few seconds after
a brief network blip.

Parley maps it to "Reconnecting…" rather than a failure. Only `failed` means
ICE has exhausted every candidate pair, and there we call `restartIce()` to
gather fresh candidates over the existing connection. That is what allows a
call to survive moving from wifi to cellular.

### 9. How do you test WebRTC automatically?

Chromium can synthesize camera and microphone devices with
`--use-fake-device-for-media-stream`, so you can launch multiple real browser
instances, join them to the same room, and drive genuine peer connections
headlessly.

The important part is choosing an assertion that cannot be faked. Parley
asserts `video.videoWidth > 0` on every tile: that value is only non-zero if
frames actually arrived, were decoded and were painted. UI state, connection
labels and even track objects can all look correct while no media flows —
decoded frame dimensions cannot.

### 10. Why does chat go over a data channel instead of the signaling socket?

Because it is the honest implementation of the product's claim. If chat went
through the signaling server, that server would see every message and the
"nothing in the middle" promise would be false.

A data channel rides the same peer connection as media, with the same DTLS
encryption. In a mesh, sending is a fan-out — one copy per peer.

The trade-off is real: there is no history. A late joiner cannot receive
messages sent before they arrived, because nothing stored them. That is
inherent to serverless chat, and the UI states it plainly rather than hiding
it.

### 11. Why is the signaling protocol in a shared types file?

`types/signaling.ts` is imported by both the browser client and the PartyKit
server. Because both are TypeScript, a change to a message shape becomes a
compile error on both sides simultaneously.

The alternative — duplicated interfaces — lets client and server drift, and
the failure surfaces at runtime as a message the other side silently ignores.
Protocol mismatches are among the hardest bugs to trace in distributed
systems, so making them compile errors is worth the coupling.

### 12. How do you stop animations from degrading call performance?

Three rules. First, animate only `transform` and `opacity`, which the
compositor handles without layout or paint — so nothing competes with video
decode. Second, every animation is created inside `useGSAP` with a scope, so
tweens and ScrollTriggers are reverted on unmount; in a call where tiles mount
and unmount constantly, a leaked ScrollTrigger holding a dead `<video>`
reference keeps its MediaStream alive. Third, `prefers-reduced-motion`
collapses duration to near-zero but still applies the *end* state, so content
always ends visible — a naive implementation that skips animations entirely
leaves everything stuck at `opacity: 0` for exactly the users the setting is
meant to help.
