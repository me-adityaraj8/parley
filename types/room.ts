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
  /** 0-1, from real-time RMS of the received audio. Drives the mic ring. */
  level: number;
  handRaised: boolean;
  /** LOCAL playback volume only — never mutes the peer for anyone else. */
  volume: number;
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
  /** id of the message being replied to. */
  replyTo?: string;
  /** emoji → peer ids who reacted. */
  reactions?: Record<string, PeerId[]>;
  /**
   * System notices ("Ada joined") are rendered as centred chips rather than
   * bubbles. They are generated locally from roster events — no peer sends
   * them, so they cannot be spoofed by a remote participant.
   */
  system?: boolean;
}

/**
 * Messages sent over the WebRTC data channels — peer-to-peer, never through
 * the signaling server.
 *
 * TWO CHANNELS, deliberately:
 *
 *  - CONTROL (id 0) carries these small JSON messages. It must stay
 *    responsive: a chat message or a raised hand should never queue behind
 *    a 200 MB file.
 *  - BULK (id 1) carries file chunks and whiteboard strokes. SCTP delivers
 *    in order *within* a channel, so putting high-volume traffic on its own
 *    channel is what prevents head-of-line blocking of the control path.
 */
export type DataMessage =
  // ---- presence & identity -------------------------------------------
  | { t: "identity"; name: string }
  | { t: "media"; media: MediaFlags }
  | { t: "hand"; up: boolean }
  // ---- chat ------------------------------------------------------------
  | { t: "chat"; id: string; body: string; at: number; replyTo?: string }
  | { t: "chat-react"; id: string; emoji: string; on: boolean }
  | { t: "typing"; on: boolean }
  // ---- ephemeral reactions --------------------------------------------
  | { t: "reaction"; emoji: string; at: number }
  // ---- file transfer control (payload rides the BULK channel) ---------
  | { t: "file-offer"; id: number; name: string; size: number; mime: string }
  | { t: "file-done"; id: number }
  | { t: "file-cancel"; id: number; reason?: string }
  // ---- whiteboard ------------------------------------------------------
  | { t: "wb"; op: WhiteboardOp };

/** Emoji allowed as ephemeral reactions. */
export const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "🔥"] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

/** A reaction currently floating on screen. Never persisted. */
export interface FloatingReaction {
  key: string;
  emoji: string;
  peerId: PeerId;
  peerName: string;
}

// ---------------------------------------------------------------- whiteboard

/**
 * Whiteboard operations are sent as deltas, not full canvas state.
 *
 * A stroke is streamed: `start` opens it, `point` appends (batched), `end`
 * closes it. That way remote peers see a line being drawn live rather than
 * appearing once the pen lifts.
 */
export type WhiteboardOp =
  | { k: "start"; id: string; color: string; width: number; erase: boolean; x: number; y: number }
  | { k: "point"; id: string; pts: number[] }
  | { k: "end"; id: string }
  | { k: "text"; id: string; x: number; y: number; body: string; color: string; size: number }
  | { k: "undo"; id: string }
  | { k: "clear" };

export interface Stroke {
  id: string;
  authorId: PeerId;
  color: string;
  width: number;
  erase: boolean;
  /** Flat [x0,y0,x1,y1,…] in normalised 0-1 space so canvases can differ in size. */
  points: number[];
}

export interface TextNote {
  id: string;
  authorId: PeerId;
  x: number;
  y: number;
  body: string;
  color: string;
  size: number;
}

// ---------------------------------------------------------------- transfers

export type TransferState =
  | "offered"
  | "transferring"
  | "complete"
  | "cancelled"
  | "failed";

export interface FileTransfer {
  /** Unique per sender; the wire format keys chunks by this. */
  id: number;
  peerId: PeerId;
  peerName: string;
  direction: "in" | "out";
  name: string;
  size: number;
  mime: string;
  transferred: number;
  state: TransferState;
  /** Bytes per second, smoothed. */
  rate: number;
  startedAt: number;
  /** Object URL for a completed inbound file. Revoked on cleanup. */
  url?: string;
  error?: string;
}

export type PanelId = "chat" | "participants" | "files" | "diagnostics" | null;
