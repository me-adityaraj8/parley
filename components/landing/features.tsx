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
import { fadeUp, staggerUp } from "@/lib/animations";
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

  useGSAP(
    () => {
      fadeUp("[data-section-head] > *", {
        stagger: 0.08,
        scrollTrigger: { trigger: root.current, start: "top 75%" },
      } as never);

      staggerUp("[data-feature]", {
        y: 32,
        stagger: 0.07,
        scrollTrigger: { trigger: "[data-feature-grid]", start: "top 80%" },
      } as never);

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
        data-feature-grid
        className="mt-14 grid gap-3 sm:grid-cols-3"
      >
        {FEATURES.map((f) => (
          <article
            key={f.title}
            data-feature
            className={cn(
              "group glass relative overflow-hidden rounded-2xl p-6 transition-colors duration-500 hover:border-violet/30",
              f.span,
            )}
          >
            {/* Hover glow follows the card, not the cursor — cheaper, and
                it keeps the effect from feeling gimmicky. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(400px circle at 50% 0%, oklch(0.64 0.191 281 / 12%), transparent 70%)",
              }}
            />
            <f.icon className="size-5 text-violet" aria-hidden />
            <h3 className="mt-4 font-medium tracking-tight">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {f.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
