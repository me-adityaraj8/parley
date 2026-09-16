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

      /*
       * Each reaction gets its own curved path rather than a straight rise,
       * so a burst of the same emoji fans out instead of stacking into a
       * column. The curve is built as a bezier through three randomised
       * control points and handed to MotionPath.
       */
      const side = Math.random() < 0.5 ? -1 : 1;
      const sway = gsap.utils.random(40, 95) * side;
      const path = [
        { x: 0, y: 0 },
        { x: sway * 0.55, y: -70 },
        { x: sway * 0.15, y: -145 },
        { x: sway, y: -215 },
      ];

      const spin = gsap.utils.random(-30, 30) * side;
      const tiltY = gsap.utils.random(-45, 45);

      gsap.set(el, { transformPerspective: 600, transformStyle: "preserve-3d" });

      gsap
        .timeline()
        // Pop toward the viewer as it appears.
        .fromTo(
          el,
          { opacity: 0, scale: 0.35, z: -120, rotateY: tiltY, rotate: 0 },
          {
            opacity: 1,
            scale: 1.18,
            z: 60,
            rotateY: 0,
            duration: 0.34,
            ease: "back.out(2.4)",
          },
        )
        .to(el, { scale: 1, z: 0, duration: 0.22, ease: "power2.out" })
        // Then ride the curve, drifting back in Z as it rises away.
        .to(
          el,
          {
            duration: 2.2,
            ease: "power1.out",
            motionPath: { path, curviness: 1.25, autoRotate: false },
          },
          0.12,
        )
        .to(el, { rotate: spin, rotateY: tiltY * 0.6, z: -90, scale: 0.78, duration: 2.2, ease: "power1.out" }, 0.12)
        .to(el, { opacity: 0, duration: 0.75, ease: "power2.in" }, 1.65);
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
