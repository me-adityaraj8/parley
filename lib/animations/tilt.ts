"use client";

/**
 * Cursor-driven 3D tilt for cards.
 *
 * PERFORMANCE CONTRACT
 * `pointermove` fires up to ~120 times a second. Nothing here touches React
 * state: `gsap.quickTo` builds one reusable tween per property and simply
 * retargets it, which is roughly an order of magnitude cheaper than calling
 * gsap.to() on every event. The element's rect is cached on enter rather than
 * measured per move, so the handler performs no layout reads at all.
 */

import { useEffect, useRef, type RefObject } from "react";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "./motion";

export interface TiltOptions {
  /** Maximum rotation in degrees at the card's edge. */
  max?: number;
  /** CSS perspective applied to the card itself. Lower = stronger effect. */
  perspective?: number;
  /** Scale applied while hovered. 1 disables it. */
  scale?: number;
  /** How far the whole card lifts toward the viewer, in px. */
  lift?: number;
  /** Render a specular highlight that tracks the cursor. */
  glare?: boolean;
  /** Seconds for the follow. Higher feels heavier. */
  ease?: number;
}

const DEFAULTS: Required<TiltOptions> = {
  max: 7,
  perspective: 900,
  scale: 1.012,
  lift: 14,
  glare: true,
  ease: 0.5,
};

/**
 * Attaches tilt to an element. Returns a cleanup function.
 *
 * Children marked `data-tilt-layer="<depth>"` are pushed along Z and given a
 * small counter-translation, which is what sells the parallax: foreground
 * layers travel further across the card than background ones as it turns.
 */
