"use client";

/**
 * Transitions between application states — panels, stages and routes.
 * These are the animations that carry meaning: they tell the user where
 * something came from and where it went.
 */

import { gsap } from "@/lib/gsap";
import { DUR, EASE, motionSafe, prefersReducedMotion } from "./motion";

/** Slide-out panel (chat, participants). Returns the timeline so callers can reverse it. */
export function panelIn(panel: HTMLElement, from: "right" | "bottom" = "right") {
  const axis = from === "right" ? "xPercent" : "yPercent";
  return gsap.fromTo(
    panel,
    { [axis]: 100, opacity: 0.4 },
    motionSafe({
      [axis]: 0,
      opacity: 1,
      duration: DUR.base,
      ease: EASE.expo,
    }),
  );
}

export function panelOut(panel: HTMLElement, from: "right" | "bottom" = "right") {
  const axis = from === "right" ? "xPercent" : "yPercent";
  return gsap.to(
    panel,
    motionSafe({
      [axis]: 100,
      opacity: 0.4,
      duration: DUR.quick,
      ease: EASE.inOut,
    }),
  );
}

/** A participant tile arriving in the grid. */
export function tileEnter(tile: HTMLElement) {
  return gsap.fromTo(
    tile,
    { scale: 0.88, opacity: 0, y: 18 },
    motionSafe({
      scale: 1,
      opacity: 1,
      y: 0,
      duration: DUR.base,
      ease: EASE.back,
      clearProps: "transform",
    }),
  );
}

/**
 * A participant tile leaving. Returns a promise so the caller can wait for
 * the animation before removing the node from React state — otherwise the
 * element unmounts instantly and the exit animation is never seen.
 */
export function tileExit(tile: HTMLElement): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();
  return new Promise((resolve) => {
    gsap.to(tile, {
      scale: 0.9,
      opacity: 0,
      duration: DUR.quick,
      ease: EASE.inOut,
      onComplete: resolve,
    });
  });
}

/** Entrance for the whole call stage once media and signaling are ready. */
export function stageEnter(root: HTMLElement) {
  const tl = gsap.timeline();
  tl.fromTo(
    root,
    { opacity: 0, scale: 0.985 },
    motionSafe({ opacity: 1, scale: 1, duration: DUR.slow, ease: EASE.expo }),
  );
  return tl;
}

/**
 * Cross-fade between the camera view and a screen share.
 * Screen sharing is a mode change, so it gets a real transition rather than
 * an abrupt swap — the user needs to register that the stage changed.
 */
export function crossfadeStage(
  outgoing: HTMLElement | null,
  incoming: HTMLElement | null,
) {
  const tl = gsap.timeline();
  if (outgoing) {
    tl.to(outgoing, motionSafe({ opacity: 0, scale: 1.02, duration: DUR.quick }));
  }
  if (incoming) {
    tl.fromTo(
      incoming,
      { opacity: 0, scale: 0.98 },
      motionSafe({ opacity: 1, scale: 1, duration: DUR.base, ease: EASE.expo }),
      outgoing ? "-=0.1" : 0,
    );
  }
  return tl;
}

/** A chat message arriving. Small and quick — it must not distract mid-call. */
export function messageIn(el: HTMLElement) {
  return gsap.fromTo(
    el,
    { y: 10, opacity: 0, scale: 0.98 },
    motionSafe({ y: 0, opacity: 1, scale: 1, duration: DUR.quick, ease: EASE.out }),
  );
}

/** Press feedback for control-dock buttons. */
export function pressFeedback(el: HTMLElement) {
  if (prefersReducedMotion()) return;
  gsap.timeline()
    .to(el, { scale: 0.9, duration: 0.08, ease: EASE.inOut })
    .to(el, { scale: 1, duration: 0.3, ease: EASE.back });
}
