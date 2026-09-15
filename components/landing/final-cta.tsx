"use client";

import { useRef } from "react";
import { useGSAP } from "@/lib/gsap";
import { fadeUp } from "@/lib/animations";
import { CreateRoomButton } from "./create-room-button";

export function FinalCta() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      fadeUp("[data-cta-item]", {
        stagger: 0.09,
        scrollTrigger: { trigger: root.current, start: "top 78%" },
      } as never);
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative mx-auto w-full max-w-4xl px-5 py-24 sm:py-32">
      <div className="glass-strong relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12">
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
          className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Start a room. Send the link.
        </h2>
        <p
          data-cta-item
          className="mx-auto mt-4 max-w-md text-balance leading-relaxed text-muted-foreground"
        >
          No sign-up, no install, nothing to configure. The call is running
          before you finish reading this.
        </p>
        <div data-cta-item className="mt-8 flex justify-center">
          <CreateRoomButton />
        </div>
      </div>
    </section>
  );
}
