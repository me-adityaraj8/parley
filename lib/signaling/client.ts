"use client";

import PartySocket from "partysocket";
import type { ClientMessage, ServerMessage } from "@/types";
import { isServerMessage } from "@/types";

export const PARTYKIT_HOST =
  process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999";

/**
 * Thin typed wrapper over PartySocket.
 *
 * PartySocket gives us automatic reconnection with exponential backoff,
 * which matters because a signaling drop must not end a call: peers that are
 * already connected keep talking directly, and the socket quietly comes back
 * so that new participants can still be negotiated.
 */
export function createSignalingSocket(roomId: string): PartySocket {
  return new PartySocket({
    host: PARTYKIT_HOST,
    party: "main",
    room: roomId,
    // Do not connect on construction — the caller wires listeners first so
    // it cannot miss the `welcome` message.
    startClosed: true,
    maxRetries: 12,
  });
}

export function sendSignal(socket: PartySocket, msg: ClientMessage): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(msg));
}

export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isServerMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
