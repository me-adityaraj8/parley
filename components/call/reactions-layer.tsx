"use client";

import { useEffect, useRef } from "react";
import type { FloatingReaction } from "@/types";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/animations";

/**
 * Renders floating reaction emoji.
 *
 * Each emoji is animated once on mount with GSAP and then left alone; the
 * hook removes it from state after its lifetime. Animating `transform` and
 * `opacity` only keeps this entirely on the compositor, so it cannot steal
 * frames from video decoding.
 */
export function ReactionsLayer({ reactions }: { reactions: FloatingReaction[] }) {
  const root = useRef<HTMLDivElement>(null);
  const animated = useRef(new Set<string>());

  useEffect(() => {
    if (!root.current) return;
    const reduced = prefersReducedMotion();

    for (const r of reactions) {
      if (animated.current.has(r.key)) continue;
      animated.current.add(r.key);

      const el = root.current.querySelector<HTMLElement>(`[data-reaction="${r.key}"]`);
      if (!el) continue;

      if (reduced) {
        gsap.set(el, { opacity: 1 });
        continue;
      }

      // Slight horizontal drift so a burst of the same emoji does not stack
      // into a single column.
      const drift = gsap.utils.random(-50, 50);
      const spin = gsap.utils.random(-22, 22);

      gsap
        .timeline()
        .fromTo(
          el,
          { opacity: 0, scale: 0.4, y: 0, x: 0, rotate: 0 },
          { opacity: 1, scale: 1.15, duration: 0.32, ease: "back.out(2.2)" },
        )
        .to(el, { scale: 1, duration: 0.18, ease: "power2.out" })
        .to(
          el,
          { y: -170, x: drift, rotate: spin, duration: 2.3, ease: "power1.out" },
          0.1,
        )
        .to(el, { opacity: 0, duration: 0.7, ease: "power2.in" }, 1.7);
    }

    // Stop the set growing without bound over a long call.
    if (animated.current.size > 200) {
      const live = new Set(reactions.map((r) => r.key));
      for (const k of animated.current) if (!live.has(k)) animated.current.delete(k);
    }
  }, [reactions]);

  return (
    <div
      ref={root}
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-24 z-40 flex justify-center"
    >
      <div className="relative h-0 w-full max-w-lg">
        {reactions.map((r) => (
          <div
            key={r.key}
            data-reaction={r.key}
            className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center opacity-0"
          >
            <span className="text-4xl drop-shadow-lg" aria-hidden>
              {r.emoji}
            </span>
            <span className="mt-0.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
              {r.peerName}
            </span>
            <span className="sr-only">{r.peerName} reacted {r.emoji}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
