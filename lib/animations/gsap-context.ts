"use client";

/**
 * Scoped animation hooks.
 *
 * Everything animated in Parley goes through these so that:
 *  1. selectors are scoped to the component's own subtree,
 *  2. every tween, timeline and ScrollTrigger is reverted on unmount,
 *  3. reduced-motion is handled in one place.
 *
 * Point 2 is not cosmetic. A video call mounts and unmounts tiles for the
 * whole duration of the session; a leaked ScrollTrigger holding a reference
 * to a removed <video> element keeps its MediaStream alive and leaks memory.
 */

import { useEffect, useRef, type RefObject } from "react";
import { useGSAP } from "@/lib/gsap";
import { magnetic, parallaxLayers } from "./animations";

interface RevealContext {
  reduced: boolean;
}

/**
 * Scoped, auto-cleaned GSAP. Drop-in replacement for useGSAP with the
 * reduced-motion flag handed to you.
 */
export function useReveal(
  build: (ctx: RevealContext) => void,
  scope: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
) {
  useGSAP(
    () => {
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      build({ reduced });
    },
    { scope, dependencies: deps },
  );
}

/** Attaches magnetic hover to an element for its lifetime. */
export function useMagnetic<T extends HTMLElement>(strength = 0.32) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!ref.current) return;
    return magnetic(ref.current, strength);
  }, [strength]);
  return ref;
}

/** Mouse-parallax for any [data-parallax] children of the returned ref. */
export function useParallax<T extends HTMLElement>(max = 26) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!ref.current) return;
    return parallaxLayers(ref.current, max);
  }, [max]);
  return ref;
}
