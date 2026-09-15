# Parley

**[Live demo →](https://parley-me-adityaraj8s-projects.vercel.app)**

**Peer-to-peer video calling in the browser.** Audio, video and chat travel
directly between participants over WebRTC. The server introduces two browsers
to each other and then stops being involved.

Built with Next.js 15, TypeScript, Tailwind v4, ShadCN UI, GSAP, and a
Cloudflare Workers + Durable Objects signaling server.

---

## Why this exists

Most video-call products route your media through their servers, where it is
decoded, mixed and re-encoded. That is the right call at scale, but it means
the operator sits inside your conversation.

Parley takes the other path: a **full mesh**, where every participant holds a
direct encrypted connection to every other participant. There is no media
server, so there is nothing in the middle to store, inspect or mix. The cost
is upload bandwidth, which is why rooms cap at six people.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          SETUP  (transient)                          │
│                                                                      │
│   Browser A               Cloudflare Worker              Browser B    │
│   ─────────                  ────────                   ─────────    │
│       │  ──── join ────────────► │                          │        │
│       │  ◄─── welcome ────────── │  ──── peer-join ───────► │        │
│       │  ──── offer (SDP) ─────► │  ──── relay ───────────► │        │
│       │  ◄─── relay ──────────── │  ◄─── answer (SDP) ───── │        │
│       │  ──── ICE candidates ──► │  ◄─── ICE candidates ─── │        │
│                                                                      │
│   The Worker forwards small JSON messages. It never sees media.      │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       CALL  (for its whole duration)                 │
│                                                                      │
│   Browser A  ◄════════ WebRTC, DTLS-SRTP encrypted ════════► Browser B│
│                    audio · video · data channel                      │
│                                                                      │
│   The signaling server is idle. If it went offline right now,        │
│   this call would continue uninterrupted.                            │
└──────────────────────────────────────────────────────────────────────┘
```

### Mesh topology

```
 2 peers        3 peers            4 peers              6 peers
                                                       (room cap)
  A───B          A───B             A───B               15 connections
                  \ /              |\ /|               each browser
                   C               | X |               uploads 5×
                                   |/ \|
                                   D───C
```

Connections grow as `n(n-1)/2`. Each browser uploads its own video `n-1`
times, which is what bounds the room size — not CPU, but uplink.

### Layered design

```
  app/                 routes, server components, metadata
   └── components/     presentation only, no WebRTC knowledge
        └── hooks/     React lifecycle ↔ imperative browser APIs
             └── lib/  pure browser APIs, framework-agnostic
                       ├── webrtc/     RTCPeerConnection, ICE config
                       ├── signaling/  typed PartySocket wrapper
                       ├── media/      getUserMedia, devices, errors
                       └── animations/ GSAP primitives
  worker/              signaling server (Cloudflare Worker + Durable Object)
  types/               protocol contract shared by client AND server
```

`types/signaling.ts` is imported by both the browser and the server, so a
change to a message shape breaks both builds at once rather than failing
silently at runtime. It deliberately contains **no DOM types** — the Workers
runtime has no DOM lib, so the protocol defines its own structural mirrors of
`RTCSessionDescriptionInit` and `RTCIceCandidateInit`.

> **Note on Vercel Deployment Protection.** Vercel enables it by default on
> new projects, which forces every visitor to log into Vercel. For a public
> demo it must be turned off (Project → Settings → Deployment Protection).

---

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

`npm run dev` starts two processes:

| Process | Port | What it is |
|---|---|---|
| `dev:web` | 3100 | Next.js app |
| `dev:party` | 1999 | Signaling server (`wrangler dev`) |

Open <http://localhost:3100>, create a room, and open the link in a second
browser window to talk to yourself.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | app + signaling server together |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run shot -- / --vp 375x812` | screenshot any route via headless Brave |
| `npm run test:signaling` | protocol tests against the live party server |
| `npm run test:call` | 2-browser end-to-end WebRTC call |
| `npm run test:mesh` | 3-browser mesh test |
| `npm run test:share` | screen-share / replaceTrack test |
| `npm run test:all` | all of the above |

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_PARTYKIT_HOST` | yes | `127.0.0.1:1999` | Signaling host. In production, `parley-signaling.<subdomain>.workers.dev` |
| `NEXT_PUBLIC_REPO_URL` | no | `https://github.com` | GitHub link in the navbar |
| `NEXT_PUBLIC_TURN_URL` | no | — | TURN relay, e.g. `turn:host:3478` |
| `NEXT_PUBLIC_TURN_USERNAME` | no | — | TURN username |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | no | — | TURN credential |

All are `NEXT_PUBLIC_` because they are consumed in the browser. **Never put
a long-lived TURN secret here** — it ships to every visitor. Production TURN
should issue short-lived credentials from a server route.

---

## Deployment

**One command, once you are logged in:**

```bash
npx wrangler login     # interactive, once
vercel login           # interactive, once
npm run deploy         # deploys both, in the right order
```

`npm run deploy` publishes the signaling server, reads back its host, writes
that host into the Vercel environment, and then deploys the app. The order
matters: `NEXT_PUBLIC_*` variables are inlined into the client bundle at
**build** time, so the app must know the signaling host before it is built.

### Doing it manually

Two pieces deploy independently.

### 1. Signaling server → Cloudflare Workers

```bash
npx wrangler login
npm run deploy:party
```

Note the host it prints, e.g. `parley-signaling.yourname.workers.dev`.

A brand-new `workers.dev` subdomain takes a few minutes for Cloudflare to
issue its TLS certificate. Until then the host fails the TLS handshake — wait
and retry rather than assuming the deploy failed.

### 2. App → Vercel

```bash
npx vercel
```

Then set the environment variable in the Vercel dashboard:

```
NEXT_PUBLIC_PARTYKIT_HOST=parley-signaling.yourname.workers.dev
```

Redeploy so the client picks it up. The signaling client upgrades to `wss://`
automatically for non-localhost hosts.

> **HTTPS is mandatory.** `getUserMedia` is blocked on insecure origins, with
> `localhost` as the only exception. Vercel provides TLS by default.

---

## Browser compatibility

| Browser | Calls | Screen share | Notes |
|---|---|---|---|
| Chrome / Edge 90+ | ✅ | ✅ | Reference target |
| Brave | ✅ | ✅ | Shields may block STUN; allow-list the site if ICE fails |
| Firefox 90+ | ✅ | ✅ | No `setSinkId`, so speaker selection is hidden |
| Safari 15.4+ | ✅ | ✅ | Autoplay needs the muted-video path we already use |
| iOS Safari 15.4+ | ✅ | ❌ | iOS has no `getDisplayMedia` at all |
| Android Chrome | ✅ | ⚠️ | Share works but is awkward on small screens |

The app degrades rather than breaks: unsupported capability checks hide the
relevant control instead of erroring.

---

## Known limitations

These are deliberate trade-offs, not unfinished work.

1. **Six participants maximum.** Mesh upload cost is `n-1` copies of your
   video. At 720p that saturates a typical home uplink around 6 people.
   Going further requires an SFU, which is a different architecture.

2. **No TURN server by default.** Roughly 10–20% of connections fail on
   symmetric NAT or restrictive corporate networks. STUN alone cannot fix
   this; TURN is a bandwidth cost someone has to pay. Supply credentials via
   env to close the gap.

3. **Chat history does not persist.** Messages go peer-to-peer with nothing
   storing them, so a late joiner cannot see earlier messages. This is
   inherent to serverless chat, not an oversight.

4. **No recording.** There is no server-side stream to record.

5. **Rooms are link-secured.** Anyone with the link can join. There are no
   accounts, no lobby approval, and no host controls.

6. **No host controls.** There is no mute-others, kick, or lobby approval.
   Everyone in a room has equal authority.

7. **Two build-time `npm audit` advisories** in `postcss`, transitive under
   Next 15. Build-time only, not shipped to the browser; the fix requires
   Next 16.

---

## Future improvements

- **SFU fallback above 6 people** — keep mesh for small calls, switch to
  mediasoup/LiveKit above the threshold.
- **Simulcast** — send multiple resolutions so each peer gets what its
  bandwidth supports rather than one compromise stream.
- **Short-lived TURN credentials** issued from a route handler.
- **`getStats()` diagnostics panel** — live RTT, jitter, packet loss, and
  the selected candidate pair.
- **Virtual backgrounds** via `MediaStreamTrackProcessor` and WebGL.
- **Reconnect-into-room** so a refresh rejoins instead of leaving.
- **E2EE with insertable streams** for SFU mode, where the server would
  otherwise see media.

---

## Testing

The test suite drives **real browsers with synthetic camera and microphone
devices** (`--use-fake-device-for-media-stream`), so every assertion runs
against genuine `RTCPeerConnection` objects.

The key assertion throughout is `video.videoWidth > 0`: that value can only
be non-zero if frames actually arrived, decoded and painted. No amount of
correct-looking UI state can fake it.

```bash
npm run dev          # in one terminal
npm run test:all     # in another
```

---

## License

MIT
