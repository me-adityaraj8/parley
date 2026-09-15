"use client";

import type { DataMessage, LinkState, PeerId, SignalPayload } from "@/types";
import {
  BULK_CHANNEL_ID,
  BULK_CHANNEL_LABEL,
  DATA_CHANNEL_ID,
  DATA_CHANNEL_LABEL,
  peerConfig,
} from "./config";

/** Pause sending above this many buffered bytes; resume below the low mark. */
const BULK_HIGH_WATER = 4 * 1024 * 1024;
const BULK_LOW_WATER = 1 * 1024 * 1024;

interface PeerLinkOptions {
  selfId: PeerId;
  remoteId: PeerId;
  /** Sends a signaling payload to this specific remote peer. */
  signal: (payload: SignalPayload) => void;
  onStream: (stream: MediaStream) => void;
  onState: (state: LinkState) => void;
  onData: (msg: DataMessage) => void;
  /** Raw frames from the bulk channel (file chunks). */
  onBulk?: (data: ArrayBuffer) => void;
}

/**
 * ONE connection to ONE remote peer.
 *
 * ── THE HANDSHAKE ────────────────────────────────────────────────────────
 *  1. A calls setLocalDescription() → an OFFER (SDP) describing what it can
 *     send and receive. Sent via the signaling server.
 *  2. B calls setRemoteDescription(offer), then setLocalDescription() → an
 *     ANSWER. Sent back via the signaling server.
 *  3. Meanwhile both sides emit ICE CANDIDATES (possible network routes) as
 *     they are discovered, and forward them to each other. This is
 *     "trickle ICE" — sending them as they arrive instead of waiting for
 *     the full list, which cuts seconds off connection time.
 *  4. ICE finds a working candidate pair, DTLS negotiates encryption keys,
 *     and media starts flowing DIRECTLY between the browsers.
 *
 * ── PERFECT NEGOTIATION ──────────────────────────────────────────────────
 * If both peers try to offer at the same moment ("glare"), the connection
 * breaks. The standard fix assigns each peer a role:
 *   - the POLITE peer yields: it rolls back its own offer and accepts theirs
 *   - the IMPOLITE peer ignores the incoming offer and presses on
 * Roles are derived by comparing peer IDs, so both sides independently
 * compute opposite, consistent answers with no extra signaling.
 *
 * This matters far beyond the initial connection: every screen share
 * toggle renegotiates, and without this pattern a share started at the same
 * moment on both sides would deadlock the call.
 */
export class PeerLink {
  readonly remoteId: PeerId;
  /** Polite peers yield on collision. Opposite on each side, by construction. */
  readonly polite: boolean;

  private pc: RTCPeerConnection;
  private channel: RTCDataChannel;
  private bulk: RTCDataChannel;
  private opts: PeerLinkOptions;

  private makingOffer = false;
  private ignoreOffer = false;
  private settingRemoteAnswer = false;
  private closed = false;

  /** Candidates that arrived before setRemoteDescription — see below. */
  private pendingCandidates: RTCIceCandidateInit[] = [];

  private senders = new Map<"audio" | "video", RTCRtpSender>();
  private remoteStream = new MediaStream();

  constructor(opts: PeerLinkOptions) {
    this.opts = opts;
    this.remoteId = opts.remoteId;
    this.polite = opts.selfId < opts.remoteId;

    this.pc = new RTCPeerConnection(peerConfig());

    /**
     * The data channel is "negotiated out of band": both sides create it
     * with the SAME id, so neither has to wait for an `ondatachannel` event.
     * With in-band channels, only the offerer's channel exists until the
     * answer lands — and under perfect negotiation you cannot be sure which
     * side that is. Fixing the id removes the race entirely.
     */
    this.channel = this.pc.createDataChannel(DATA_CHANNEL_LABEL, {
      negotiated: true,
      id: DATA_CHANNEL_ID,
      ordered: true,
    });
    /**
     * Second negotiated channel for high-volume traffic. Keeping files and
     * whiteboard strokes off the control channel is what stops a large
     * transfer from delaying a chat message or a raised hand — SCTP
     * guarantees order within a channel, not across channels.
     */
    this.bulk = this.pc.createDataChannel(BULK_CHANNEL_LABEL, {
      negotiated: true,
      id: BULK_CHANNEL_ID,
      ordered: true,
    });
    this.bulk.binaryType = "arraybuffer";
    this.bulk.bufferedAmountLowThreshold = BULK_LOW_WATER;
    this.bulk.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (event.data instanceof ArrayBuffer) this.opts.onBulk?.(event.data);
    };

