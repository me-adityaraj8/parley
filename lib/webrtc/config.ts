/**
 * ICE configuration.
 *
 * WHY THIS EXISTS: two browsers almost never have a direct public address.
 * They sit behind NAT (your router), which hides their private IP. ICE is
 * the process of discovering a usable path between them.
 *
 * STUN ("what is my public address?") — a tiny, cheap query. The browser
 * asks a STUN server what IP:port the outside world sees it as, then offers
 * that as a candidate. This is enough for ~80% of real-world networks.
 *
 * TURN ("relay my traffic") — used when no direct path exists (symmetric
 * NAT, strict corporate firewalls). A TURN server forwards the actual media,
 * so it costs real bandwidth and is never free. Parley works without one,
 * but ~10-20% of connections will fail on hostile networks. Supplying TURN
 * credentials via env turns those failures into successes.
 */

const STUN_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

export function iceServers(): RTCIceServer[] {
  const servers = [...STUN_SERVERS];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrl && username && credential) {
    servers.push({ urls: turnUrl, username, credential });
  }
  return servers;
}

export function peerConfig(): RTCConfiguration {
  return {
    iceServers: iceServers(),
    // Gather candidates on one transport and reuse it for audio+video.
    // Halves ICE checks and speeds up connection setup.
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    iceCandidatePoolSize: 2,
  };
}

/** The data channel is negotiated out-of-band with a fixed id (see peer.ts). */
export const DATA_CHANNEL_ID = 0;
export const DATA_CHANNEL_LABEL = "parley";
