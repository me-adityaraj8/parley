"use client";

/**
 * Reusable animation primitives.
 *
 * Every helper uses `fromTo`, never `from`. `from` infers its end value from
 * the element's current state, which React StrictMode's double effect
 * invocation can capture mid-animation — permanently freezing elements at
 * opacity 0. `fromTo` states both ends, so running it twice is harmless.
 * This matters most in the call UI, where tiles mount and unmount constantly.
 */

import { gsap, SplitText } from "@/lib/gsap";
import { DUR, EASE, STAGGER, motionSafe, prefersReducedMotion } from "./motion";

type Targets = gsap.TweenTarget;

interface RevealOptions {
  y?: number;
  delay?: number;
  duration?: number;
  stagger?: number;
  ease?: string;
}

/** The workhorse: fade up into place. Used for most content reveals. */
export function fadeUp(targets: Targets, o: RevealOptions = {}) {
  return gsap.fromTo(
    targets,
    { y: o.y ?? 28, opacity: 0 },
    motionSafe({
      y: 0,
      opacity: 1,
      duration: o.duration ?? DUR.slow,
      delay: o.delay ?? 0,
      stagger: o.stagger ?? 0,
      ease: o.ease ?? EASE.out,
    }),
  );
}

/** Scale + fade. Used for cards, tiles and anything that should feel placed. */
export function scaleIn(targets: Targets, o: RevealOptions & { from?: number } = {}) {
  return gsap.fromTo(
    targets,
    { scale: o.from ?? 0.94, opacity: 0, y: o.y ?? 12 },
    motionSafe({
      scale: 1,
      opacity: 1,
      y: 0,
      duration: o.duration ?? DUR.base,
      delay: o.delay ?? 0,
      stagger: o.stagger ?? 0,
      ease: o.ease ?? EASE.out,
    }),
  );
}

/** Staggered group reveal — feature cards, participant rows, chat messages. */
export function staggerUp(targets: Targets, o: RevealOptions = {}) {
  return fadeUp(targets, { ...o, stagger: o.stagger ?? STAGGER.base });
}

/**
 * Clip-path wipe. Reveals an element as though a mask slides off it, which
 * reads as more "produced" than a fade. Used for mockups and imagery.
 */
export function clipReveal(targets: Targets, o: RevealOptions = {}) {
  if (prefersReducedMotion()) {
    return gsap.fromTo(
      targets,
      { opacity: 0 },
      { opacity: 1, clipPath: "inset(0% 0% 0% 0%)", duration: 0.001 },
    );
  }
  return gsap.fromTo(
    targets,
    { clipPath: "inset(0% 0% 100% 0%)", opacity: 0 },
    {
      clipPath: "inset(0% 0% 0% 0%)",
      opacity: 1,
      duration: o.duration ?? DUR.cinematic,
      delay: o.delay ?? 0,
      ease: o.ease ?? EASE.expo,
    },
  );
}

/**
 * Splits text into words or characters and staggers them in.
 *
 * Returns a cleanup function that calls `split.revert()`. That call is not
 * optional: SplitText rewrites the element's DOM into per-word/char spans,
 * which destroys text selection and confuses screen readers if left in place.
 */
export function textReveal(
  el: HTMLElement,
  o: RevealOptions & { by?: "words" | "chars" } = {},
): { tween: gsap.core.Tween; cleanup: () => void } {
  if (prefersReducedMotion()) {
    const tween = gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.001 });
    return { tween, cleanup: () => {} };
  }

  const split = new SplitText(el, {
    type: o.by === "chars" ? "chars,words" : "words",
    // Each part gets a wrapper with overflow hidden, so parts rise out of
    // a mask rather than simply fading — much stronger read.
    mask: o.by === "chars" ? "chars" : "words",
  });

  const parts = o.by === "chars" ? split.chars : split.words;

  /**
   * Gradient text needs the gradient re-applied to each split part.
   *
   * `.text-gradient` works by painting a background on the element and
   * clipping it to the text inside. The moment GSAP puts a transform on a
   * child word, that word is promoted to its own paint layer and the
   * ancestor's clipped background can no longer reach it — the text renders
   * transparent against nothing and simply vanishes. Copying the gradient
   * class onto each part gives every word its own background to clip.
   */
  for (const part of parts) {
    const owner = (part as HTMLElement).closest<HTMLElement>(
      ".text-gradient, .text-gradient-violet",
    );
    if (!owner) continue;
    (part as HTMLElement).classList.add(
      owner.classList.contains("text-gradient-violet")
        ? "text-gradient-violet"
        : "text-gradient",
    );
  }

  const tween = gsap.fromTo(
    parts,
    { yPercent: 115, opacity: 0 },
    {
      yPercent: 0,
      opacity: 1,
      duration: o.duration ?? DUR.cinematic,
      delay: o.delay ?? 0,
      stagger: o.stagger ?? (o.by === "chars" ? 0.018 : STAGGER.base),
      ease: o.ease ?? EASE.expo,
    },
  );

  return { tween, cleanup: () => split.revert() };
}

/**
 * Magnetic hover for primary CTAs.
 *
 * The button drifts toward the cursor, tilts very slightly toward it, its
 * icon leads the movement, and a glow swells behind it. Movement is
 * deliberately small — a button that chases the pointer is a toy; one that
 * leans a few pixels feels responsive.
 *
 * Opt-in children:
 *   [data-magnet-icon]  travels further than the button (leads the motion)
 *   [data-magnet-glow]  scales and fades in on approach
 *
 * Returns a cleanup function; callers MUST call it on unmount or the
 * listeners and quickTo instances leak.
 */