    this.wireChannel();
    this.wireConnection();
  }

  // ------------------------------------------------------------- wiring

  private wireConnection(): void {
    /**
     * Fires whenever the connection needs a new offer: on the first
     * addTrack, and again on every replaceTrack that changes codecs or any
     * addTrack/removeTrack later. We never call createOffer manually.
     */
    this.pc.onnegotiationneeded = async () => {
      if (this.closed) return;
      try {
        this.makingOffer = true;
        // Argument-less setLocalDescription() creates the right description
        // (offer or answer) for the current state — less error-prone than
        // calling createOffer() and passing the result back in.
        await this.pc.setLocalDescription();
        if (this.pc.localDescription) {
          this.opts.signal({ k: "description", sdp: this.pc.localDescription });
        }
      } catch {
        /* negotiation will be retried by the next state change */
      } finally {
        this.makingOffer = false;
      }
    };

    this.pc.onicecandidate = ({ candidate }) => {
      // A null candidate signals end-of-gathering; there is nothing to send.
      if (candidate) {
        this.opts.signal({ k: "candidate", candidate: candidate.toJSON() });
      }
    };

    /**
     * ontrack fires once per remote track (audio, then video). We collect
     * them into one MediaStream so a <video> element can render the peer.
     * Note the browser may fire this again after a replaceTrack.
     */
    this.pc.ontrack = (event) => {
      const [incoming] = event.streams;
      if (incoming) {
        this.remoteStream = incoming;
      } else if (!this.remoteStream.getTracks().includes(event.track)) {
        this.remoteStream.addTrack(event.track);
      }
      this.opts.onStream(this.remoteStream);
    };

    this.pc.onconnectionstatechange = () => {
      this.opts.onState(this.mapState());

      // "failed" means ICE exhausted every candidate pair. An ICE restart
      // gathers fresh candidates and tries again — this recovers calls that
      // survive a network change (wifi → cellular) instead of dropping them.
      if (this.pc.connectionState === "failed" && !this.closed) {
        this.restart();
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      this.opts.onState(this.mapState());
    };
  }

  private wireChannel(): void {
    this.channel.onmessage = (event: MessageEvent<string>) => {
      try {
        this.opts.onData(JSON.parse(event.data) as DataMessage);
      } catch {
        /* ignore malformed peer data */
      }
    };
  }

  /**
   * RTCPeerConnectionState has six values; users care about three ideas:
   * working, trying, broken. "disconnected" in particular is NOT fatal —
   * it means packets stopped briefly and the browser is still trying, so
   * showing "call failed" there would be wrong and alarming.
   */
  private mapState(): LinkState {
    if (this.closed) return "closed";
    switch (this.pc.connectionState) {
      case "new":
        return "new";
      case "connecting":
        return "connecting";
      case "connected":
        return "connected";
      case "disconnected":
        return "reconnecting";
      case "failed":
        return "failed";
      case "closed":
        return "closed";
      default:
        return "new";
    }
  }

  // ------------------------------------------------------------- signaling

  /** Handles an SDP description from the remote peer. */
  async acceptDescription(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (this.closed) return;

    const readyForOffer =
      !this.makingOffer &&
      (this.pc.signalingState === "stable" || this.settingRemoteAnswer);
    const offerCollision = sdp.type === "offer" && !readyForOffer;

    // Impolite peer wins a collision by ignoring the incoming offer.
    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;

    try {
      this.settingRemoteAnswer = sdp.type === "answer";
      // The polite peer handles collision implicitly: setRemoteDescription
      // with an offer while it has a pending local offer performs an
      // automatic rollback.
      await this.pc.setRemoteDescription(sdp);
      this.settingRemoteAnswer = false;

      await this.flushCandidates();

      if (sdp.type === "offer") {
        await this.pc.setLocalDescription();
        if (this.pc.localDescription) {
          this.opts.signal({ k: "description", sdp: this.pc.localDescription });
        }
      }
    } catch {
      this.settingRemoteAnswer = false;
    }
  }

  /**
   * Handles a remote ICE candidate.
   *
   * Candidates routinely arrive BEFORE the offer they belong to, because
   * signaling messages race. addIceCandidate throws if there is no remote
   * description yet, so we queue them and flush once the description lands.
   * Skipping this queue is the single most common cause of calls that
   * connect "sometimes".
   */
  async acceptCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.closed) return;

    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (err) {
      // Expected when we deliberately ignored an offer — the candidates
      // belong to a negotiation we abandoned.
      if (!this.ignoreOffer) throw err;
    }
  }

  private async flushCandidates(): Promise<void> {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of queued) {
      try {
        await this.pc.addIceCandidate(c);
      } catch {
        /* stale candidate from a rolled-back negotiation */
      }
    }
  }

  // ------------------------------------------------------------- media

  /** Attaches local tracks. Triggers onnegotiationneeded automatically. */
  addLocalStream(stream: MediaStream): void {
    if (this.closed) return;
    for (const track of stream.getTracks()) {
      const kind = track.kind as "audio" | "video";
      if (this.senders.has(kind)) continue;
      this.senders.set(kind, this.pc.addTrack(track, stream));
    }
  }

  /**
   * Swaps the outgoing track without renegotiating — this is how screen
   * sharing avoids a visible reconnection.
   *
   * RTCRtpSender is the object that actually transmits a track. replaceTrack
   * hot-swaps its source: same SSRC, same transport, same ICE path. The
   * remote side's <video> element simply starts showing different pixels.
   * Removing and re-adding a track instead would force a full offer/answer
   * round trip and a visible freeze.
   */
  async replaceTrack(kind: "audio" | "video", track: MediaStreamTrack | null): Promise<void> {
    const sender = this.senders.get(kind);
    if (!sender || this.closed) return;
    try {
      await sender.replaceTrack(track);
    } catch {
      /* peer is closing */
    }
  }

  // ------------------------------------------------------------- data

  // ------------------------------------------------------------- bulk

  /**
   * Sends one binary frame, respecting backpressure.
   *
   * `bufferedAmount` is the bytes SCTP has accepted but not yet put on the
   * wire. Writing without checking it grows an unbounded in-memory queue and
   * will eventually abort the connection on a slow link. We stop at the high
   * water mark and resume on `bufferedamountlow`.
   */
  async sendBulk(frame: ArrayBuffer): Promise<boolean> {
    if (this.bulk.readyState !== "open" || this.closed) return false;

    if (this.bulk.bufferedAmount > BULK_HIGH_WATER) {
      await this.drain();
      if (this.bulk.readyState !== "open" || this.closed) return false;
    }
    try {
      this.bulk.send(frame);
      return true;
    } catch {
      return false;
    }
  }

  /** Resolves once the send buffer has drained below the low-water mark. */
  private drain(): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        this.bulk.removeEventListener("bufferedamountlow", done);
        resolve();
      };
      this.bulk.addEventListener("bufferedamountlow", done, { once: true });
      // Safety valve: if the event never fires (channel closing) do not hang.
      setTimeout(done, 4000);
    });
  }

  get bulkReady(): boolean {
    return this.bulk.readyState === "open";
  }

  get bufferedAmount(): number {
    return this.bulk.bufferedAmount;
  }

  // ------------------------------------------------------------- data

  sendData(msg: DataMessage): boolean {
    if (this.channel.readyState !== "open") return false;
    try {
      this.channel.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  get dataReady(): boolean {
    return this.channel.readyState === "open";
  }

  onDataOpen(cb: () => void): void {
    if (this.channel.readyState === "open") {
      cb();
      return;
    }
    this.channel.addEventListener("open", cb, { once: true });
  }

  // ------------------------------------------------------------- lifecycle

  /** Gathers fresh ICE candidates over the existing connection. */
  restart(): void {
    if (this.closed) return;
    try {
      this.pc.restartIce();
    } catch {
      /* not supported — the connection will be rebuilt by the mesh */
    }
  }

  get state(): LinkState {
    return this.mapState();
  }

  get connection(): RTCPeerConnection {
    return this.pc;
  }

  /**
   * Full teardown. Order matters: detach handlers first so nothing fires
   * during close, then release senders, then close the connection itself.
   * Note we do NOT stop the local tracks here — they are shared across every
   * peer in the mesh and owned by useLocalMedia.
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;

    this.pc.onnegotiationneeded = null;
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.onconnectionstatechange = null;
    this.pc.oniceconnectionstatechange = null;
    this.channel.onmessage = null;
    this.bulk.onmessage = null;

    for (const ch of [this.channel, this.bulk]) {
      try {
        ch.close();
      } catch {
        /* already closed */
      }
    }
    for (const sender of this.senders.values()) {
      try {
        this.pc.removeTrack(sender);
      } catch {
        /* connection already closed */
      }
    }
    this.senders.clear();
    this.pendingCandidates = [];

    try {
      this.pc.close();
    } catch {
      /* already closed */
    }
    this.opts.onState("closed");
  }
}
