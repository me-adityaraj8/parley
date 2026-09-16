"use client";

import { useRef } from "react";
import {
  Lock,
  MessageSquare,
  MonitorUp,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { ScrollTrigger, useGSAP } from "@/lib/gsap";
import { revealOnScroll, useTiltGroup } from "@/lib/animations";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Video,
    title: "Peer-to-peer video",
    body: "Media flows straight from one browser to another over an encrypted DTLS-SRTP channel. No server decodes your call.",
    span: "sm:col-span-2",
  },
  {
    icon: MonitorUp,
    title: "Screen sharing",
    body: "Swap your camera for your screen instantly using track replacement — no reconnection, no dropped frames.",
  },
  {
    icon: MessageSquare,
    title: "Data channel chat",
    body: "Messages ride the same peer connection as your video. There is no chat server to store them.",
  },
  {
    icon: Lock,
    title: "Private rooms",
    body: "Rooms are unguessable 74-bit links that exist only while someone is in them. Nothing is persisted.",
    span: "sm:col-span-2",
  },
  {
    icon: Users,
    title: "Multi-party mesh",
    body: "Everyone connects to everyone. Up to six people, with no central mixer adding latency.",
  },
  {
    icon: Zap,
    title: "One network hop",
    body: "Without a relay in the path, latency is bounded by the distance between you — not by a data centre.",
    span: "sm:col-span-2",
  },
];

export function Features() {
  const root = useRef<HTMLElement>(null);
  // Each card tilts independently; the grid owns the instances.
  /*
   * A long perspective is deliberate. These cards are up to ~1000px wide,
   * and perspective magnifies a layer in proportion to its distance from
   * the card's centre — at 900px the icon at translateZ(60) grew enough to
   * render outside the card. 2200 keeps real depth while holding every
   * layer inside its own bounds.
   */
  const gridRef = useTiltGroup<HTMLDivElement>("[data-feature]", {
    max: 6,
    lift: 12,
    perspective: 2200,
  });

  useGSAP(
    () => {
      revealOnScroll("[data-section-head] > *", {
        stagger: 0.08,
        trigger: root.current,
        start: "top 75%",
      });

      revealOnScroll("[data-feature]", {
        y: 32,
        stagger: 0.07,
        trigger: "[data-feature-grid]",
        start: "top 80%",
      });

      // ScrollTriggers created inside useGSAP are reverted with the context,
      // but a manual refresh avoids stale positions when fonts load late.
      ScrollTrigger.refresh();
    },
    { scope: root },
  );

  return (
    <section
      id="features"
      ref={root}
      className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-24 sm:py-32"
    >
      <div data-section-head className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-violet">
          What you get
        </p>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything a call needs. Nothing that watches it.
        </h2>
        <p className="mt-4 text-balance leading-relaxed text-muted-foreground">
          Parley is built on the browser&rsquo;s own real-time stack, so the
          features below are properties of the architecture rather than things
          bolted on top.
        </p>
      </div>

      <div
        ref={gridRef}
        data-feature-grid
        className="mt-14 grid gap-3 sm:grid-cols-3"
      >
        {FEATURES.map((f) => (
          <article
            key={f.title}
            data-feature
            className={cn(
              "group relative rounded-2xl [transform-style:preserve-3d]",
              f.span,
            )}
          >
            {/*
              The clipped surface is a SEPARATE back plate. Putting
              `overflow-hidden` on the card itself would force
              `transform-style: flat` per spec and silently collapse every
              translateZ below — the depth would stop rendering.
            */}
            <div
              aria-hidden
              data-tilt-layer="-0.35"
              data-tilt-z="-18"
              className="glass absolute inset-0 overflow-hidden rounded-2xl"
            >
              {/* Decorative grid, deepest layer, drifts opposite the content. */}
              <span className="grid-lines absolute inset-0 opacity-[0.18]" />
              {/* Glow expands on hover via transform+opacity — never box-shadow. */}
              <span
                data-tilt-glow
                className="absolute -inset-16 opacity-0"
                style={{
                  background:
                    "radial-gradient(closest-side, oklch(0.64 0.191 281 / 30%), transparent 75%)",
                }}
              />
            </div>

            {/* Border reacts independently so it can brighten without the
                surface having to repaint. */}
            <span
              aria-hidden
              data-tilt-border
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 ring-1 ring-inset ring-violet/45"
            />

            <div className="relative p-6 [transform-style:preserve-3d]">
              <f.icon
                data-tilt-layer="1.6"
                data-tilt-z="60"
                className="size-5 text-violet"
                aria-hidden
              />
              <h3
                data-tilt-layer="1"
                data-tilt-z="40"
                className="mt-4 font-medium tracking-tight"
              >
                {f.title}
              </h3>
              <p
                data-tilt-layer="0.4"
                data-tilt-z="20"
                className="mt-2 text-sm leading-relaxed text-muted-foreground"
              >
                {f.body}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
