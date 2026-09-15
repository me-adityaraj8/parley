import type { MediaFlags, PeerId } from "./signaling";

/**
 * How a single peer connection is doing, in terms a user can understand.
 * This is a simplification of RTCPeerConnectionState — see
 * lib/webrtc/peer.ts for the exact mapping and why it is not 1:1.
 */
export type LinkState =
  | "new"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "closed";

/** Health of the connection to the signaling server (not to peers). */
export type SignalingState =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "error";

export interface Participant {
  id: PeerId;
  name: string;
  isLocal: boolean;
  /** Remote media, or the local preview stream for the local participant. */
  stream: MediaStream | null;
  media: MediaFlags;
  link: LinkState;
  /** Driven by audio-level analysis, not by the mute button. */
  speaking: boolean;
}

export interface ChatMessage {
  id: string;
  authorId: PeerId;
  authorName: string;
  body: string;
  at: number;
  /** True when this client authored it — drives bubble alignment. */
  mine: boolean;
  /** Set when a data channel send failed. */
  failed?: boolean;
}

/**
 * Messages sent over the WebRTC data channel — peer-to-peer, never through
 * the signaling server. Kept deliberately small; these travel on the same
 * connection as media.
 */
export type DataMessage =
  | { t: "chat"; id: string; body: string; at: number }
  | { t: "typing"; on: boolean }
  | { t: "media"; media: MediaFlags }
  | { t: "identity"; name: string };

export type PanelId = "chat" | "participants" | null;
