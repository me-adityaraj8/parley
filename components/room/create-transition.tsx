"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/animations";

/**
 * The room-creation transition.
 *
 * Budget: ~950ms end to end, and `router.push` is fired at ~600ms — while
 * the zoom is still playing. The route therefore starts fetching under the
 * animation rather than after it, so the cinematic beat costs the user
 * almost no real time.
 *
 * The room ID is generated before this mounts, so what the user watches
 * assemble is the actual ID they are about to join.
 */
export function CreateTransition({
  roomId,
  origin,
  onNavigate,
}: {
  roomId: string;
  /** Viewport coords of the button that started this, so the ring grows from it. */
  origin: { x: number; y: number } | null;
  onNavigate: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const navigated = useRef(false);

  useEffect(() => {
    const go = () => {
      if (navigated.current) return;
      navigated.current = true;
      onNavigate();
    };

    if (prefersReducedMotion() || !root.current) {
      go();
      return;
    }

    const ctx = gsap.context(() => {
      const ox = origin?.x ?? window.innerWidth / 2;
      const oy = origin?.y ?? window.innerHeight / 2;

      gsap.set("[data-ct-ring]", { x: ox, y: oy, xPercent: -50, yPercent: -50 });
      gsap.set("[data-ct-stage]", { perspective: 900 });

      const tl = gsap.timeline({ onComplete: go });

      // 1 — the button's glow expands into a ring that fills the screen.
      tl.fromTo(
        "[data-ct-veil]",
        { opacity: 0 },
        { opacity: 1, duration: 0.18, ease: "power2.out" },
        0,
      )
        .fromTo(
          "[data-ct-ring]",
          { scale: 0.05, opacity: 0.9 },
          { scale: 14, opacity: 0, duration: 0.6, ease: "power2.out" },
          0,
        )
        // 2 — the ID assembles out of scattered glyphs.
        .fromTo(
          "[data-ct-char]",
          {
            opacity: 0,
            z: () => gsap.utils.random(-320, 320),
            x: () => gsap.utils.random(-140, 140),
            y: () => gsap.utils.random(-90, 90),
            rotateY: () => gsap.utils.random(-120, 120),
            scale: 0.3,
          },
          {
            opacity: 1,
            z: 0,
            x: 0,
            y: 0,
            rotateY: 0,
            scale: 1,
            duration: 0.42,
            ease: "power3.out",
            stagger: { each: 0.022, from: "center" },
          },
          0.16,
        )
        .fromTo(
          "[data-ct-label]",
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
          0.24,
        )
        // 3 — the camera flies through the ID.
        .to(
          "[data-ct-stage]",
          { z: 620, scale: 1.35, opacity: 0, duration: 0.36, ease: "power2.in" },
          0.6,
        )
        .to("[data-ct-veil]", { opacity: 0, duration: 0.24, ease: "power1.in" }, 0.72);

      // Navigate mid-flight so the route loads under the animation.
      tl.call(go, undefined, 0.6);
    }, root);

    // Hard safety net: never let a stuck animation trap the user.
    const failsafe = window.setTimeout(go, 1400);

    return () => {
      window.clearTimeout(failsafe);
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (prefersReducedMotion()) return null;

  return (
    <div
      ref={root}
      aria-hidden
      data-create-transition
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
    >
      <div data-ct-veil className="absolute inset-0 bg-void/92 opacity-0 backdrop-blur-sm" />

      <span
        data-ct-ring
        className="absolute size-40 rounded-full border-2 border-violet/70"
        style={{ boxShadow: "0 0 60px 10px oklch(0.64 0.191 281 / 45%)" }}
      />

      <div
        data-ct-stage
        className="relative flex flex-col items-center"
        style={{ transformStyle: "preserve-3d" }}
      >
        <p
          data-ct-label
          className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground opacity-0"
        >
          Room
        </p>
        <div className="mt-3 flex" style={{ transformStyle: "preserve-3d" }}>
          {roomId.split("").map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              data-ct-char
              className="font-mono text-3xl font-semibold tracking-tight text-foreground opacity-0 sm:text-5xl"
              style={{ transformStyle: "preserve-3d" }}
            >
              {ch === "-" ? <span className="px-1 text-violet">–</span> : ch}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
