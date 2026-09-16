"use client";

import { useRef } from "react";
import { ArrowRight, Video } from "lucide-react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { prefersReducedMotion, revealOnScroll } from "@/lib/animations";

/**
 * P2P VIDEO — the first beat after the hero.
 *
 * This section PINS. While it is held, two panels slide apart to reveal the
 * direct path between them, and the "through a server" route visibly loses
 * to the direct one. Pinning is used here (and only here plus the
 * architecture walkthrough) because the point is a comparison: both states
 * have to be on screen in the same place, one after the other.
 */
export function P2PVideo() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        gsap.set("[data-p2p-el]", { opacity: 1, clipPath: "inset(0%)" });
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=900",
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
        },
      });

      /*
       * Ordering note: the supporting stats resolve EARLY, not late. They
       * occupy layout the whole time the section is pinned, so revealing
       * them at the end left three empty boxes on screen for most of the
       * pin. The climax is the link drawing, not the copy arriving.
       */
      tl.fromTo(
        "[data-p2p-el='title']",
        { opacity: 0, y: 40, rotateX: 18 },
        { opacity: 1, y: 0, rotateX: 0, duration: 0.7, ease: "power2.out" },
        0,
      )
        // The two endpoints separate, opening space for the path between.
        .fromTo("[data-p2p-el='left']", { x: 120, opacity: 0, z: -180 }, { x: 0, opacity: 1, z: 0, duration: 0.8 }, 0.12)
        .fromTo("[data-p2p-el='right']", { x: -120, opacity: 0, z: -180 }, { x: 0, opacity: 1, z: 0, duration: 0.8 }, 0.12)
        .fromTo("[data-p2p-el='stat']", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.08 }, 0.35)
        // Clip-path wipe on the direct link — the climax of the section.
        .fromTo(
          "[data-p2p-el='link']",
          { clipPath: "inset(0% 100% 0% 0%)", opacity: 0 },
          { clipPath: "inset(0% 0% 0% 0%)", opacity: 1, duration: 1, ease: "power2.inOut" },
          0.95,
        )
        // The relayed alternative fades out of contention.
        .to("[data-p2p-el='relay']", { opacity: 0.18, scale: 0.94, duration: 0.8 }, 1.3);

      ScrollTrigger.refresh();
    },
    { scope: root },
  );

  useGSAP(
    () => {
      revealOnScroll("[data-p2p-foot]", { trigger: root.current, start: "top 60%" });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="p2p"
      className="relative flex min-h-dvh scroll-mt-24 items-center overflow-hidden px-5"
    >
      <div
        className="mx-auto w-full max-w-5xl"
        style={{ perspective: "1200px", transformStyle: "preserve-3d" }}
      >
        <div data-p2p-el="title" className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-violet">Peer to peer</p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            Your video takes the short way.
          </h2>
        </div>

        <div className="relative mt-16 flex items-center justify-between gap-4">
          <Endpoint side="left" />

          <div className="relative flex-1">
            {/* The relayed route, shown losing. */}
            <div
              data-p2p-el="relay"
              className="absolute inset-x-0 -top-14 flex flex-col items-center gap-1"
            >
              <div className="h-px w-full bg-[repeating-linear-gradient(90deg,oklch(0.6_0.02_265)_0_6px,transparent_6px_14px)]" />
              <span className="text-[10px] text-muted-foreground">
                via a server — decoded, re-encoded, stored
              </span>
            </div>

            {/* The direct route. */}
            <div data-p2p-el="link" className="relative">
              <div
                className="h-1 w-full rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, oklch(0.64 0.191 281), oklch(0.79 0.142 196))",
                  boxShadow: "0 0 24px -2px oklch(0.7 0.16 240 / 60%)",
                }}
              />
              <span className="mt-2 block text-center text-[11px] font-medium text-live">
                direct — DTLS-SRTP encrypted
              </span>
            </div>
          </div>

          <Endpoint side="right" />
        </div>

        <dl className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            ["1", "network hop", "Bounded by the distance between you, not by a data centre."],
            ["0", "servers decode it", "No relay holds a decrypted frame of your call."],
            ["6", "people per room", "Mesh, so everyone connects to everyone."],
          ].map(([n, label, body]) => (
            <div key={label} data-p2p-el="stat" className="glass rounded-2xl p-5">
              <dt className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-gradient-violet">{n}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Endpoint({ side }: { side: "left" | "right" }) {
  return (
    <div
      data-p2p-el={side}
      data-cursor="card"
      className="glass flex w-32 shrink-0 flex-col items-center gap-2 rounded-2xl p-4 sm:w-40"
      style={{ transformStyle: "preserve-3d" }}
    >
      <Video className="size-5 text-violet" aria-hidden />
      <span className="text-xs font-medium">{side === "left" ? "You" : "Them"}</span>
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        MediaStream
        {side === "left" && <ArrowRight className="size-2.5" aria-hidden />}
      </span>
    </div>
  );
}
