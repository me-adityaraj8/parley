"use client";

/**
 * Motion constants — the vocabulary every animation in Parley draws from.
 * Keeping durations and easings here (rather than as literals scattered
 * through components) is what makes the app feel like one product.
 */

export const DUR = {
  /** Button press, toggle flip — must feel instant. */
  instant: 0.15,
  /** Tooltip, badge, icon swap. */
  quick: 0.28,
  /** Panel slide, tile enter/exit. */
  base: 0.5,
  /** Section reveal on scroll. */
  slow: 0.8,
  /** Hero entrance, page transition. */
  cinematic: 1.1,
} as const;

export const EASE = {
  /** Default: decisive start, soft landing. */
  out: "power3.out",
  /** Long travel — very soft landing, used for hero and page transitions. */
  expo: "expo.out",
  /** Symmetric, for things that move and come back. */
  inOut: "power2.inOut",
  /** Slight overshoot — reserved for confirmations, never for layout. */
  back: "back.out(1.7)",
} as const;

export const STAGGER = {
  tight: 0.04,
  base: 0.07,
  loose: 0.12,
} as const;

/**
 * Reduced motion is a real accessibility need — vestibular disorders make
 * large transform animations genuinely unpleasant. We check it at call time
 * rather than caching, because users can change it mid-session.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Collapses a tween for reduced-motion users: movement is removed, but the
 * element still ENDS VISIBLE.
 *
 * This is the important part. A naive implementation skips the animation
 * entirely, which leaves anything that animates in from opacity 0 stuck at
 * opacity 0 — making the site unusable for exactly the people the setting
 * is meant to help.
 */
export function motionSafe<T extends Record<string, unknown>>(
  vars: T,
): T & { duration?: number } {
  if (!prefersReducedMotion()) return vars;
  return {
    ...vars,
    x: 0,
    y: 0,
    scale: 1,
    rotate: 0,
    clipPath: undefined,
    duration: 0.001,
    stagger: 0,
  };
}
