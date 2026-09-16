"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/animations";
import { cn } from "@/lib/utils";

const STAGES = [
  {
    id: "capture",
    label: "getUserMedia()",
    title: "The browser captures you",
    body: "Each browser asks for a camera and microphone and receives a MediaStream. Nothing has left the device yet.",
  },
  {
    id: "signal",
    label: "Signaling",
    title: "Two browsers are introduced",
    body: "WebRTC has no opinion about how peers find each other. A tiny Cloudflare Worker relays JSON between them — setup text only, never a frame of video.",
  },
  {
    id: "sdp",
    label: "Offer / Answer",
    title: "They agree on a language",
    body: "An SDP offer describes what A can send and receive. B replies with an answer describing the intersection of what they both support.",
  },
  {
    id: "ice",
    label: "ICE / STUN",
    title: "They find a route",
    body: "Both peers sit behind NAT and don't know their own public address. STUN tells each one how the internet sees it; every possible route becomes an ICE candidate.",
  },
  {
    id: "p2p",
    label: "Connected",
    title: "The server steps out",
    body: "Once a candidate pair succeeds, DTLS negotiates keys and media flows directly. The signaling server is now idle — if it went offline, the call would continue.",
  },
] as const;

/** Signal pulses fired along the signalling path, in sequence order. */
interface Pulse {
  /** Position on the scrubbed timeline where this pulse fires. */
  at: number;
  path: string;
  label: string;
  /** Travel from the end of the path back to the start. */
  reverse?: boolean;
}

const PULSES: Pulse[] = [
  { at: 1.7, path: "#sigPathA", label: "offer" },
  { at: 2.2, path: "#sigPathB", label: "offer" },
  { at: 2.7, path: "#sigPathB", label: "answer", reverse: true },
  { at: 3.1, path: "#sigPathA", label: "answer", reverse: true },
];

/**
 * The animated explanation of how WebRTC actually connects.
 *
 * Scroll drives a scrubbed GSAP timeline: packets travel A → server → B while
 * signaling happens, then the direct path draws itself and the server visibly
 * desaturates and recedes. The point of the animation is pedagogical — the
 * single most misunderstood thing about WebRTC is that the signaling server
 * is not in the media path, and watching it drop out makes that concrete.
 */
