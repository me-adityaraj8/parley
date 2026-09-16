"use client";

import { useRef } from "react";
import { useGSAP } from "@/lib/gsap";
import { revealOnScroll, useTilt } from "@/lib/animations";
import { CreateRoomButton } from "./create-room-button";

export function FinalCta() {
  const root = useRef<HTMLElement>(null);
  const tiltRef = useTilt<HTMLDivElement>({ max: 4, lift: 10, scale: 1.006, ease: 0.6 });

  useGSAP(
    () => {
      revealOnScroll("[data-cta-item]", {
        stagger: 0.09,
        trigger: root.current,
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative mx-auto w-full max-w-4xl px-5 py-24 sm:py-32">
      <div
        ref={tiltRef}
        className="glass-strong relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 h-48 opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse at 50% 100%, oklch(0.64 0.191 281 / 45%), transparent 70%)",
          }}
        />
        <h2
          data-cta-item
          data-tilt-layer="1.4"
          className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Start a room. Send the link.
        </h2>
        <p
          data-cta-item
          data-tilt-layer="0.6"
          className="mx-auto mt-4 max-w-md text-balance leading-relaxed text-muted-foreground"
        >
          No sign-up, no install, nothing to configure. The call is running
          before you finish reading this.
        </p>
        <div data-cta-item data-tilt-layer="2" className="mt-8 flex justify-center">
          <CreateRoomButton />
        </div>
      </div>
    </section>
  );
}
