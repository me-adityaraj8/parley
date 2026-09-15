/**
 * PARLEY SIGNALING — Durable Object (one instance per room)
 *
 * This is a direct port of the PartyKit server. PartyKit itself runs on
 * Cloudflare Workers + Durable Objects, so moving to the platform directly
 * removes a dependency without changing the protocol or the client.
 *
 * It still does exactly one job: forward small JSON messages so two browsers
 * can find each other. It never sees a video frame or an audio sample.
 */

import type {
  ClientMessage,
  MediaFlags,
  RosterEntry,
  ServerMessage,
} from "../types/signaling";
import { ROOM_CAPACITY } from "../types/signaling";

interface PeerState {
  id: string;
  /**
   * The room this socket belongs to. Stored per-socket rather than on the
   * object, because hibernation can destroy and rebuild the instance while
   * sockets stay open — any plain instance field would come back empty.
   */
  roomId: string;
  name: string;
  media: MediaFlags;
  joinedAt: number;
  /** A socket that has not sent `join` yet is not part of the roster. */
  ready: boolean;
}

const DEFAULT_MEDIA: MediaFlags = { audio: true, video: true, screen: false };

export class RoomDurableObject implements DurableObject {
  constructor(private state: DurableObjectState) {}

  // --------------------------------------------------------------- upgrade

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    const url = new URL(request.url);
    // PartySocket supplies a stable connection id as `_pk`; fall back to our
    // own so the endpoint works with a plain WebSocket client too.
    const id = url.searchParams.get("_pk") ?? crypto.randomUUID();

    /**
     * Hibernation: the runtime may evict this object while sockets stay
     * open, then rebuild it on the next message. State therefore lives in
     * the socket attachment rather than on `this`, so nothing is lost.
     */
    this.state.acceptWebSocket(server, [id]);
    this.setState(server, {
      id,
      roomId: url.searchParams.get("_room") ?? url.pathname.split("/").pop() ?? "",
      name: "Guest",
      media: { ...DEFAULT_MEDIA },
      joinedAt: Date.now(),
      ready: false,
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  // --------------------------------------------------------------- helpers

  private getState(ws: WebSocket): PeerState | null {
    try {
      return (ws.deserializeAttachment() as PeerState | null) ?? null;
    } catch {
      return null;
    }
  }

  private setState(ws: WebSocket, state: PeerState): void {
    ws.serializeAttachment(state);
  }

  private sockets(): WebSocket[] {
    return this.state.getWebSockets();
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Socket closed between our check and this send; webSocketClose will
      // clean up the roster.
    }
  }

  private broadcast(msg: ServerMessage, exceptId?: string): void {
    for (const ws of this.sockets()) {
      const s = this.getState(ws);
      if (!s || !s.ready || s.id === exceptId) continue;
      this.send(ws, msg);
    }
  }

  private roster(exceptId?: string): RosterEntry[] {
    const entries: RosterEntry[] = [];
    for (const ws of this.sockets()) {
      const s = this.getState(ws);
      if (!s?.ready || s.id === exceptId) continue;
      entries.push({ id: s.id, name: s.name, media: s.media, joinedAt: s.joinedAt });
    }
    // Deterministic order so every client derives the same peer ordering.
    return entries.sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
  }

  private readyCount(): number {
    let n = 0;
    for (const ws of this.sockets()) if (this.getState(ws)?.ready) n++;
    return n;
  }

  private socketFor(id: string): WebSocket | null {
    for (const ws of this.sockets()) {
      if (this.getState(ws)?.id === id) return ws;
    }
    return null;
  }

  // -------------------------------------------------------------- messages

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string") return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send(ws, { t: "error", code: "bad-json", message: "Message was not valid JSON." });
      return;
    }

    const state = this.getState(ws);
    if (!state) return;

    switch (msg.t) {
      case "join": {
        // Re-sending `join` on the same socket is a resync after a reconnect,
        // not a second participant.
        if (!state.ready && this.readyCount() >= ROOM_CAPACITY) {
          this.send(ws, { t: "room-full", limit: ROOM_CAPACITY });
          // A custom close code so the client does not auto-reconnect into
          // a room it cannot enter.
          try {
            ws.close(4001, "room-full");
          } catch {
            /* already closed */
          }
          return;
        }

        const next: PeerState = {
          ...state,
          name: sanitizeName(msg.name),
          media: msg.media ?? { ...DEFAULT_MEDIA },
          ready: true,
        };
        this.setState(ws, next);

        this.send(ws, {
          t: "welcome",
          self: next.id,
          roomId: next.roomId,
          peers: this.roster(next.id),
        });

        this.broadcast(
          {
            t: "peer-join",
            peer: {
              id: next.id,
              name: next.name,
              media: next.media,
              joinedAt: next.joinedAt,
            },
          },
          next.id,
        );
        return;
      }

      /**
       * Relay is targeted, never broadcast. An SDP offer is meant for exactly
       * one peer; broadcasting would make every other peer try to answer a
       * negotiation that is not theirs.
       */
      case "relay": {
        const target = this.socketFor(msg.to);
        if (!target) {
          this.send(ws, {
            t: "error",
            code: "peer-gone",
            message: "That participant has left the room.",
          });
          return;
        }
        this.send(target, { t: "relay", from: state.id, data: msg.data });
        return;
      }

      case "media": {
        this.setState(ws, { ...state, media: msg.media });
        if (state.ready) this.broadcast({ t: "media", id: state.id, media: msg.media }, state.id);
        return;
      }

      case "rename": {
        const name = sanitizeName(msg.name);
        this.setState(ws, { ...state, name });
        if (state.ready) this.broadcast({ t: "rename", id: state.id, name }, state.id);
        return;
      }

      default:
        this.send(ws, {
          t: "error",
          code: "unknown-type",
          message: "Unrecognised message type.",
        });
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.announceDeparture(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.announceDeparture(ws);
  }

  private announceDeparture(ws: WebSocket): void {
    const state = this.getState(ws);
    if (!state?.ready) return;
    this.broadcast({ t: "peer-leave", id: state.id }, state.id);
  }
}

/** Display names are rendered as text everywhere, but bound the length. */
function sanitizeName(raw: string): string {
  const trimmed = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, 32);
  return trimmed.length > 0 ? trimmed : "Guest";
}