export function createTilt(el: HTMLElement, options: TiltOptions = {}): () => void {
  const o = { ...DEFAULTS, ...options };

  // Tilt is a pointer affordance. On touch there is no hover, and on
  // reduced-motion it is exactly the kind of movement to suppress.
  if (prefersReducedMotion()) return () => {};
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return () => {};

  gsap.set(el, {
    transformPerspective: o.perspective,
    transformStyle: "preserve-3d",
    willChange: "transform",
  });

  const rotX = gsap.quickTo(el, "rotationX", { duration: o.ease, ease: "power3.out" });
  const rotY = gsap.quickTo(el, "rotationY", { duration: o.ease, ease: "power3.out" });
  const zTo = gsap.quickTo(el, "z", { duration: o.ease, ease: "power3.out" });
  const scaleTo = gsap.quickTo(el, "scale", { duration: o.ease, ease: "power3.out" });

  /**
   * Depth layers.
   *
   * `data-tilt-layer` sets how far a layer travels across the card (parallax
   * strength); `data-tilt-z` optionally pins it to an exact translateZ in px.
   *
   * IMPORTANT: for the Z offsets to render as real depth, no ancestor
   * between here and the layer may use `overflow: hidden` — per spec that
   * forces `transform-style: flat` and silently collapses the 3D scene.
   */
  const layers = Array.from(el.querySelectorAll<HTMLElement>("[data-tilt-layer]")).map(
    (node) => {
      const depth = Number(node.dataset.tiltLayer ?? 0);
      const z = node.dataset.tiltZ !== undefined ? Number(node.dataset.tiltZ) : depth * 26;
      gsap.set(node, { transformStyle: "preserve-3d", z });
      return {
        depth,
        x: gsap.quickTo(node, "x", { duration: o.ease + 0.1, ease: "power3.out" }),
        y: gsap.quickTo(node, "y", { duration: o.ease + 0.1, ease: "power3.out" }),
        node,
      };
    },
  );

  let glareEl: HTMLDivElement | null = null;
  let glareX: ((v: number) => void) | null = null;
  let glareY: ((v: number) => void) | null = null;
  let glareOpacity: ((v: number) => void) | null = null;

  if (o.glare) {
    glareEl = document.createElement("div");
    glareEl.setAttribute("aria-hidden", "true");
    glareEl.style.cssText = [
      "position:absolute",
      "inset:0",
      "border-radius:inherit",
      "pointer-events:none",
      "opacity:0",
      "background:radial-gradient(220px circle at 50% 50%, oklch(1 0 0 / 14%), transparent 70%)",
    ].join(";");
    el.appendChild(glareEl);
    glareX = gsap.quickTo(glareEl, "xPercent", { duration: o.ease, ease: "power3.out" });
    glareY = gsap.quickTo(glareEl, "yPercent", { duration: o.ease, ease: "power3.out" });
    glareOpacity = gsap.quickTo(glareEl, "opacity", { duration: 0.35, ease: "power2.out" });
  }

  /** Cached on enter so the move handler never reads layout. */
  let rect = el.getBoundingClientRect();

  // Optional reactive layers, animated with transform/opacity only.
  const glow = el.querySelector<HTMLElement>("[data-tilt-glow]");
  const border = el.querySelector<HTMLElement>("[data-tilt-border]");
  const glowScale = glow ? gsap.quickTo(glow, "scale", { duration: 0.6, ease: "power3.out" }) : null;
  const glowOpacity = glow ? gsap.quickTo(glow, "opacity", { duration: 0.5, ease: "power2.out" }) : null;
  const borderOpacity = border
    ? gsap.quickTo(border, "opacity", { duration: 0.45, ease: "power2.out" })
    : null;
  if (glow) gsap.set(glow, { scale: 0.85, opacity: 0 });
  if (border) gsap.set(border, { opacity: 0 });

  const onEnter = () => {
    rect = el.getBoundingClientRect();
    zTo(o.lift);
    scaleTo(o.scale);
    glareOpacity?.(1);
    glowScale?.(1);
    glowOpacity?.(1);
    borderOpacity?.(1);
  };

  const onMove = (e: PointerEvent) => {
    // -0.5 … 0.5 across each axis.
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;

    // Y rotation follows horizontal travel; X rotation is inverted so the
    // card tips *away* from the cursor, which is what reads as physical.
    rotY(px * o.max * 2);
    rotX(-py * o.max * 2);

    for (const layer of layers) {
      layer.x(px * layer.depth * -18);
      layer.y(py * layer.depth * -18);
    }

    glareX?.(px * 50);
    glareY?.(py * 50);
  };

  const onLeave = () => {
    rotX(0);
    rotY(0);
    zTo(0);
    scaleTo(1);
    glareOpacity?.(0);
    glowScale?.(0.85);
    glowOpacity?.(0);
    borderOpacity?.(0);
    for (const layer of layers) {
      layer.x(0);
      layer.y(0);
    }
  };

  el.addEventListener("pointerenter", onEnter);
  el.addEventListener("pointermove", onMove, { passive: true });
  el.addEventListener("pointerleave", onLeave);

  return () => {
    el.removeEventListener("pointerenter", onEnter);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerleave", onLeave);
    gsap.killTweensOf(el);
    for (const layer of layers) gsap.killTweensOf(layer.node);
    if (glow) gsap.killTweensOf(glow);
    if (border) gsap.killTweensOf(border);
    if (glareEl) {
      gsap.killTweensOf(glareEl);
      glareEl.remove();
    }
    gsap.set(el, { clearProps: "transform,willChange" });
  };
}

/** Single-element tilt. */
export function useTilt<T extends HTMLElement>(options: TiltOptions = {}): RefObject<T | null> {
  const ref = useRef<T>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    if (!ref.current) return;
    return createTilt(ref.current, optsRef.current);
  }, []);

  return ref;
}

/**
 * Tilt every descendant matching `selector` inside a container — for grids
 * where the cards are generated from data and each needs its own instance.
 */
export function useTiltGroup<T extends HTMLElement>(
  selector: string,
  options: TiltOptions = {},
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cleanups = Array.from(root.querySelectorAll<HTMLElement>(selector)).map((el) =>
      createTilt(el, optsRef.current),
    );
    return () => cleanups.forEach((fn) => fn());
  }, [selector]);

  return ref;
}
