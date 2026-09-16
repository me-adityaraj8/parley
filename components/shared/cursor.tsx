"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";

/**
 * Minimal custom cursor: a dot that tracks precisely, and a ring that trails.
 *
 * ACCESSIBILITY POSITION
 * The native cursor is only hidden where this can fully replace it — over
 * the page background and over buttons/links. Text inputs, textareas and
 * anything with a `cursor` of its own keep the real caret, because replacing
 * an I-beam with a dot actively harms text editing. Focus outlines are
 * untouched, and the whole thing is inert for keyboard users: it never moves
 * unless a fine pointer moves, and it is `aria-hidden`.
 *
 * It is disabled outright on coarse pointers and under reduced motion —
 * a trailing ring is exactly the kind of movement that setting asks to stop.
 */

type CursorMode = "default" | "cta" | "card" | "node" | "text";

export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const mode = useRef<CursorMode>("default");

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    setEnabled(true);

    const d = dot.current;
    const r = ring.current;
    if (!d || !r) return;

    // The dot is near-instant; the ring lags, which is what reads as weight.
    const dx = gsap.quickTo(d, "x", { duration: 0.08, ease: "power3.out" });
    const dy = gsap.quickTo(d, "y", { duration: 0.08, ease: "power3.out" });
    const rx = gsap.quickTo(r, "x", { duration: 0.42, ease: "power3.out" });
    const ry = gsap.quickTo(r, "y", { duration: 0.42, ease: "power3.out" });

    let visible = false;

    const setMode = (next: CursorMode) => {
      if (mode.current === next) return;
      mode.current = next;

      // Text mode hands control back to the browser entirely.
      document.documentElement.classList.toggle("cursor-hidden", next !== "text");

      const ringStyles: Record<CursorMode, gsap.TweenVars> = {
        default: { width: 30, height: 30, borderWidth: 1, opacity: 0.5, borderColor: "oklch(0.78 0.14 281 / 70%)" },
        cta: { width: 64, height: 64, borderWidth: 1.5, opacity: 0.9, borderColor: "oklch(0.78 0.14 281 / 90%)" },
        card: { width: 48, height: 48, borderWidth: 1, opacity: 0.7, borderColor: "oklch(0.82 0.13 196 / 80%)" },
        node: { width: 54, height: 54, borderWidth: 2, opacity: 1, borderColor: "oklch(0.82 0.13 196)" },
        text: { width: 2, height: 22, borderWidth: 0, opacity: 0, borderColor: "transparent" },
      };
      gsap.to(r, { ...ringStyles[next], duration: 0.28, ease: "power3.out" });
      gsap.to(d, {
        scale: next === "cta" ? 0.4 : next === "node" ? 0 : 1,
        opacity: next === "text" ? 0 : 1,
        duration: 0.24,
        ease: "power3.out",
      });
    };

    const onMove = (e: PointerEvent) => {
      if (!visible) {
        visible = true;
        gsap.to([d, r], { autoAlpha: 1, duration: 0.2 });
      }
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);

      const el = e.target as HTMLElement | null;
      if (!el?.closest) return;

      if (el.closest("input, textarea, [contenteditable='true'], select")) setMode("text");
      else if (el.closest("[data-cursor='node']")) setMode("node");
      else if (el.closest("button, a, [role='button']")) setMode("cta");
      else if (el.closest("[data-feature], [data-cursor='card']")) setMode("card");
      else setMode("default");
    };

    const onLeave = () => {
      visible = false;
      gsap.to([d, r], { autoAlpha: 0, duration: 0.2 });
    };
    const onDown = () => gsap.to(r, { scale: 0.82, duration: 0.14 });
    const onUp = () => gsap.to(r, { scale: 1, duration: 0.24, ease: "back.out(2)" });

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.classList.remove("cursor-hidden");
      gsap.killTweensOf([d, r]);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div aria-hidden data-custom-cursor>
      <div
        ref={ring}
        className="pointer-events-none fixed left-0 top-0 z-[200] -translate-x-1/2 -translate-y-1/2 rounded-full border opacity-0"
        style={{ width: 30, height: 30, borderColor: "oklch(0.78 0.14 281 / 70%)" }}
      />
      <div
        ref={dot}
        className="pointer-events-none fixed left-0 top-0 z-[200] size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet opacity-0"
      />
    </div>
  );
}
