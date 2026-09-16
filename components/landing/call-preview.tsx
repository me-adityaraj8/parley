"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, MonitorUp, MessageSquare, PhoneOff, Video } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { createTilt, prefersReducedMotion } from "@/lib/animations";
import { cn } from "@/lib/utils";

const PEOPLE = [
  { name: "Ada", hue: 281, speaking: true, muted: false },
  { name: "Grace", hue: 196, speaking: false, muted: false },
  { name: "Alan", hue: 320, speaking: false, muted: true },
  { name: "Katherine", hue: 240, speaking: false, muted: false },
];

/**
 * A stylised, non-functional mock of the call UI for the hero.
 *
 * Deliberately NOT a real call: the landing page must not request camera
 * permission on load. The animation cycles an "active speaker" so the
 * product's most distinctive interaction is visible before you sign in.
 */
export function CallPreview() {
  const root = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  // Cursor tilt on top of the ambient drift. The drift animates rotateX/Y
  // on the same element, so tilt is attached to a wrapper instead of
  // fighting it for the transform.
  useEffect(() => {
    if (!tiltRef.current) return;
    return createTilt(tiltRef.current, { max: 5, lift: 18, scale: 1.005, ease: 0.65 });
  }, []);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const tiles = gsap.utils.toArray<HTMLElement>("[data-preview-tile]");
      if (tiles.length === 0) return;

      // Rotate the speaking ring through the participants on a loop.
      const tl = gsap.timeline({ repeat: -1 });
      tiles.forEach((tile, i) => {
        const ring = tile.querySelector("[data-ring]");
        const bars = tile.querySelectorAll("[data-bar]");
        tl.to(ring, { opacity: 1, duration: 0.4 }, i * 2.2)
          .to(bars, { scaleY: () => gsap.utils.random(0.4, 1), duration: 0.18, stagger: { each: 0.05, repeat: 7, yoyo: true } }, i * 2.2)
          .to(ring, { opacity: 0, duration: 0.4 }, i * 2.2 + 1.8)
          .to(bars, { scaleY: 0.25, duration: 0.3 }, i * 2.2 + 1.8);
      });

      // Slow ambient tilt so the mock never feels like a static image.
      gsap.to(root.current, {
        rotateX: 1.6,
        rotateY: -1.6,
        duration: 7,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    },
    { scope: root },
  );

  return (
    <div ref={tiltRef} className="rounded-3xl">
      <div
        ref={root}
        aria-hidden
        className="glass-strong rounded-3xl p-2.5 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
        style={{ perspective: 1200 }}
      >
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="size-2 rounded-full bg-live" />
        <span className="font-mono text-[11px] text-muted-foreground">
          k4mq-7rtz-9wfx
        </span>
        <span className="ml-auto rounded-full bg-live/15 px-2 py-0.5 text-[10px] text-live">
          Connected peer-to-peer
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {PEOPLE.map((p) => (
          <div
            key={p.name}
            data-preview-tile
            className="relative aspect-video overflow-hidden rounded-2xl border border-hairline bevel"
            style={{
              background: `linear-gradient(150deg, oklch(0.32 0.11 ${p.hue}), oklch(0.18 0.05 ${p.hue}))`,
            }}
          >
            <div
              className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-medium text-white/90"
              style={{
                background: `linear-gradient(145deg, oklch(0.6 0.16 ${p.hue}), oklch(0.4 0.12 ${p.hue}))`,
              }}
            >
              {p.name.slice(0, 2).toUpperCase()}
            </div>

            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/60 to-transparent px-2.5 py-2">
              <span className="text-[11px] font-medium text-white/90">{p.name}</span>
              <div className="ml-auto flex items-end gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    data-bar
                    className="h-2.5 w-0.5 origin-bottom rounded-full bg-live"
                    style={{ transform: "scaleY(0.25)" }}
                  />
                ))}
              </div>
              {p.muted ? (
                <MicOff className="size-3 text-danger" />
              ) : (
                <Mic className="size-3 text-white/70" />
              )}
            </div>

            <div
              data-ring
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 ring-2 ring-inset ring-live/80"
            />
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-center gap-1.5 py-1">
        {[Mic, Video, MonitorUp, MessageSquare].map((Icon, i) => (
          <span
            key={i}
            className="flex size-8 items-center justify-center rounded-full bg-white/5 text-muted-foreground"
          >
            <Icon className="size-3.5" />
          </span>
        ))}
        <span className={cn("flex size-8 items-center justify-center rounded-full bg-danger/90 text-white")}>
          <PhoneOff className="size-3.5" />
        </span>
        </div>
      </div>
    </div>
  );
}
