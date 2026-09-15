"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DataMessage,
  LinkState,
  MediaFlags,
  Participant,
  PeerId,
  RosterEntry,
  ServerMessage,
} from "@/types";
import { PeerLink } from "@/lib/webrtc/peer";
import { useSignaling } from "./useSignaling";

interface UseWebRTCOptions {
  roomId: string;
  displayName: string;
  localStream: MediaStream | null;
  localFlags: MediaFlags;
  /** False until the user leaves the lobby and commits to joining. */
  enabled: boolean;
  onData?: (from: PeerId, name: string, msg: DataMessage) => void;
}

interface RemotePeerView {
  id: PeerId;
  name: string;
  media: MediaFlags;
  link: LinkState;
  stream: MediaStream | null;
}

/**
 * The mesh.
 *
 * TOPOLOGY: every participant holds a direct connection to every other
 * participant. With N people each browser maintains N-1 peer connections
 * and uploads its own video N-1 times.
 *
 *      A ───── B          3 people → 3 connections
 *       \     /           4 people → 6 connections
 *        \   /            6 people → 15 connections
 *          C
 *
 * The advantage is that there is no media server: latency is as low as the
 * network allows and nothing decrypts your call in transit. The cost is
 * upload bandwidth, which is why ROOM_CAPACITY is 6. Scaling past that needs
 * an SFU, which is a fundamentally different (and server-heavy) architecture.
 */
export function useWebRTC({
  roomId,
  displayName,
  localStream,
  localFlags,
  enabled,
  onData,
}: UseWebRTCOptions) {
  const [peers, setPeers] = useState<Record<PeerId, RemotePeerView>>({});
  const [roomFull, setRoomFull] = useState(false);

  const linksRef = useRef(new Map<PeerId, PeerLink>());
  const selfIdRef = useRef<PeerId | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const onDataRef = useRef(onData);
  const sendRef = useRef<((msg: never) => void) | null>(null);
  onDataRef.current = onData;
  localStreamRef.current = localStream;

  // ------------------------------------------------------------ mutations

  const patchPeer = useCallback((id: PeerId, patch: Partial<RemotePeerView>) => {
    setPeers((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, ...patch } };
    });
  }, []);

  const dropPeer = useCallback((id: PeerId) => {
    linksRef.current.get(id)?.close();
    linksRef.current.delete(id);
    setPeers((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  /** Creates (or returns) the single PeerLink for a remote participant. */
  const ensureLink = useCallback(
    (entry: RosterEntry): PeerLink | null => {
      const selfId = selfIdRef.current;
      if (!selfId) return null;

      const existing = linksRef.current.get(entry.id);
      if (existing) return existing;

      const link = new PeerLink({
        selfId,
        remoteId: entry.id,
        signal: (payload) => {
          sendRef.current?.({ t: "relay", to: entry.id, data: payload } as never);
        },
        onStream: (stream) => patchPeer(entry.id, { stream }),
        onState: (state) => patchPeer(entry.id, { link: state }),
        onData: (msg) => {
          // Media flags and identity arrive over the data channel as well as
          // via signaling — the peer-to-peer path is faster and keeps working
          // if the signaling socket drops mid-call.
          if (msg.t === "media") {
            patchPeer(entry.id, { media: msg.media });
            return;
          }
          if (msg.t === "identity") {
            patchPeer(entry.id, { name: msg.name });
            return;
          }
          onDataRef.current?.(entry.id, entry.name, msg);
        },
      });

      linksRef.current.set(entry.id, link);
      setPeers((prev) => ({
        ...prev,
        [entry.id]: {
          id: entry.id,
          name: entry.name,
          media: entry.media,
          link: "new",
          stream: null,
        },
      }));

      // Attaching tracks fires onnegotiationneeded, which starts the
      // offer/answer handshake. Both sides do this; perfect negotiation
      // resolves the resulting collision.
      const stream = localStreamRef.current;
      if (stream) link.addLocalStream(stream);

      // Announce ourselves over the data channel as soon as it opens.
      link.onDataOpen(() => {
        link.sendData({ t: "identity", name: displayNameRef.current });
        link.sendData({ t: "media", media: flagsRef.current });
      });

      return link;
    },
    [patchPeer],
  );

  // Latest-value refs for things read inside long-lived callbacks.
  const displayNameRef = useRef(displayName);
  const flagsRef = useRef(localFlags);
  displayNameRef.current = displayName;
  flagsRef.current = localFlags;

  // ------------------------------------------------------- signaling wiring

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.t) {
        case "welcome": {
          selfIdRef.current = msg.self;
          // Connect to everyone already in the room.
          for (const peer of msg.peers) ensureLink(peer);
          return;
        }

        case "peer-join": {
          ensureLink(msg.peer);
          return;
        }

        case "peer-leave": {
          dropPeer(msg.id);
          return;
        }

        case "relay": {
          const link = linksRef.current.get(msg.from);
          if (!link) return;
          if (msg.data.k === "description") {
            void link.acceptDescription(msg.data.sdp);
          } else {
            void link.acceptCandidate(msg.data.candidate);
          }
          return;
        }

        case "media":
          patchPeer(msg.id, { media: msg.media });
          return;

        case "rename":
          patchPeer(msg.id, { name: msg.name });
          return;

        case "room-full":
          setRoomFull(true);
          return;

        case "error":
        default:
          return;
      }
    },
    [ensureLink, dropPeer, patchPeer],
  );

  const signaling = useSignaling({
    roomId,
    name: displayName,
    media: localFlags,
    enabled,
    onMessage: handleMessage,
  });

  sendRef.current = signaling.send as unknown as (msg: never) => void;

  // ------------------------------------------------------- reactive effects

  // Local stream arrives after the peer links (the user may join before the
  // camera is ready), so attach it to every existing link when it appears.
  useEffect(() => {
    if (!localStream) return;
    for (const link of linksRef.current.values()) link.addLocalStream(localStream);
  }, [localStream]);

  // Mute/camera changes go out on BOTH channels: signaling reaches peers we
  // have not finished connecting to, the data channel reaches the rest fast.
  useEffect(() => {
    if (!enabled) return;
    signaling.send({ t: "media", media: localFlags });
    for (const link of linksRef.current.values()) {
      link.sendData({ t: "media", media: localFlags });
    }
  }, [localFlags, enabled, signaling]);

  // Tear the whole mesh down on unmount. Without this, peer connections
  // survive navigation and keep uploading video from a page you have left.
  useEffect(() => {
    const links = linksRef.current;
    return () => {
      for (const link of links.values()) link.close();
      links.clear();
    };
  }, []);

  // ------------------------------------------------------------- actions

  /** Swaps the outgoing video track on every peer (screen share). */
  const replaceVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    await Promise.all(
      Array.from(linksRef.current.values()).map((l) => l.replaceTrack("video", track)),
    );
  }, []);

  /** Sends a data-channel message to every connected peer. */
  const broadcast = useCallback((msg: DataMessage): number => {
    let delivered = 0;
    for (const link of linksRef.current.values()) {
      if (link.sendData(msg)) delivered++;
    }
    return delivered;
  }, []);

  const participants = useMemo<Participant[]>(
    () =>
      Object.values(peers).map((p) => ({
        id: p.id,
        name: p.name,
        isLocal: false,
        stream: p.stream,
        media: p.media,
        link: p.link,
        speaking: false,
      })),
    [peers],
  );

  return {
    selfId: signaling.selfId,
    signalingStatus: signaling.status,
    participants,
    roomFull,
    broadcast,
    replaceVideoTrack,
    send: signaling.send,
  };
}
