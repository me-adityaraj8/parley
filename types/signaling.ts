/**
 * SIGNALING PROTOCOL
 *
 * This file is the contract between the browser and the PartyKit server.
 * Both sides import it, so a change to a message shape breaks the build
 * on both ends at once instead of failing silently at runtime.
 *
 * CRITICAL CONCEPT: the signaling server never sees audio or video.
 * It only carries the small JSON messages two browsers need in order to
 * find each other and agree on how to talk. Once they agree, media flows
 * browser-to-browser and the server is idle.
 */

export type PeerId = string;

/** Whether a participant's mic, camera and screen share are live. */
export interface MediaFlags {
  audio: boolean;
  video: boolean;
  screen: boolean;
}

/** A participant as the signaling server knows them. */
export interface RosterEntry {
  id: PeerId;
  name: string;
  media: MediaFlags;
  /** Server clock time the peer joined — used for deterministic ordering. */
  joinedAt: number;
}

/**
 * The payloads WebRTC needs relayed. Everything else in this protocol is
 * bookkeeping; these two are the actual handshake.
 *
 * - `description` carries SDP: an offer or an answer. SDP is a text
 *   document describing codecs, resolutions and transport parameters —
 *   "here is what I can send and receive."
 * - `candidate` carries an ICE candidate: one possible network route
 *   ("reach me at this IP and port"). Peers exchange many of these.
 */
export type SignalPayload =
  | { k: "description"; sdp: SessionDescription }
  | { k: "candidate"; candidate: IceCandidate };

/**
 * Structural mirrors of RTCSessionDescriptionInit / RTCIceCandidateInit.
 *
 * This file is compiled for BOTH the browser and the Cloudflare Workers
 * runtime, and Workers has no DOM lib — so the protocol cannot reference DOM
 * types. These are structurally identical, so browser code still passes real
 * RTC objects straight through with no casting.
 */
export interface SessionDescription {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp?: string;
}

export interface IceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

/** Browser → server. */
export type ClientMessage =
  | { t: "join"; name: string; media: MediaFlags }
  | { t: "relay"; to: PeerId; data: SignalPayload }
  | { t: "media"; media: MediaFlags }
  | { t: "rename"; name: string };

/** Server → browser. */
export type ServerMessage =
  | { t: "welcome"; self: PeerId; peers: RosterEntry[]; roomId: string }
  | { t: "peer-join"; peer: RosterEntry }
  | { t: "peer-leave"; id: PeerId }
  | { t: "relay"; from: PeerId; data: SignalPayload }
  | { t: "media"; id: PeerId; media: MediaFlags }
  | { t: "rename"; id: PeerId; name: string }
  | { t: "room-full"; limit: number }
  | { t: "error"; code: string; message: string };

/**
 * Mesh topology means every participant holds a connection to every other
 * participant. Connections grow as n(n-1)/2, and each browser uploads its
 * video n-1 times. Past roughly 6 people that saturates a typical uplink,
 * so we cap the room rather than let the call degrade unpredictably.
 */
export const ROOM_CAPACITY = 6;

export const isServerMessage = (v: unknown): v is ServerMessage =>
  typeof v === "object" && v !== null && typeof (v as { t?: unknown }).t === "string";
