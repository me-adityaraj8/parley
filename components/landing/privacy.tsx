"use client";

import { useRef } from "react";
import { EyeOff, ServerOff, Trash2 } from "lucide-react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { prefersReducedMotion, revealOnScroll } from "@/lib/animations";

const CLAIMS = [
  {
    icon: ServerOff,
    title: "No media server",
    body: "Audio and video go browser to browser. Nothing in the middle decodes them.",
  },
  {
    icon: Trash2,
    title: "Nothing persisted",
    body: "Rooms exist while someone is in them. Chat, files and drawings are never written down.",
  },
  {
    icon: EyeOff,
    title: "No accounts",
    body: "There is no profile to build, because there is nothing to attach one to.",
  },
];

/**
 * PRIVACY — the closing argument before the CTA.
 *
 * The honesty note at the bottom is deliberate and load-bearing. A privacy
 * section that overclaims is worse than none, and the signalling server does
 * see who is in a room even though it never sees media.
 */
export function Privacy() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        gsap.set("[data-pv]", { opacity: 1, clipPath: "inset(0%)" });
        return;
      }

      // Headline wipes open from the centre.
      gsap.fromTo(
        "[data-pv='head']",
        { clipPath: "inset(0% 50% 0% 50%)", opacity: 0 },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          opacity: 1,
          duration: 1.1,
          ease: "power3.out",
          scrollTrigger: { trigger: root.current, start: "top 72%", once: true },
        },
      );

      // Claims rotate up into place from below the plane.
      gsap.fromTo(
        "[data-pv='claim']",
        { opacity: 0, rotateX: -35, y: 50, transformOrigin: "50% 100%" },
        {
          opacity: 1,
          rotateX: 0,
          y: 0,
          duration: 0.9,
          stagger: 0.14,
          ease: "power3.out",
          scrollTrigger: { trigger: "[data-pv-grid]", start: "top 82%", once: true },
        },
      );

      revealOnScroll("[data-pv='note']", { trigger: "[data-pv='note']", start: "top 88%" });
      ScrollTrigger.refresh();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="privacy"
      className="relative mx-auto w-full max-w-5xl scroll-mt-24 px-5 py-24 sm:py-32"
      style={{ perspective: "1000px" }}
    >
      <div data-pv="head" className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-violet">Privacy</p>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          The call has nowhere to leak to.
        </h2>
      </div>

      <div
        data-pv-grid
        className="mt-14 grid gap-3 sm:grid-cols-3"
        style={{ transformStyle: "preserve-3d" }}
      >
        {CLAIMS.map((c) => (
          <div
            key={c.title}
            data-pv="claim"
            data-cursor="card"
            className="glass rounded-2xl p-6"
            style={{ transformStyle: "preserve-3d" }}
          >
            <c.icon className="size-5 text-live" aria-hidden />
            <h3 className="mt-4 font-medium tracking-tight">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
          </div>
        ))}
      </div>

      {/*
        Stated plainly on purpose. Claiming more than the architecture
        delivers would undermine everything above it.
      */}
      <p
        data-pv="note"
        className="mx-auto mt-10 max-w-2xl rounded-2xl border border-hairline bg-white/[0.03] p-5 text-center text-xs leading-relaxed text-muted-foreground"
      >
        <span className="text-foreground">What this does not claim:</span> the
        signalling server sees which anonymous IDs share a room and relays the
        connection setup between them. Peers also learn each other&rsquo;s IP
        addresses — that is how a direct connection works. Parley protects the
        contents of your call, not the fact that it happened.
      </p>
    </section>
  );
}