export function ArchitectureAnimation() {
  const root = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);

  useGSAP(
    () => {
      const reduced = prefersReducedMotion();

      if (reduced) {
        // Show the finished state; no scroll dependency, nothing hidden.
        gsap.set("[data-p2p-line]", { drawSVG: "100%", opacity: 1 });
        gsap.set("[data-server]", { opacity: 0.35 });
        gsap.set("[data-node]", { opacity: 1, scale: 1 });
        setStage(STAGES.length - 1);
        return;
      }

      gsap.set("[data-p2p-line]", { drawSVG: "0%" });
      gsap.set("[data-sig-line]", { drawSVG: "0%" });
      gsap.set("[data-packet]", { opacity: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top 70%",
          end: "bottom 60%",
          scrub: 0.8,
        },
      });

      // 1 — nodes appear
      tl.fromTo(
        "[data-node]",
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 1, stagger: 0.2, ease: "back.out(1.6)" },
      )
        // 2 — signaling paths draw
        .to("[data-sig-line]", { drawSVG: "100%", duration: 1.4, ease: "none" }, 0.8)
        // 3 — SDP packets travel A → server → B
        .to(
          "[data-packet='sdp']",
          {
            opacity: 1,
            duration: 0.25,
            stagger: 0.3,
            motionPath: { path: "#sigPathA", align: "#sigPathA", alignOrigin: [0.5, 0.5] },
            ease: "none",
          },
          1.6,
        )
        .to(
          "[data-packet='sdp2']",
          {
            opacity: 1,
            duration: 0.25,
            stagger: 0.3,
            motionPath: { path: "#sigPathB", align: "#sigPathB", alignOrigin: [0.5, 0.5] },
            ease: "none",
          },
          2.1,
        )
        // 4 — ICE candidates trickle both ways
        .to(
          "[data-packet='ice']",
          {
            opacity: 1,
            duration: 1.2,
            stagger: 0.18,
            motionPath: { path: "#sigPathB", align: "#sigPathB", alignOrigin: [0.5, 0.5], start: 1, end: 0 },
            ease: "none",
          },
          2.8,
        )
        .to("[data-packet]", { opacity: 0, duration: 0.4 }, 4.1)
        // 5 — the direct path draws and the server recedes
        .to("[data-p2p-line]", { opacity: 1, drawSVG: "100%", duration: 1.6, ease: "power2.inOut" }, 4.2)
        .to("[data-server]", { opacity: 0.22, scale: 0.82, duration: 1.2, transformOrigin: "center" }, 4.4)
        .to("[data-sig-line]", { opacity: 0.12, duration: 1 }, 4.4)
        /*
         * The browsers drift toward each other once the direct path exists.
         * It is a small move, but it is the moment the diagram stops being
         * "A and B both talk to a server" and becomes "A and B talk".
         */
        .to("[data-browser='a']", { x: 46, duration: 1.4, ease: "power2.inOut" }, 4.4)
        .to("[data-browser='b']", { x: -46, duration: 1.4, ease: "power2.inOut" }, 4.4)
        .to("[data-p2p-line]", { strokeWidth: 7, duration: 1.2 }, 4.6)
        .to("[data-p2p-glow]", { opacity: 1, duration: 1.2 }, 4.6)
        .to("[data-p2p-label]", { opacity: 1, y: 0, duration: 0.8 }, 5.0)
        /*
         * Media packets. They are faster and denser than the signalling
         * packets above — once the direct path is up, traffic accelerates.
         */
        .fromTo(
          "[data-media-packet]",
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.9,
            stagger: 0.14,
            repeat: 3,
            motionPath: { path: "#p2pPath", align: "#p2pPath", alignOrigin: [0.5, 0.5] },
            ease: "none",
          },
          5.2,
        );

      /*
       * SIGNAL PULSES (section 8)
       *
       * Each pulse accelerates along the signalling path, glows, drags a
       * short trail of fading followers, and vanishes on arrival. They are
       * on their own timelines rather than the scrubbed one so they play at
       * a readable speed regardless of how fast the user scrolls.
       */
      const pulseTls = PULSES.map((cfg, i) => {
        const head = `[data-pulse='${i}']`;
        const trail = `[data-pulse-trail='${i}']`;
        const t = gsap.timeline({ paused: true });

        t.set([head, trail], { opacity: 0 })
          .fromTo(
            head,
            { opacity: 0, scale: 0.4 },
            { opacity: 1, scale: 1, duration: 0.18, ease: "power2.out" },
            0,
          )
          .to(
            head,
            {
              duration: 1.05,
              // Accelerating departure, decelerating arrival.
              ease: "power2.inOut",
              motionPath: {
                path: cfg.path,
                align: cfg.path,
                alignOrigin: [0.5, 0.5],
                start: cfg.reverse ? 1 : 0,
                end: cfg.reverse ? 0 : 1,
              },
            },
            0,
          )
          .to(head, { opacity: 0, scale: 0.5, duration: 0.2 }, 0.95)
          // Trail: same path, staggered slightly behind, dimmer.
          .fromTo(
            trail,
            { opacity: 0 },
            {
              opacity: 0.55,
              duration: 1.05,
              stagger: 0.05,
              ease: "power2.inOut",
              motionPath: {
                path: cfg.path,
                align: cfg.path,
                alignOrigin: [0.5, 0.5],
                start: cfg.reverse ? 1 : 0,
                end: cfg.reverse ? 0 : 1,
              },
            },
            0.06,
          )
          .to(trail, { opacity: 0, duration: 0.25 }, 0.9);

        return t;
      });

      // Fire each pulse once, as the scrub passes its point in the sequence.
      PULSES.forEach((cfg, i) => {
        tl.call(
          () => {
            pulseTls[i]?.restart();
          },
          undefined,
          cfg.at,
        );
      });

      // Narrative text follows the scroll independently of the scrub.
      STAGES.forEach((_, i) => {
        gsap.timeline({
          scrollTrigger: {
            trigger: `[data-arch-stage='${i}']`,
            start: "top 65%",
            end: "bottom 65%",
            onEnter: () => setStage(i),
            onEnterBack: () => setStage(i),
          },
        });
      });
    },
    { scope: root },
  );

  const current = STAGES[stage] ?? STAGES[0];

  return (
    /*
     * Two columns on desktop so the diagram can stay pinned beside the text
     * without the narrative scrolling over it. On small screens the diagram
     * sits above the narrative and does not stick — a pinned panel would eat
     * most of a phone viewport.
     */
    <div ref={root} className="mt-14 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-10">
      {/* ------------------------------------------------------- diagram */}
      <div className="glass rounded-3xl p-4 sm:p-6 lg:sticky lg:top-28">
        <svg
          viewBox="0 0 800 260"
          className="w-full"
          role="img"
          aria-label="Diagram: two browsers exchange setup messages through a signaling server, then connect directly to each other"
        >
          <defs>
            <linearGradient id="p2pGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="oklch(0.64 0.191 281)" />
              <stop offset="100%" stopColor="oklch(0.79 0.142 196)" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* signaling paths */}
          <path
            id="sigPathA"
            data-sig-line
            d="M 150 108 C 250 40, 320 40, 400 60"
            fill="none"
            stroke="oklch(0.64 0.191 281)"
            strokeWidth="2"
            strokeDasharray="6 6"
          />
          <path
            id="sigPathB"
            data-sig-line
            d="M 400 60 C 480 40, 550 40, 650 108"
            fill="none"
            stroke="oklch(0.64 0.191 281)"
            strokeWidth="2"
            strokeDasharray="6 6"
          />

          {/* direct peer-to-peer path */}
          <path
            id="p2pPath"
            data-p2p-line
            d="M 160 150 C 300 235, 500 235, 640 150"
            fill="none"
            stroke="url(#p2pGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0"
            filter="url(#glow)"
          />

          {/* signaling server */}
          <g data-server data-node>
            <rect x="330" y="20" width="140" height="56" rx="12" fill="oklch(0.2 0.02 265)" stroke="oklch(0.45 0.02 265)" strokeDasharray="4 4" />
            <text x="400" y="42" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="600">
              Signaling
            </text>
            <text x="400" y="60" textAnchor="middle" fill="#64748b" fontSize="10">
              never sees media
            </text>
          </g>

          {/* Glow under the direct path, revealed when it becomes dominant. */}
          <path
            data-p2p-glow
            d="M 160 150 C 300 235, 500 235, 640 150"
            fill="none"
            stroke="url(#p2pGrad)"
            strokeWidth="16"
            strokeLinecap="round"
            opacity="0"
            filter="url(#glow)"
            style={{ mixBlendMode: "screen" }}
          />

          {/* browsers */}
          <g data-node data-browser="a">
            <rect x="40" y="100" width="120" height="66" rx="14" fill="oklch(0.22 0.05 281)" stroke="oklch(0.64 0.191 281)" strokeWidth="2" />
            <text x="100" y="130" textAnchor="middle" fill="#f2f0ff" fontSize="14" fontWeight="600">
              Browser A
            </text>
            <text x="100" y="149" textAnchor="middle" fill="#a78bfa" fontSize="10">
              MediaStream
            </text>
          </g>
          <g data-node data-browser="b">
            <rect x="640" y="100" width="120" height="66" rx="14" fill="oklch(0.22 0.05 281)" stroke="oklch(0.64 0.191 281)" strokeWidth="2" />
            <text x="700" y="130" textAnchor="middle" fill="#f2f0ff" fontSize="14" fontWeight="600">
              Browser B
            </text>
            <text x="700" y="149" textAnchor="middle" fill="#a78bfa" fontSize="10">
              MediaStream
            </text>
          </g>

          <text
            data-p2p-label
            x="400"
            y="228"
            textAnchor="middle"
            fill="oklch(0.79 0.142 196)"
            fontSize="11"
            fontWeight="600"
            opacity="0"
          >
            audio · video · data — encrypted, direct
          </text>

          {/* packets */}
          {[0, 1, 2].map((i) => (
            <circle key={`sdp${i}`} data-packet="sdp" r="5" fill="oklch(0.78 0.14 281)" opacity="0" />
          ))}
          {[0, 1, 2].map((i) => (
            <circle key={`sdp2${i}`} data-packet="sdp2" r="5" fill="oklch(0.78 0.14 281)" opacity="0" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <circle key={`ice${i}`} data-packet="ice" r="4" fill="oklch(0.85 0.1 300)" opacity="0" />
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={`m${i}`} data-media-packet r="6" fill="oklch(0.85 0.13 196)" opacity="0" />
          ))}

          {/* Signal pulses: a bright head plus three fading trail dots. */}
          {PULSES.map((cfg, i) => (
            <g key={`pulse-${i}`}>
              {[0, 1, 2].map((k) => (
                <circle
                  key={k}
                  data-pulse-trail={i}
                  r={3.2 - k * 0.7}
                  fill="oklch(0.86 0.12 288)"
                  opacity="0"
                />
              ))}
              <circle
                data-pulse={i}
                r="6"
                fill="oklch(0.95 0.06 288)"
                opacity="0"
                filter="url(#glow)"
              />
            </g>
          ))}
        </svg>

        <div className="mt-3 flex gap-1.5">
          {STAGES.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-500",
                i <= stage ? "bg-violet" : "bg-white/10",
              )}
            />
          ))}
        </div>
        <p className="mt-2 text-center font-mono text-[11px] text-live">{current.label}</p>
      </div>

      {/* ----------------------------------------------------- narrative */}
      <ol className="space-y-20 lg:space-y-32">
        {STAGES.map((s, i) => (
          <li
            key={s.id}
            data-arch-stage={i}
            className={cn(
              "max-w-xl scroll-mt-32 transition-opacity duration-500",
              stage === i ? "opacity-100" : "opacity-45",
            )}
          >
            <p className={cn("font-mono text-xs transition-colors", stage === i ? "text-live" : "text-muted-foreground")}>
              {String(i + 1).padStart(2, "0")} · {s.label}
            </p>
            <h3 className="mt-2 text-xl font-medium tracking-tight sm:text-2xl">{s.title}</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
