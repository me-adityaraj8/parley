"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  label: string;
  title: string;
  body: string;
}

const STAGES: Stage[] = [
  {
    id: "media",
    label: "getUserMedia",
    title: "The browser captures you",
    body: "getUserMedia() asks permission, then hands back a MediaStream containing one audio track and one video track. Tracks — not streams — are the real unit of WebRTC: you send them, replace them, and mute them individually.",
  },
  {
    id: "signal",
    label: "Signaling",
    title: "Two browsers are introduced",
    body: "WebRTC has no opinion about how peers find each other. Parley uses PartyKit: browser A's offer is relayed to browser B, and B's answer comes back. This carries setup text only — never a single frame of video.",
  },
  {
    id: "sdp",
    label: "Offer / Answer",
    title: "They agree on a language",
    body: "An SDP offer describes what A can send and receive — codecs, resolutions, encryption parameters. B replies with an answer describing the intersection of what they both support.",
  },
  {
    id: "ice",
    label: "ICE / STUN",
    title: "They find a route",
    body: "Both peers sit behind NAT and don't know their own public address. A STUN server tells each one how the internet sees it. Every possible route becomes an ICE candidate, and the two sides test pairs until one works.",
  },
  {
    id: "p2p",
    label: "P2P connected",
    title: "The server steps out",
    body: "Once a candidate pair succeeds, DTLS negotiates keys and media flows directly between the browsers. The signaling server is now idle — if it went offline, your call would continue.",
  },
];

/**
 * Interactive architecture walkthrough.
 *
 * This is the section that earns the project its "advanced WebRTC" claim on
 * a portfolio: it shows the reader that the author understands the handshake
 * rather than having copied a tutorial.
 */
export function TechFlow() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      // Packets travelling along the signaling path, then the P2P path.
      gsap.to("[data-packet='signal']", {
        motionPath: undefined,
        keyframes: [{ xPercent: 0 }, { xPercent: 100 }],
        duration: 1.8,
        repeat: -1,
        ease: "power1.inOut",
        stagger: 0.6,
      });

      gsap.fromTo(
        "[data-flow-node]",
        { opacity: 0, scale: 0.9 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: "back.out(1.6)",
          scrollTrigger: { trigger: root.current, start: "top 70%" },
        },
      );
    },
    { scope: root },
  );

  // Advance the highlighted stage as the section scrolls.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const triggers = STAGES.map((_, i) =>
        gsap.timeline({
          scrollTrigger: {
            trigger: `[data-stage='${i}']`,
            start: "top 60%",
            end: "bottom 60%",
            onEnter: () => setActive(i),
            onEnterBack: () => setActive(i),
          },
        }),
      );
      return () => triggers.forEach((t) => t.kill());
    },
    { scope: root },
  );

  const current = STAGES[active] ?? STAGES[0]!;

  return (
    <section
      id="tech"
      ref={root}
      className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-violet">
          Architecture
        </p>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          What actually happens when you call
        </h2>
        <p className="mt-4 text-balance leading-relaxed text-muted-foreground">
          The signaling server introduces two browsers. After that it has no
          role in the conversation.
        </p>
      </div>

      {/* ------------------------------------------------------- diagram */}
      <div className="glass mt-14 rounded-3xl p-6 sm:p-10">
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
          <FlowNode label="Browser A" tone="violet" active={active >= 0} />

          <FlowPath
            label="Signaling"
            sublabel="SDP + ICE candidates"
            dashed
            active={active >= 1 && active <= 3}
          />

          <FlowNode
            label="PartyKit"
            sublabel="signaling only"
            tone="muted"
            dimmed={active >= 4}
            active={active >= 1}
          />

          <FlowPath
            label="Signaling"
            sublabel="relayed, not stored"
            dashed
            active={active >= 1 && active <= 3}
          />

          <FlowNode label="Browser B" tone="violet" active={active >= 0} />
        </div>

        {/* The direct path, drawn under the relay path. */}
        <div className="relative mt-6 flex items-center gap-3 rounded-2xl border border-live/25 bg-live/5 p-4">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full transition-colors",
              active >= 4 ? "bg-live" : "bg-muted-foreground/40",
            )}
          />
          <p className="text-xs sm:text-sm">
            <span className={cn(active >= 4 ? "text-live" : "text-muted-foreground")}>
              WebRTC peer-to-peer
            </span>
            <span className="text-muted-foreground">
              {" "}
              — audio, video and data channel, encrypted end to end
            </span>
          </p>
          {active >= 4 && (
            <span className="ml-auto hidden rounded-full bg-live/15 px-2.5 py-1 text-[10px] text-live sm:block">
              server no longer involved
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------ narrative */}
      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ol className="space-y-24">
          {STAGES.map((stage, i) => (
            <li key={stage.id} data-stage={i} className="scroll-mt-32">
              <p
                className={cn(
                  "font-mono text-xs transition-colors",
                  active === i ? "text-live" : "text-muted-foreground",
                )}
              >
                {String(i + 1).padStart(2, "0")} · {stage.label}
              </p>
              <h3 className="mt-2 text-xl font-medium tracking-tight sm:text-2xl">
                {stage.title}
              </h3>
              <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
                {stage.body}
              </p>
            </li>
          ))}
        </ol>

        {/* Sticky summary mirrors the scroll position on large screens. */}
        <aside className="hidden lg:block">
          <div className="glass sticky top-28 rounded-2xl p-6">
            <p className="font-mono text-xs text-live">{current.label}</p>
            <h4 className="mt-2 font-medium tracking-tight">{current.title}</h4>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {current.body}
            </p>
            <div className="mt-5 flex gap-1.5">
              {STAGES.map((s, i) => (
                <span
                  key={s.id}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors duration-500",
                    i <= active ? "bg-violet" : "bg-white/10",
                  )}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function FlowNode({
  label,
  sublabel,
  tone,
  active,
  dimmed,
}: {
  label: string;
  sublabel?: string;
  tone: "violet" | "muted";
  active?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div
      data-flow-node
      className={cn(
        "flex-1 rounded-2xl border p-4 text-center transition-all duration-500",
        tone === "violet"
          ? "border-violet/30 bg-violet/10"
          : "border-hairline bg-white/5",
        active ? "opacity-100" : "opacity-50",
        dimmed && "opacity-35 saturate-50",
      )}
    >
      <p className="text-sm font-medium">{label}</p>
      {sublabel && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}

function FlowPath({
  label,
  sublabel,
  dashed,
  active,
}: {
  label: string;
  sublabel?: string;
  dashed?: boolean;
  active?: boolean;
}) {
  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2">
      <span
        className={cn(
          "h-px w-full transition-opacity duration-500",
          dashed
            ? "bg-[repeating-linear-gradient(90deg,currentColor_0_6px,transparent_6px_12px)]"
            : "bg-current",
          active ? "text-violet opacity-100" : "text-muted-foreground opacity-40",
        )}
      />
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {sublabel && (
        <span className="text-[10px] text-muted-foreground/60">{sublabel}</span>
      )}
    </div>
  );
}
