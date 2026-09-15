"use client";

/**
 * The ambient layer that sits behind every screen: a blueprint grid, two
 * drifting glow fields, and a vignette. Purely decorative, so it is
 * aria-hidden and pointer-events-none.
 *
 * Performance note: the glows animate `transform` only (never `filter` or
 * `background-position`), so they stay on the compositor and cost no layout
 * or paint while a call is running.
 */

import { useRef } from "react";
import { floatAmbient } from "@/lib/animations";
import { useReveal } from "@/lib/animations";
import { cn } from "@/lib/utils";

export function AmbientBackground({ className }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useReveal(() => {
    floatAmbient("[data-glow]", 22);
  }, root);

  return (
    <div
      ref={root}
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 grid-lines mask-fade-edges opacity-70" />

      <div
        data-glow
        className="absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full opacity-50 blur-[120px]"
        style={{ background: "radial-gradient(circle, oklch(0.64 0.191 281 / 55%), transparent 70%)" }}
      />
      <div
        data-glow
        className="absolute -bottom-52 -right-32 size-[34rem] rounded-full opacity-40 blur-[120px]"
        style={{ background: "radial-gradient(circle, oklch(0.79 0.142 196 / 42%), transparent 70%)" }}
      />
      <div
        data-glow
        className="absolute top-1/3 -left-40 size-[28rem] rounded-full opacity-30 blur-[120px]"
        style={{ background: "radial-gradient(circle, oklch(0.7 0.16 320 / 40%), transparent 70%)" }}
      />

      {/* Vignette keeps focus centred and stops the glows reaching the edges. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_50%_0%,transparent_40%,var(--pl-void)_100%)]" />
    </div>
  );
}
