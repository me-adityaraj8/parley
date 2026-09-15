"use client";

import { useEffect, useRef, useState } from "react";
import {
  Hand,
  Maximize2,
  MicOff,
  Minimize2,
  MonitorUp,
  Volume2,
  VideoOff,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { Participant } from "@/types";
import { avatarStyle, initials } from "@/lib/room";
import { cn } from "@/lib/utils";

interface VideoTileProps {
  participant: Participant;
  isLocal?: boolean;
  className?: string;
  compact?: boolean;
  spotlighted?: boolean;
  onSpotlight?: (id: string | null) => void;
  onVolume?: (id: string, volume: number) => void;
}

export function VideoTile({
  participant,
  isLocal = false,
  className,
  compact = false,
  spotlighted = false,
  onSpotlight,
  onVolume,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const { stream, media, link, speaking, level, name, handRaised, volume } = participant;
  const showVideo = Boolean(stream) && (media.video || media.screen);

  /**
   * srcObject cannot be a JSX attribute — it takes a MediaStream object, not
   * a string, so React's DOM property handling skips it.
   */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) void el.play().catch(() => {});
  }, [stream]);

  /**
   * Per-participant volume is applied to the local media element only. It
   * changes nothing for anyone else in the call — this is playback, not a
   * mute broadcast.
   */
  useEffect(() => {
    const el = videoRef.current;
    if (el && !isLocal) el.volume = volume;
  }, [volume, isLocal]);

  return (
    <div
      data-tile={participant.id}
      data-speaking={speaking || undefined}
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-surface",
        "border border-hairline bevel transition-shadow duration-500",
        speaking && "glow-live",
        className,
      )}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn(
            "size-full object-cover",
            isLocal && !media.screen && "-scale-x-100",
            media.screen && "bg-void object-contain",
          )}
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          {/*
            The avatar ring scales with real microphone RMS, so it breathes
            with the speaker's voice instead of pulsing on a fixed timer.
          */}
          <div className="relative">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-live/25 transition-transform duration-100"
              style={{
                transform: `scale(${1 + Math.min(level, 1) * 0.55})`,
                opacity: media.audio ? 0.35 + Math.min(level, 1) * 0.5 : 0,
              }}
            />
            <div
              className={cn(
                "relative flex items-center justify-center rounded-full font-medium tracking-tight",
                compact ? "size-12 text-sm" : "size-20 text-2xl",
              )}
              style={avatarStyle(participant.id)}
              aria-hidden
            >
              {initials(name)}
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />

      {/* Hover affordances — hidden until needed to keep the call clean. */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {onSpotlight && (
          <button
            type="button"
            onClick={() => onSpotlight(spotlighted ? null : participant.id)}
            aria-label={spotlighted ? `Remove spotlight from ${name}` : `Spotlight ${name}`}
            className="flex size-7 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-md transition-colors hover:bg-black/70"
          >
            {spotlighted ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        )}
        {!isLocal && onVolume && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setVolumeOpen((v) => !v)}
              aria-label={`Volume for ${name}`}
              aria-expanded={volumeOpen}
              className="flex size-7 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-md transition-colors hover:bg-black/70"
            >
              <Volume2 className="size-3.5" />
            </button>
            {volumeOpen && (
              <div className="glass-strong absolute right-0 top-9 z-20 w-36 rounded-xl p-3">
                <label className="text-[10px] text-muted-foreground" htmlFor={`vol-${participant.id}`}>
                  Volume · local only
                </label>
                <input
                  id={`vol-${participant.id}`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => onVolume(participant.id, Number(e.target.value))}
                  className="mt-1.5 w-full accent-violet"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {handRaised && (
        <span
          data-hand
          className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-warn/20 px-2 py-1 text-[10px] text-warn backdrop-blur-md"
        >
          <Hand className="size-3" aria-hidden />
          <span className="sr-only">{name} raised their hand</span>
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-3">
        <span className={cn("truncate font-medium text-white drop-shadow", compact ? "text-xs" : "text-sm")}>
          {name}
          {isLocal && <span className="ml-1 text-white/60">(you)</span>}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {media.screen && (
            <Badge tone="live" label="Sharing screen">
              <MonitorUp className="size-3" aria-hidden />
            </Badge>
          )}
          {!media.audio && (
            <Badge tone="danger" label={`${name} is muted`}>
              <MicOff className="size-3" aria-hidden />
            </Badge>
          )}
          {!media.video && !media.screen && (
            <Badge tone="muted" label={`${name} has their camera off`}>
              <VideoOff className="size-3" aria-hidden />
            </Badge>
          )}
          {!isLocal && <LinkIndicator state={link} name={name} />}
        </div>
      </div>

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset transition-opacity duration-300",
          speaking ? "opacity-100 ring-live/70" : "opacity-0 ring-transparent",
        )}
      />
    </div>
  );
}

function Badge({
  tone,
  label,
  children,
}: {
  tone: "live" | "danger" | "muted";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "flex size-6 items-center justify-center rounded-full backdrop-blur-md",
        tone === "live" && "bg-live/20 text-live",
        tone === "danger" && "bg-danger/25 text-danger",
        tone === "muted" && "bg-white/15 text-white/80",
      )}
    >
      {children}
    </span>
  );
}

function LinkIndicator({ state, name }: { state: Participant["link"]; name: string }) {
  if (state === "connected") return null;
  const failed = state === "failed" || state === "closed";
  const label = failed ? `Connection to ${name} failed` : `Connecting to ${name}`;
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "flex size-6 items-center justify-center rounded-full backdrop-blur-md",
        failed ? "bg-danger/25 text-danger" : "bg-warn/20 text-warn",
      )}
    >
      {failed ? <WifiOff className="size-3" aria-hidden /> : <Wifi className="size-3 animate-pulse" aria-hidden />}
    </span>
  );
}
