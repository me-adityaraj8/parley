import type { PeerId } from "./signaling";

export type CallHealth = "excellent" | "good" | "fair" | "poor" | "unknown";

export interface DirectionStats {
  /** Kilobits per second, computed from byte deltas between polls. */
  kbps: number;
  packets: number;
  packetsLost: number;
  /** 0-100, computed from deltas so it reflects *recent* loss, not lifetime. */
  lossPct: number;
  /** Milliseconds. */
  jitterMs: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
}

export interface PeerStats {
  peerId: PeerId;
  peerName: string;
  connectionState: RTCPeerConnectionState;
  iceState: RTCIceConnectionState;
  /** Milliseconds, from the nominated candidate pair. */
  rttMs: number;
  /** e.g. "host ⇄ srflx" — tells you whether you went direct or via relay. */
  candidatePair: string;
  /** True when media is being relayed through TURN rather than direct. */
  relayed: boolean;
  availableOutgoingKbps: number;
  video: DirectionStats;
  audio: DirectionStats;
  health: CallHealth;
}

export interface CallStats {
  peers: PeerStats[];
  /** Worst health across peers — what the HUD badge shows. */
  health: CallHealth;
  rttMs: number;
  jitterMs: number;
  lossPct: number;
  updatedAt: number;
}

export const EMPTY_DIRECTION: DirectionStats = {
  kbps: 0,
  packets: 0,
  packetsLost: 0,
  lossPct: 0,
  jitterMs: 0,
  width: 0,
  height: 0,
  fps: 0,
  codec: "",
};
