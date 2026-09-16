"use client";

import { useRef, useState } from "react";
import { Check, Copy, Users } from "lucide-react";
import type { LinkState, SignalingState } from "@/types";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface RoomHeaderProps {
  roomId: string;
  participantCount: number;
  signaling: SignalingState;
  worstLink: LinkState;
}

export function RoomHeader({
  roomId,
  participantCount,
  signaling,
  worstLink,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);
  const idRef = useRef<HTMLDivElement>(null);

  /**
   * Copy confirmation.
   *
   * The identity chip lifts toward the viewer, a ring expands away from it,
   * and a pulse runs around the border — a physical "received" gesture
   * rather than a label swap. Everything animates transform and opacity, so
   * it stays on the compositor while a call is decoding video.
   */
  const playCopyAnimation = () => {
    const el = idRef.current;
    if (!el || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.timeline()
        .set(el, { transformPerspective: 600, transformStyle: "preserve-3d" })
        .to(el, { z: 26, scale: 1.05, duration: 0.22, ease: "back.out(2.4)" }, 0)
        .to(el, { z: 0, scale: 1, duration: 0.5, ease: "power3.out" }, 0.24)
        .fromTo(
          "[data-copy-ring]",
          { opacity: 0.9, scale: 0.9 },
          { opacity: 0, scale: 1.7, duration: 0.7, ease: "power2.out" },
          0,
        )
        .fromTo(
          "[data-copy-pulse]",
          { opacity: 0, offsetDistance: "0%" },
          { opacity: 1, offsetDistance: "100%", duration: 0.75, ease: "power1.inOut" },
          0.05,
        )
        .to("[data-copy-pulse]", { opacity: 0, duration: 0.2 }, 0.7)
        .fromTo(
          "[data-copy-check]",
          { scale: 0.3, opacity: 0, rotate: -35 },
          { scale: 1, opacity: 1, rotate: 0, duration: 0.34, ease: "back.out(3)" },
          0.12,
        );
    }, el);

    window.setTimeout(() => ctx.revert(), 1900);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${roomId}`);
      setCopied(true);
      playCopyAnimation();
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the URL is visible in the address bar anyway */
    }
  };

  const status = deriveStatus(signaling, worstLink, participantCount);

  return (
    <header className="pt-safe flex items-center gap-3 px-3 sm:px-5">
      <div
        ref={idRef}
        className="glass relative flex min-w-0 items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5"
      >
        {/* Expanding ring, and a dot that runs the chip's outline. */}
        <span
          data-copy-ring
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border border-live/70 opacity-0"
        />
        <span
          data-copy-pulse
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 size-1.5 rounded-full bg-live opacity-0"
          style={{
            offsetPath: "rect(0% 100% 100% 0% round 999px)",
            offsetRotate: "0deg",
            boxShadow: "0 0 10px 2px oklch(0.79 0.142 196 / 70%)",
          }}
        />
        <span
          className={cn("size-2 shrink-0 rounded-full", status.dot)}
          aria-hidden
        />
        <span className="sr-only">{status.label}</span>
        <code className="truncate font-mono text-xs text-muted-foreground sm:text-sm">
          {roomId}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy invite link"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-white/15"
        >
          {copied ? (
            <Check data-copy-check className="size-3.5 text-live" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
        </button>
      </div>

      <div className="glass ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5">
        <Users className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs tabular-nums sm:text-sm">{participantCount}</span>
      </div>

      <span
        className={cn(
          "glass hidden rounded-full px-3 py-1.5 text-xs sm:block",
          status.tone,
        )}
      >
        {status.label}
      </span>
    </header>
  );
}

function deriveStatus(
  signaling: SignalingState,
  worstLink: LinkState,
  count: number,
): { label: string; dot: string; tone: string } {
  if (signaling === "error" || worstLink === "failed") {
    return { label: "Connection problem", dot: "bg-danger", tone: "text-danger" };
  }
  if (signaling === "reconnecting" || worstLink === "reconnecting") {
    return { label: "Reconnecting…", dot: "bg-warn animate-pulse", tone: "text-warn" };
  }
  if (count <= 1) {
    return { label: "Waiting for others", dot: "bg-warn", tone: "text-muted-foreground" };
  }
  if (worstLink === "connected") {
    return { label: "Connected peer-to-peer", dot: "bg-live", tone: "text-live" };
  }
  return { label: "Connecting…", dot: "bg-warn animate-pulse", tone: "text-muted-foreground" };
}
