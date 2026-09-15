"use client";

import { useEffect, useRef } from "react";
import { MicOff, MonitorUp, VideoOff, Wifi, WifiOff } from "lucide-react";
import type { Participant } from "@/types";
import { avatarStyle, initials } from "@/lib/room";
import { cn } from "@/lib/utils";

interface VideoTileProps {
  participant: Participant;
  /** Local preview must be mirrored and muted to avoid audio feedback. */
  isLocal?: boolean;
  className?: string;
  compact?: boolean;
}

export function VideoTile({
  participant,
  isLocal = false,
  className,
  compact = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { stream, media, link, speaking, name } = participant;
  const showVideo = Boolean(stream) && (media.video || media.screen);

  /**
   * srcObject cannot be set as a JSX attribute — it takes a MediaStream
   * object, not a string, so React's DOM property handling skips it. It must
   * be assigned imperatively.
   */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    if (stream) {
      // Autoplay can be rejected if the browser has not seen a user gesture.
      // Muted playback is always allowed, so local preview never fails; for
      // remote tiles we simply ignore the rejection rather than crash.
      void el.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div
      data-tile={participant.id}
      data-speaking={speaking || undefined}
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-surface",
        "border border-hairline bevel",
        "transition-shadow duration-500",
        speaking && "glow-live",
        className,
      )}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          // Muting the local tile is mandatory: an unmuted local preview
          // routes your mic straight back to your speakers.
          muted={isLocal}
          className={cn(
            "size-full object-cover",
            // Mirror only the local camera — never a shared screen, and
            // never a remote peer (you'd be reading their text backwards).
            isLocal && !media.screen && "-scale-x-100",
            media.screen && "object-contain bg-void",
          )}
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <div
            className={cn(
              "flex items-center justify-center rounded-full font-medium tracking-tight",
              compact ? "size-12 text-sm" : "size-20 text-2xl",
            )}
            style={avatarStyle(participant.id)}
            aria-hidden
          >
            {initials(name)}
          </div>
        </div>
      )}

      {/* Bottom scrim keeps the name legible over bright video. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-3">
        <span
          className={cn(
            "truncate font-medium text-white drop-shadow",
            compact ? "text-xs" : "text-sm",
          )}
        >
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

      {/* Active-speaker ring: a border, not a flash. Animating box-shadow on
          a separate layer avoids repainting the video itself. */}
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
  const label = failed
    ? `Connection to ${name} failed`
    : `Connecting to ${name}`;

  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "flex size-6 items-center justify-center rounded-full backdrop-blur-md",
        failed ? "bg-danger/25 text-danger" : "bg-warn/20 text-warn",
      )}
    >
      {failed ? (
        <WifiOff className="size-3" aria-hidden />
      ) : (
        <Wifi className="size-3 animate-pulse" aria-hidden />
      )}
    </span>
  );
}
