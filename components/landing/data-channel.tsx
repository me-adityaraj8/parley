"use client";

import { useRef } from "react";
import { FileUp, MessageSquare, PencilRuler, Smile } from "lucide-react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { prefersReducedMotion, revealOnScroll } from "@/lib/animations";

const PAYLOADS = [
  { icon: MessageSquare, label: "Chat", detail: "ordered, reliable" },
  { icon: FileUp, label: "Files", detail: "16 KiB chunks, backpressure-aware" },
  { icon: PencilRuler, label: "Whiteboard", detail: "stroke deltas" },
  { icon: Smile, label: "Reactions", detail: "fire and forget" },
];

/**
 * DATA CHANNEL — the beat after the architecture walkthrough.
 *
 * Not pinned. The architecture section already holds the reader in place,
 * and two pinned sections back to back makes a page feel like it has
 * stopped responding. This one uses depth and stagger instead.
 */
export function DataChannel() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      revealOnScroll("[data-dc-head] > *", { stagger: 0.08, trigger: root.current, start: "top 75%" });

      if (prefersReducedMotion()) {
        gsap.set("[data-dc-card]", { opacity: 1 });
        return;
      }

      // Cards arrive along the connection, from far to near.
      gsap.fromTo(
        "[data-dc-card]",
        { opacity: 0, z: -260, y: 60, rotateX: 22 },
        {
          opacity: 1,
          z: 0,
          y: 0,
          rotateX: 0,
          duration: 0.9,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: { trigger: "[data-dc-grid]", start: "top 80%", once: true },
        },
      );

      // The spine draws itself as the section scrolls past.
      gsap.fromTo(
        "[data-dc-spine]",
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top 65%", end: "bottom 70%", scrub: 0.7 },
        },
      );

      ScrollTrigger.refresh();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="data"
      className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-24 sm:py-32"
      style={{ perspective: "1100px" }}
    >
      <div data-dc-head className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-violet">Data channel</p>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything else rides the same wire.
        </h2>
        <p className="mt-4 text-balance leading-relaxed text-muted-foreground">
          Chat, files, drawings and reactions travel on the very connection
          carrying your video — encrypted the same way, with no server in the
          path. There is nothing else to trust.
        </p>
      </div>

      <div className="relative mt-16">
        <span
          data-dc-spine
          aria-hidden
          className="absolute left-0 right-0 top-1/2 hidden h-px origin-left sm:block"
          style={{
            background:
              "linear-gradient(90deg, transparent, oklch(0.64 0.191 281 / 70%), oklch(0.79 0.142 196 / 70%), transparent)",
          }}
        />

        <div
          data-dc-grid
          className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          style={{ transformStyle: "preserve-3d" }}
        >
          {PAYLOADS.map((p) => (
            <div
              key={p.label}
              data-dc-card
              data-cursor="card"
              className="glass rounded-2xl p-5 text-center"
              style={{ transformStyle: "preserve-3d" }}
            >
              <p.icon className="mx-auto size-5 text-violet" aria-hidden />
              <h3 className="mt-3 text-sm font-medium tracking-tight">{p.label}</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mx-auto mt-10 max-w-xl text-center text-xs leading-relaxed text-muted-foreground">
        Two channels, actually — a control channel for small messages and a
        bulk channel for files and strokes, so a large transfer can never
        delay a chat message.
      </p>
    </section>
  );
}
