"use client";

/**
 * Single source of truth for GSAP in the app.
 *
 * Why this file exists:
 * 1. GSAP plugins must be registered exactly once, and only in the browser.
 *    Next.js renders components on the server first, where `window` and the
 *    DOM do not exist — calling registerPlugin there throws.
 * 2. Importing plugins from many component files causes duplicate
 *    registration warnings and makes tree-shaking unpredictable.
 *
 * Every component imports GSAP from here, never from "gsap" directly.
 */

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";
import { Observer } from "gsap/Observer";

const isBrowser = typeof window !== "undefined";

if (isBrowser) {
  // useGSAP is registered as a plugin so GSAP knows about React's lifecycle
  // and can scope/revert animations automatically on unmount.
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip, Observer);

  // One consistent motion signature across the entire product.
  // Changing these two lines re-tunes the feel of the whole app.
  gsap.defaults({
    ease: "power3.out",
    duration: 0.8,
  });

  // Mobile browsers fire resize when the URL bar hides/shows. Without this,
  // ScrollTrigger recalculates on every scroll gesture and stutters.
  ScrollTrigger.config({ ignoreMobileResize: true });
}

export { gsap, useGSAP, ScrollTrigger, SplitText, Flip, Observer };
