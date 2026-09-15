"use client";

import { useRef } from "react";
import { useGSAP } from "@/lib/gsap";
import { revealOnScroll } from "@/lib/animations";
import { ArchitectureAnimation } from "./architecture-animation";

/**
 * The architecture section. All of the motion lives in
 * <ArchitectureAnimation>; this component owns the heading and framing only.
 */
export function TechFlow() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      revealOnScroll("[data-tech-head] > *", {
        stagger: 0.08,
        trigger: root.current,
        start: "top 75%",
      });
    },
    { scope: root },
  );

  return (
    <section
      id="tech"
      ref={root}
      className="relative mx-auto w-full max-w-5xl scroll-mt-24 px-5 py-24 sm:py-32"
    >
      <div data-tech-head className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-violet">Architecture</p>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          What actually happens when you call
        </h2>
        <p className="mt-4 text-balance leading-relaxed text-muted-foreground">
          A signaling server introduces two browsers. After that it has no role
          in the conversation — scroll to watch it drop out of the path.
        </p>
      </div>

      <ArchitectureAnimation />
    </section>
  );
}