export function magnetic(el: HTMLElement, strength = 0.32): () => void {
  if (prefersReducedMotion()) return () => {};
  // Pointer magnetism is meaningless on touch and costs a repaint.
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return () => {};
  }

  const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: EASE.out });
  const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: EASE.out });
  const rotTo = gsap.quickTo(el, "rotation", { duration: 0.6, ease: EASE.out });
  const scaleTo = gsap.quickTo(el, "scale", { duration: 0.35, ease: EASE.out });

  const icon = el.querySelector<HTMLElement>("[data-magnet-icon]");
  const iconX = icon ? gsap.quickTo(icon, "x", { duration: 0.65, ease: EASE.out }) : null;
  const iconY = icon ? gsap.quickTo(icon, "y", { duration: 0.65, ease: EASE.out }) : null;

  const glow = el.querySelector<HTMLElement>("[data-magnet-glow]");
  const glowScale = glow ? gsap.quickTo(glow, "scale", { duration: 0.55, ease: EASE.out }) : null;
  const glowOpacity = glow ? gsap.quickTo(glow, "opacity", { duration: 0.4, ease: EASE.out }) : null;
  if (glow) gsap.set(glow, { scale: 0.7, opacity: 0 });

  let pressed = false;

  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);

    xTo(dx * strength);
    yTo(dy * strength);
    // A whisper of rotation — enough to read as physical, not as wobble.
    rotTo((dx / Math.max(r.width, 1)) * 3);

    // The icon leads, which is what makes the button feel like it is being
    // pulled rather than translated.
    iconX?.(dx * strength * 0.55);
    iconY?.(dy * strength * 0.55);
  };

  const onEnter = () => {
    if (!pressed) scaleTo(1.03);
    glowScale?.(1);
    glowOpacity?.(1);
  };

  const onLeave = () => {
    xTo(0);
    yTo(0);
    rotTo(0);
    scaleTo(1);
    iconX?.(0);
    iconY?.(0);
    glowScale?.(0.7);
    glowOpacity?.(0);
  };

  const onDown = () => {
    pressed = true;
    scaleTo(0.96);
  };
  const onUp = () => {
    pressed = false;
    scaleTo(1.03);
  };

  el.addEventListener("pointermove", onMove, { passive: true });
  el.addEventListener("pointerenter", onEnter);
  el.addEventListener("pointerleave", onLeave);
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointerup", onUp);

  return () => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerenter", onEnter);
    el.removeEventListener("pointerleave", onLeave);
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointerup", onUp);
    gsap.killTweensOf(el);
    if (icon) gsap.killTweensOf(icon);
    if (glow) gsap.killTweensOf(glow);
  };
}

/**
 * Mouse parallax across a container. Children opt in with data-parallax="0.5",
 * where the number is depth (higher = moves more).
 */
export function parallaxLayers(container: HTMLElement, max = 26): () => void {
  if (prefersReducedMotion()) return () => {};
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return () => {};
  }

  const layers = Array.from(
    container.querySelectorAll<HTMLElement>("[data-parallax]"),
  ).map((el) => ({
    el,
    depth: Number(el.dataset.parallax ?? 0.5),
    xTo: gsap.quickTo(el, "x", { duration: 1.1, ease: EASE.out }),
    yTo: gsap.quickTo(el, "y", { duration: 1.1, ease: EASE.out }),
  }));

  const onMove = (e: PointerEvent) => {
    const nx = e.clientX / window.innerWidth - 0.5;
    const ny = e.clientY / window.innerHeight - 0.5;
    for (const l of layers) {
      l.xTo(nx * max * l.depth);
      l.yTo(ny * max * l.depth);
    }
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  return () => {
    window.removeEventListener("pointermove", onMove);
    for (const l of layers) gsap.killTweensOf(l.el);
  };
}

/** Slow vertical drift for ambient glow blobs. Infinite, yoyo, staggered. */
export function floatAmbient(targets: Targets, distance = 18) {
  if (prefersReducedMotion()) return gsap.timeline();
  return gsap.to(targets, {
    y: `+=${distance}`,
    duration: 6,
    ease: "sine.inOut",
    yoyo: true,
    repeat: -1,
    stagger: { each: 1.4, from: "random" },
  });
}

/**
 * Scroll-triggered reveal — the only way sections should animate in.
 *
 * With reduced motion we do NOT merely shorten the animation: we skip
 * ScrollTrigger entirely and set the end state immediately. Leaving content
 * at opacity 0 waiting for a scroll event is how "accessible" animation
 * systems make pages permanently blank for the people the setting protects.
 */
export function revealOnScroll(
  targets: Targets,
  o: RevealOptions & {
    trigger?: gsap.DOMTarget;
    start?: string;
    from?: { y?: number; scale?: number };
  } = {},
) {
  if (prefersReducedMotion()) {
    gsap.set(targets, { opacity: 1, y: 0, scale: 1, clearProps: "transform" });
    return;
  }

  return gsap.fromTo(
    targets,
    { opacity: 0, y: o.from?.y ?? o.y ?? 32, scale: o.from?.scale ?? 1 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: o.duration ?? DUR.slow,
      stagger: o.stagger ?? 0,
      delay: o.delay ?? 0,
      ease: o.ease ?? EASE.out,
      scrollTrigger: {
        trigger: o.trigger ?? (targets as gsap.DOMTarget),
        start: o.start ?? "top 78%",
        once: true,
      },
    },
  );
}
