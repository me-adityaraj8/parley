"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DataMessage, FloatingReaction, PeerId } from "@/types";

/** How long a reaction stays on screen before it is removed from the DOM. */
const LIFETIME_MS = 3200;

/**
 * Ephemeral emoji reactions, sent peer-to-peer.
 *
 * Nothing is stored — a reaction exists only as a DOM node for ~3 seconds.
 * Each gets a unique key so GSAP can animate them independently even when
 * several of the same emoji are in flight.
 */
export function useReactions({
  selfId,
  selfName,
  broadcast,
}: {
  selfId: PeerId | null;
  selfName: string;
  broadcast: (msg: DataMessage) => number;
}) {
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const timers = useRef(new Set<number>());

  const spawn = useCallback((emoji: string, peerId: PeerId, peerName: string) => {
    const key = `${peerId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFloating((prev) => [...prev.slice(-24), { key, emoji, peerId, peerName }]);

    const timer = window.setTimeout(() => {
      setFloating((prev) => prev.filter((r) => r.key !== key));
      timers.current.delete(timer);
    }, LIFETIME_MS);
    timers.current.add(timer);
  }, []);

  const react = useCallback(
    (emoji: string) => {
      if (!selfId) return;
      spawn(emoji, selfId, selfName);
      broadcast({ t: "reaction", emoji, at: Date.now() });
    },
    [selfId, selfName, spawn, broadcast],
  );

  const receive = useCallback(
    (from: PeerId, name: string, emoji: string) => spawn(emoji, from, name),
    [spawn],
  );

  // Timers must be cleared or a leave-mid-animation leaks them.
  useEffect(() => {
    const set = timers.current;
    return () => {
      for (const t of set) window.clearTimeout(t);
      set.clear();
    };
  }, []);

  return { floating, react, receive };
}
