/**
 * PARLEY SIGNALING SERVER (PartyKit)
 *
 * ┌──────────┐   JSON over WebSocket   ┌──────────┐
 * │ Browser A│ ◄─────────────────────► │ PartyKit │
 * └────┬─────┘                         └────┬─────┘
 *      │                                    │ JSON over WebSocket
 *      │                               ┌────▼─────┐
 *      │                               │ Browser B│
 *      │                               └────┬─────┘
 *      │                                    │
 *      └──────── WebRTC: audio / video / data ───────┘
 *                (direct, never touches this server)
 *
 * WHAT THIS SERVER DOES
 *   - Tracks who is in a room.
 *   - Forwards SDP offers/answers and ICE candidates between peers.
 *   - Announces joins and leaves.
 *
 * WHAT THIS SERVER DOES NOT DO
 *   - It never sees a single video frame or audio sample. Media travels
 *     directly between browsers over an encrypted (DTLS-SRTP) connection.
 *     If this server goes down mid-call, the call keeps working — only new
 *     participants would be unable to join.
 *
 * One PartyKit "room" instance exists per room ID, so `this.room` already
 * scopes every connection to a single call. There is no cross-room state.
 */

import type * as Party from "partykit/server";
import type {
  ClientMessage,
  MediaFlags,
  RosterEntry,
  ServerMessage,
} from "../types/signaling";
import { ROOM_CAPACITY } from "../types/signaling";

interface PeerState extends Record<string, unknown> {
  name: string;
  media: MediaFlags;
  joinedAt: number;
  /** A connection that has not sent `join` yet is not part of the roster. */
  ready: boolean;
}

const DEFAULT_MEDIA: MediaFlags = { audio: true, video: true, screen: false };

export default class SignalServer implements Party.Server {
  // Hibernation keeps rooms cheap: idle rooms unload and wake on the next
  // message, with connection state rehydrated from attachments.
  static options = { hibernate: true };

  constructor(readonly room: Party.Room) {}

  // ---------------------------------------------------------------- helpers

  private stateOf(conn: Party.Connection<PeerState>): PeerState {
    return (
      conn.state ?? {
        name: "Guest",
        media: { ...DEFAULT_MEDIA },
        joinedAt: Date.now(),
        ready: false,
      }
    );
  }

  private roster(exceptId?: string): RosterEntry[] {
    const entries: RosterEntry[] = [];
    for (const conn of this.room.getConnections<PeerState>()) {
      if (conn.id === exceptId) continue;
      const s = conn.state;
      if (!s?.ready) continue;
      entries.push({
        id: conn.id,
        name: s.name,
        media: s.media,
        joinedAt: s.joinedAt,
      });
    }
    // Deterministic order so every client derives the same peer ordering.
    return entries.sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
  }

  private readyCount(): number {
    let n = 0;
    for (const conn of this.room.getConnections<PeerState>()) {
      if (conn.state?.ready) n++;
    }
    return n;
  }

  private send(conn: Party.Connection, msg: ServerMessage): void {
    try {
      conn.send(JSON.stringify(msg));
    } catch {
      // The socket closed between our check and this send. Nothing to do —
      // onClose will clean up the roster.
    }
  }

  private broadcast(msg: ServerMessage, except: string[] = []): void {
    this.room.broadcast(JSON.stringify(msg), except);
  }

  // ------------------------------------------------------------- lifecycle

  onConnect(conn: Party.Connection<PeerState>): void {
    // A socket is open but the peer is not in the room until it sends
    // `join` with a display name. This keeps half-open sockets (and the
    // browser's own reconnect attempts) out of the roster.
    conn.setState({
      name: "Guest",
      media: { ...DEFAULT_MEDIA },
      joinedAt: Date.now(),
      ready: false,
    });
  }

  onMessage(raw: string, sender: Party.Connection<PeerState>): void {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send(sender, {
        t: "error",
        code: "bad-json",
        message: "Message was not valid JSON.",
      });
      return;
    }

    switch (msg.t) {
      case "join":
        this.handleJoin(msg, sender);
        return;

      case "relay":
        this.handleRelay(msg, sender);
        return;

      case "media": {
        const state = this.stateOf(sender);
        sender.setState({ ...state, media: msg.media });
        if (state.ready) {
          this.broadcast({ t: "media", id: sender.id, media: msg.media }, [sender.id]);
        }
        return;
      }

      case "rename": {
        const state = this.stateOf(sender);
        const name = sanitizeName(msg.name);
        sender.setState({ ...state, name });
        if (state.ready) {
          this.broadcast({ t: "rename", id: sender.id, name }, [sender.id]);
        }
        return;
      }

      default:
        this.send(sender, {
          t: "error",
          code: "unknown-type",
          message: "Unrecognised message type.",
        });
    }
  }

  private handleJoin(
    msg: Extract<ClientMessage, { t: "join" }>,
    sender: Party.Connection<PeerState>,
  ): void {
    const existing = this.stateOf(sender);

    // Re-sending `join` on the same socket is a no-op resync, not a second
    // participant — this happens when a client reconnects after a drop.
    if (!existing.ready && this.readyCount() >= ROOM_CAPACITY) {
      this.send(sender, { t: "room-full", limit: ROOM_CAPACITY });
      // Close with a normal code so the client does not auto-reconnect into
      // a room it cannot enter.
      conn_close(sender, 4001, "room-full");
      return;
    }

    const state: PeerState = {
      name: sanitizeName(msg.name),
      media: msg.media ?? { ...DEFAULT_MEDIA },
      joinedAt: existing.joinedAt,
      ready: true,
    };
    sender.setState(state);

    // The joiner learns who is already here...
    this.send(sender, {
      t: "welcome",
      self: sender.id,
      roomId: this.room.id,
      peers: this.roster(sender.id),
    });

    // ...and everyone already here learns about the joiner.
    this.broadcast(
      {
        t: "peer-join",
        peer: {
          id: sender.id,
          name: state.name,
          media: state.media,
          joinedAt: state.joinedAt,
        },
      },
      [sender.id],
    );
  }

  /**
   * Relay is deliberately targeted, never broadcast. An SDP offer is meant
   * for exactly one peer; broadcasting it would make every other peer try to
   * answer a negotiation that is not theirs.
   */
  private handleRelay(
    msg: Extract<ClientMessage, { t: "relay" }>,
    sender: Party.Connection<PeerState>,
  ): void {
    const target = this.room.getConnection(msg.to);
    if (!target) {
      // The peer left between the offer being created and sent. The sender's
      // mesh will drop this connection when it receives `peer-leave`.
      this.send(sender, {
        t: "error",
        code: "peer-gone",
        message: "That participant has left the room.",
      });
      return;
    }
    this.send(target, { t: "relay", from: sender.id, data: msg.data });
  }

  onClose(conn: Party.Connection<PeerState>): void {
    this.announceDeparture(conn);
  }

  onError(conn: Party.Connection<PeerState>): void {
    this.announceDeparture(conn);
  }

  private announceDeparture(conn: Party.Connection<PeerState>): void {
    if (!conn.state?.ready) return;
    this.broadcast({ t: "peer-leave", id: conn.id }, [conn.id]);
  }
}

/** Display names are rendered as text everywhere, but bound the length. */
function sanitizeName(raw: string): string {
  const trimmed = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, 32);
  return trimmed.length > 0 ? trimmed : "Guest";
}

/** Party.Connection.close is optional across runtimes; guard it. */
function conn_close(conn: Party.Connection, code: number, reason: string): void {
  try {
    conn.close(code, reason);
  } catch {
    /* already closed */
  }
}
