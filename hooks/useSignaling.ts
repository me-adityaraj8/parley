"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type PartySocket from "partysocket";
import type { ClientMessage, MediaFlags, ServerMessage } from "@/types";
import type { SignalingState } from "@/types";
import {
  createSignalingSocket,
  parseServerMessage,
  sendSignal,
} from "@/lib/signaling/client";

interface UseSignalingOptions {
  roomId: string;
  name: string;
  media: MediaFlags;
  /** Gate connection until the user has actually chosen to join. */
  enabled: boolean;
  onMessage: (msg: ServerMessage) => void;
}

interface UseSignalingResult {
  status: SignalingState;
  selfId: string | null;
  send: (msg: ClientMessage) => void;
}

/**
 * Owns the WebSocket to the signaling server.
 *
 * The socket is created once per room and deliberately NOT recreated when
 * `name` or `media` change — those are sent as messages instead. Recreating
 * the socket would look like a leave + rejoin to every other participant and
 * would tear down every peer connection.
 */
export function useSignaling({
  roomId,
  name,
  media,
  enabled,
  onMessage,
}: UseSignalingOptions): UseSignalingResult {
  const [status, setStatus] = useState<SignalingState>("idle");
  const [selfId, setSelfId] = useState<string | null>(null);
  const socketRef = useRef<PartySocket | null>(null);

  // Latest-value refs: these change often, and closing over them directly
  // would force the effect (and therefore the socket) to be torn down.
  const onMessageRef = useRef(onMessage);
  const nameRef = useRef(name);
  const mediaRef = useRef(media);
  onMessageRef.current = onMessage;
  nameRef.current = name;
  mediaRef.current = media;

  useEffect(() => {
    if (!enabled || !roomId) return;

    const socket = createSignalingSocket(roomId);
    socketRef.current = socket;
    setStatus("connecting");

    const handleOpen = () => {
      setStatus("open");
      // Sent on every open, including reconnects. The server treats a repeat
      // join on the same socket as a resync rather than a new participant.
      sendSignal(socket, {
        t: "join",
        name: nameRef.current,
        media: mediaRef.current,
      });
    };

    const handleMessage = (event: MessageEvent<unknown>) => {
      const msg = parseServerMessage(event.data);
      if (!msg) return;
      if (msg.t === "welcome") setSelfId(msg.self);
      onMessageRef.current(msg);
    };

    const handleClose = (event: CloseEvent) => {
      // 4001 is our own "room full" code — a deliberate rejection, so we must
      // not present it as a transient network problem.
      setStatus(event.code === 4001 ? "closed" : "reconnecting");
    };

    const handleError = () => setStatus("error");

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);

    socket.reconnect();

    return () => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("error", handleError);
      socket.close();
      socketRef.current = null;
      setStatus("closed");
      setSelfId(null);
    };
  }, [roomId, enabled]);

  const send = useCallback((msg: ClientMessage) => {
    const socket = socketRef.current;
    if (socket) sendSignal(socket, msg);
  }, []);

  return { status, selfId, send };
}
