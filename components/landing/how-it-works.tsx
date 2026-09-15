"use client";

import { useRef } from "react";
import { Link2, MousePointerClick, Radio } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { prefersReducedMotion, revealOnScroll } from "@/lib/animations";

const STEPS = [
  {
    icon: MousePointerClick,
    title: "Create a room",
    body: "A unique room link is generated in your browser. Nothing is registered anywhere — the room exists the moment you arrive.",
  },
  {
    icon: Link2,
    title: "Share the link",
    body: "Send it however you like. Anyone with the link can join; anyone without it cannot find the room at all.",
  },
  {
    icon: Radio,
    title: "Start talking",
    body: "Browsers negotiate a route to each other, then connect directly. From that point on, your call is nobody else's traffic.",
  },
];

export function HowItWorks() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const reduced = prefersReducedMotion();

      revealOnScroll("[data-step]", {
        y: 40,
        stagger: 0.15,
        trigger: root.current,
        start: "top 70%",
      });

      // The rail draws itself as the section scrolls past — a progress
      // indicator that also visually links the three steps.
      if (!reduced) {
        gsap.fromTo(
          "[data-rail]",
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top 65%",
              end: "bottom 75%",
              scrub: 0.6,
            },
          },
        );
      }
    },
    { scope: root },
  );

  return (
    <section
      id="how"
      ref={root}
      className="relative mx-auto w-full max-w-4xl scroll-mt-24 px-5 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-violet">
          How it works
        </p>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Three steps, no setup
        </h2>
      </div>

      <ol className="relative mt-16 space-y-10">
        {/* Vertical rail behind the step markers. */}
        <span
          aria-hidden
          className="absolute left-[1.4375rem] top-2 hidden h-[calc(100%-1rem)] w-px bg-hairline sm:block"
        />
        <span
          data-rail
          aria-hidden
          className="absolute left-[1.4375rem] top-2 hidden h-[calc(100%-1rem)] w-px origin-top bg-gradient-to-b from-violet to-live sm:block"
        />

        {STEPS.map((step, i) => (
          <li key={step.title} data-step className="relative flex gap-5">
            <span className="glass relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full">
              <step.icon className="size-5 text-violet" aria-hidden />
            </span>
            <div className="pt-1.5">
              <p className="text-xs font-mono text-muted-foreground">
                Step {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1 text-lg font-medium tracking-tight">
                {step.title}
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
