"use client";

import { useEffect, useRef } from "react";
import { Activity, ChevronDown, X } from "lucide-react";
import type { CallHealth, CallStats } from "@/types/stats";
import { gsap, useGSAP } from "@/lib/gsap";
import { panelIn, prefersReducedMotion } from "@/lib/animations";
import { cn } from "@/lib/utils";

const HEALTH_LABEL: Record<CallHealth, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  unknown: "Measuring…",
};

const HEALTH_TONE: Record<CallHealth, string> = {
  excellent: "text-live",
  good: "text-live",
  fair: "text-warn",
  poor: "text-danger",
  unknown: "text-muted-foreground",
};

export function DiagnosticsPanel({
  stats,
  onClose,
}: {
  stats: CallStats | null;
  onClose: () => void;
}) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (root.current) panelIn(root.current, "right");
    },
    { scope: root },
  );

  return (
    <aside
      ref={root}
      aria-label="Call diagnostics"
      className="glass-strong flex h-full w-full flex-col rounded-2xl sm:w-80"
    >
      <header className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <Activity className="size-4 text-violet" aria-hidden />
        <h2 className="text-sm font-medium">Call diagnostics</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close diagnostics"
          className="ml-auto flex size-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {!stats ? (
          <p className="pt-8 text-center text-xs text-muted-foreground">
            Diagnostics appear once you are connected to someone.
          </p>
        ) : (
          <>
            <section>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Call health
              </p>
              <p className={cn("mt-1 text-2xl font-semibold tracking-tight", HEALTH_TONE[stats.health])}>
                {HEALTH_LABEL[stats.health]}
              </p>
              <div className="mt-3 space-y-1.5">
                <Metric label="Round trip" value={stats.rttMs} unit="ms" digits={0} />
                <Metric label="Jitter" value={stats.jitterMs} unit="ms" digits={1} />
                <Metric label="Packet loss" value={stats.lossPct} unit="%" digits={2} />
              </div>
            </section>

            {stats.peers.map((p) => (
              <section key={p.peerId} className="rounded-xl border border-hairline bg-white/[0.03] p-3">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium">{p.peerName}</span>
                  <span className={cn("ml-auto text-[10px]", HEALTH_TONE[p.health])}>
                    {HEALTH_LABEL[p.health]}
                  </span>
                </div>

                <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Video
                </p>
                <div className="mt-1 space-y-1.5">
                  <Row label="Resolution" text={p.video.width ? `${p.video.width} × ${p.video.height}` : "—"} />
                  <Metric label="Frame rate" value={p.video.fps} unit="fps" digits={0} />
                  <Metric label="Bitrate" value={p.video.kbps} unit="kbps" digits={0} />
                  <Row label="Codec" text={p.video.codec || "—"} />
                </div>

                <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Audio
                </p>
                <div className="mt-1 space-y-1.5">
                  <Metric label="Bitrate" value={p.audio.kbps} unit="kbps" digits={0} />
                  <Metric label="Jitter" value={p.audio.jitterMs} unit="ms" digits={1} />
                  <Metric label="Packets lost" value={p.audio.packetsLost} unit="" digits={0} />
                  <Row label="Codec" text={p.audio.codec || "—"} />
                </div>

                <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Transport
                </p>
                <div className="mt-1 space-y-1.5">
                  <Row label="Connection" text={p.connectionState} />
                  <Row label="ICE" text={p.iceState} />
                  <Row label="Candidate pair" text={p.candidatePair} />
                  <Row
                    label="Path"
                    text={p.relayed ? "Relayed (TURN)" : "Direct"}
                    tone={p.relayed ? "text-warn" : "text-live"}
                  />
                  {p.availableOutgoingKbps > 0 && (
                    <Metric label="Est. uplink" value={p.availableOutgoingKbps} unit="kbps" digits={0} />
                  )}
                </div>
              </section>
            ))}

            <p className="flex items-center gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
              <ChevronDown className="size-3 shrink-0" aria-hidden />
              Values come from <code className="font-mono">RTCPeerConnection.getStats()</code>,
              sampled once per second and differentiated against the previous
              sample.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}

function Row({ label, text, tone }: { label: string; text: string; tone?: string }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("ml-auto truncate font-mono text-[11px]", tone)}>{text}</span>
    </div>
  );
}

/**
 * Tweens the displayed number instead of snapping it.
 *
 * Stats update once a second; snapping makes the panel feel like it is
 * flickering. GSAP interpolates the value in a ref and writes textContent
 * directly, so a 60fps counter animation costs zero React renders.
 */
function Metric({
  label,
  value,
  unit,
  digits,
}: {
  label: string;
  value: number;
  unit: string;
  digits: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      current.current = value;
      el.textContent = `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
      return;
    }
    const obj = { v: current.current };
    const tween = gsap.to(obj, {
      v: value,
      duration: 0.6,
      ease: "power2.out",
      onUpdate: () => {
        current.current = obj.v;
        el.textContent = `${obj.v.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
      },
    });
    return () => {
      tween.kill();
    };
  }, [value, digits, unit]);

  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span ref={ref} className="ml-auto font-mono text-[11px] tabular-nums" />
    </div>
  );
}
