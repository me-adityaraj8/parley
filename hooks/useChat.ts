"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatMessage, DataMessage, PeerId } from "@/types";
import { messageId } from "@/lib/room";

interface UseChatOptions {
  selfId: PeerId | null;
  selfName: string;
  broadcast: (msg: DataMessage) => number;
}

const MAX_BODY = 2000;

/**
 * Chat over WebRTC data channels.
 *
 * There is no chat server. Messages travel on the SAME peer connection as
 * audio and video, encrypted with DTLS, directly to each participant. In a
 * mesh that means sending a message is a fan-out: one copy per peer.
 *
 * The consequence — and it is a real product trade-off — is that there is no
 * history. A participant who joins later cannot receive messages sent before
 * they arrived, because nothing stored them. That is inherent to true P2P
 * chat, not a missing feature.
 */
export function useChat({ selfId, selfName, broadcast }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [typingPeers, setTypingPeers] = useState<Record<PeerId, string>>({});

  const openRef = useRef(false);
  const typingTimers = useRef(new Map<PeerId, number>());
  const lastTypingSent = useRef(0);

  /** Called by the panel so we know whether to count messages as unread. */
  const setPanelOpen = useCallback((open: boolean) => {
    openRef.current = open;
    if (open) setUnread(0);
  }, []);

  const send = useCallback(
    (raw: string, replyTo?: string): boolean => {
      const body = raw.trim().slice(0, MAX_BODY);
      if (!body || !selfId) return false;

      const msg: ChatMessage = {
        id: messageId(),
        authorId: selfId,
        authorName: selfName,
        body,
        at: Date.now(),
        mine: true,
        ...(replyTo ? { replyTo } : {}),
      };

      const delivered = broadcast({ t: "chat", id: msg.id, body, at: msg.at, replyTo });

      // Optimistic append, flagged if nobody received it. Being honest about
      // undelivered messages matters more in P2P than in a server chat,
      // where the server would have accepted it regardless.
      setMessages((prev) => [...prev, { ...msg, failed: delivered === 0 }]);
      return delivered > 0;
    },
    [selfId, selfName, broadcast],
  );

  const sendTyping = useCallback(
    (on: boolean) => {
      const now = Date.now();
      // Throttle: typing pings would otherwise fire on every keystroke.
      if (on && now - lastTypingSent.current < 1800) return;
      lastTypingSent.current = now;
      broadcast({ t: "typing", on });
    },
    [broadcast],
  );

  /** Toggle an emoji on a message. Reactions are per-peer, so they merge. */
  const applyReaction = useCallback(
    (messageIdValue: string, emoji: string, peerId: PeerId, on: boolean) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageIdValue) return m;
          const reactions = { ...(m.reactions ?? {}) };
          const list = new Set(reactions[emoji] ?? []);
          if (on) list.add(peerId);
          else list.delete(peerId);
          if (list.size === 0) delete reactions[emoji];
          else reactions[emoji] = [...list];
          return { ...m, reactions };
        }),
      );
    },
    [],
  );

  const toggleReaction = useCallback(
    (messageIdValue: string, emoji: string) => {
      if (!selfId) return;
      let on = true;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageIdValue) return m;
          on = !(m.reactions?.[emoji] ?? []).includes(selfId);
          return m;
        }),
      );
      applyReaction(messageIdValue, emoji, selfId, on);
      broadcast({ t: "chat-react", id: messageIdValue, emoji, on });
    },
    [selfId, applyReaction, broadcast],
  );

  /**
   * System notices are generated LOCALLY from roster events. No peer sends
   * them, so a remote participant cannot forge "Ada left".
   */
  const systemNotice = useCallback((body: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: messageId(),
        authorId: "system",
        authorName: "System",
        body,
        at: Date.now(),
        mine: false,
        system: true,
      },
    ]);
  }, []);

  /** Wire this into useWebRTC's onData. */
  const receive = useCallback(
    (from: PeerId, name: string, msg: DataMessage) => {
      if (msg.t === "chat") {
        setMessages((prev) => {
          // Dedupe: in a mesh the same id can arrive more than once if a
          // peer retransmits after a channel reopen.
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [
            ...prev,
            {
              id: msg.id,
              authorId: from,
              authorName: name,
              body: msg.body,
              at: msg.at,
              mine: false,
              ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
            },
          ];
        });
        if (!openRef.current) setUnread((n) => n + 1);

        // A message implies they stopped typing.
        setTypingPeers((prev) => {
          if (!(from in prev)) return prev;
          const next = { ...prev };
          delete next[from];
          return next;
        });
        return;
      }

      if (msg.t === "chat-react") {
        applyReaction(msg.id, msg.emoji, from, msg.on);
        return;
      }

      if (msg.t === "typing") {
        window.clearTimeout(typingTimers.current.get(from));
        if (!msg.on) {
          setTypingPeers((prev) => {
            const next = { ...prev };
            delete next[from];
            return next;
          });
          return;
        }
        setTypingPeers((prev) => ({ ...prev, [from]: name }));
        // Self-expiring: if the peer drops mid-typing we must not leave a
        // permanent "Ada is typing…".
        const timer = window.setTimeout(() => {
          setTypingPeers((prev) => {
            const next = { ...prev };
            delete next[from];
            return next;
          });
        }, 4000);
        typingTimers.current.set(from, timer);
      }
    },
    [applyReaction],
  );

  const clearPeer = useCallback((id: PeerId) => {
    setTypingPeers((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  return {
    messages,
    unread,
    typingPeers: Object.values(typingPeers),
    send,
    sendTyping,
    receive,
    toggleReaction,
    systemNotice,
    setPanelOpen,
    clearPeer,
  };
}
