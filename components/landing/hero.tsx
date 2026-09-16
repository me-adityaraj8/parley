"use client";

import { useRef } from "react";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import {
  DUR,
  EASE,
  fadeUp,
  prefersReducedMotion,
  textReveal,
  useParallax,
} from "@/lib/animations";
import { CreateRoomButton } from "./create-room-button";
import { JoinRoomForm } from "./join-room-form";
import { CallPreview } from "./call-preview";
import { PeerNetwork3D } from "./peer-network-3d";

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const headline = useRef<HTMLHeadingElement>(null);
  const parallaxRef = useParallax<HTMLDivElement>(20);
  const camera = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline();

      // Headline first, everything else trails it. The character stagger is
      // the single most expensive-feeling moment on the page, so it leads.
      if (headline.current) {
        const { tween, cleanup } = textReveal(headline.current, {
          by: "words",
          duration: DUR.cinematic,
          stagger: 0.055,
        });
        tl.add(tween, 0);
        // SplitText rewrites the DOM into spans; reverting restores real
        // text for selection and screen readers.
        return cleanup;
      }
    },
    { scope: root },
  );

  useGSAP(
    () => {
      const tl = gsap.timeline({ delay: prefersReducedMotion() ? 0 : 0.45 });
      tl.add(fadeUp("[data-hero='eyebrow']", { y: 14, duration: DUR.slow }), 0)
        .add(fadeUp("[data-hero='sub']", { y: 18, duration: DUR.slow }), 0.1)
        .add(fadeUp("[data-hero='cta']", { y: 16, stagger: 0.08 }), 0.22)
        .add(fadeUp("[data-hero='meta']", { y: 12, stagger: 0.06 }), 0.35)
        .fromTo(
          "[data-hero='preview']",
          { opacity: 0, y: 48, scale: 0.96 },
          { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: EASE.expo },
          0.3,
        );
    },
    { scope: root },
  );

  /**
   * CINEMATIC SCROLL CAMERA
   *
   * Scrolling past the hero reads as the camera pulling back through the
   * scene rather than the page sliding up: the copy recedes in Z, tips
   * away, and dissolves as the next section arrives.
   *
   * Two deliberate constraints keep it from becoming a gimmick:
   *  - the text is fully opaque and square-on for the first ~35% of the
   *    scroll, so it is never animated while someone is still reading it;
   *  - blur is applied only at the tail end, once opacity is already low.
   */
  useGSAP(
    () => {
      if (prefersReducedMotion() || !camera.current) return;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.9,
        },
      });

      // Depth-layered dolly: the closer a layer is, the further it travels.
      tl.to("[data-cam='near']", { z: -260, yPercent: -9, ease: "none" }, 0)
        .to("[data-cam='mid']", { z: -160, yPercent: -6, ease: "none" }, 0)
        .to("[data-cam='far']", { z: -80, yPercent: -3, ease: "none" }, 0)
        // The whole frame tips away and dims, but only after the reading zone.
        .to(camera.current, { rotateX: 7, scale: 0.94, ease: "none" }, 0)
        .to(camera.current, { opacity: 0.25, ease: "none" }, 0.35)
        .to(camera.current, { filter: "blur(7px)", ease: "none" }, 0.6);

      ScrollTrigger.refresh();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative flex min-h-dvh flex-col items-center justify-center px-5 pb-16 pt-32 sm:pt-36"
    >
      {/*
        The 3D peer network sits behind the copy. Its diamond layout leaves
        the centre empty on purpose, so the headline reads against clear
        ground while the architecture frames it.
      */}
      <PeerNetwork3D className="top-0 h-[min(100dvh,860px)]" />

      <div
        ref={camera}
        data-hero-camera
        className="relative z-10 flex w-full flex-col items-center will-change-transform"
        style={{ perspective: "1400px", transformStyle: "preserve-3d" }}
      >
      <div ref={parallaxRef} className="flex w-full max-w-5xl flex-col items-center">
        <span
          data-hero="eyebrow"
          data-parallax="0.25"
          data-cam="near"
          className="glass mb-7 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-muted-foreground"
        >
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-live" />
          </span>
          No accounts. No downloads. No server in the middle.
        </span>

        <h1
          ref={headline}
          data-parallax="0.15"
          data-cam="near"
          className="max-w-4xl text-balance text-center text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-7xl"
        >
          <span className="text-gradient">Talk directly.</span>{" "}
          <span className="text-gradient-violet">Nothing in between.</span>
        </h1>

        <p
          data-hero="sub"
          data-parallax="0.3"
          data-cam="mid"
          className="mt-6 max-w-xl text-balance text-center text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          Parley opens an encrypted connection straight between browsers. Your
          video, audio and messages travel peer-to-peer — never through a
          server that could store them.
        </p>

        <div data-cam="mid" className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <div data-hero="cta" className="w-full sm:w-auto">
            <CreateRoomButton className="w-full sm:w-auto" />
          </div>
          <div data-hero="cta" className="w-full sm:w-auto">
            <JoinRoomForm />
          </div>
        </div>

        <ul data-cam="mid" className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <li data-hero="meta" className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-live" aria-hidden />
            DTLS-SRTP encrypted
          </li>
          <li data-hero="meta" className="flex items-center gap-1.5">
            <Zap className="size-3.5 text-violet" aria-hidden />
            One network hop
          </li>
          <li data-hero="meta" className="flex items-center gap-1.5">
            <ArrowRight className="size-3.5 text-violet" aria-hidden />
            Share a link to invite
          </li>
        </ul>

        <div
          data-hero="preview"
          data-parallax="0.45"
          data-cam="far"
          className="mt-16 w-full max-w-4xl"
        >
          <CallPreview />
        </div>
      </div>
      </div>
    </section>
  );
}
