"use client";

import { useRef } from "react";
import { Hand, Maximize2, Mic, MicOff, MonitorUp, Users, Video, VideoOff, X } from "lucide-react";
import type { LinkState, Participant } from "@/types";
import { useGSAP } from "@/lib/gsap";
import { panelIn, staggerUp } from "@/lib/animations";
import { avatarStyle, initials } from "@/lib/room";
import { cn } from "@/lib/utils";

interface ParticipantsPanelProps {
  open: boolean;
  participants: Participant[];
  spotlightId: string | null;
  onSpotlight: (id: string | null) => void;
  onVolume: (id: string, volume: number) => void;
  onClose: () => void;
}

export function ParticipantsPanel({
  open,
  participants,
  spotlightId,
  onSpotlight,
  onVolume,
  onClose,
}: ParticipantsPanelProps) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!open || !root.current) return;
      panelIn(root.current, "right");
      staggerUp("[data-row]", { y: 12, duration: 0.45, delay: 0.1 });
    },
    { scope: root, dependencies: [open] },
  );

  if (!open) return null;

  return (
    <aside
      ref={root}
      aria-label="Participants"
      className="glass-strong flex h-full w-full flex-col rounded-2xl sm:w-80"
    >
      <header className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <Users className="size-4 text-violet" aria-hidden />
        <h2 className="text-sm font-medium">
          Participants
          <span className="ml-1.5 text-muted-foreground tabular-nums">
            {participants.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close participants"
          className="ml-auto flex size-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      {participants.some((p) => p.handRaised) && (
        <div className="border-b border-hairline px-4 py-2">
          <p className="flex items-center gap-1.5 text-[11px] text-warn">
            <Hand className="size-3" aria-hidden />
            {participants.filter((p) => p.handRaised).length} hand
            {participants.filter((p) => p.handRaised).length === 1 ? "" : "s"} raised
          </p>
        </div>
      )}

      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {[...participants]
          .sort((a, b) => Number(b.handRaised) - Number(a.handRaised))
          .map((p) => (
          <li
            key={p.id}
            data-row
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/5"
          >
            <span
              className={cn(
                "relative flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                p.speaking && "ring-2 ring-live ring-offset-2 ring-offset-transparent",
              )}
              style={avatarStyle(p.id)}
              aria-hidden
            >
              {initials(p.name)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {p.name}
                {p.isLocal && <span className="ml-1 text-muted-foreground">(you)</span>}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {p.isLocal ? "This device" : linkLabel(p.link)}
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              {p.handRaised && <Hand className="size-4 text-warn" aria-label="Hand raised" />}
              {p.media.screen && (
                <MonitorUp className="size-4 text-live" aria-label="Sharing screen" />
              )}
              {p.media.audio ? (
                <Mic className="size-4" aria-label="Microphone on" />
              ) : (
                <MicOff className="size-4 text-danger" aria-label="Muted" />
              )}
              {p.media.video ? (
                <Video className="size-4" aria-label="Camera on" />
              ) : (
                <VideoOff className="size-4 text-danger" aria-label="Camera off" />
              )}
              <button
                type="button"
                onClick={() => onSpotlight(spotlightId === p.id ? null : p.id)}
                aria-label={spotlightId === p.id ? `Remove spotlight from ${p.name}` : `Spotlight ${p.name}`}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full transition-colors",
                  spotlightId === p.id ? "bg-violet text-white" : "hover:bg-white/10",
                )}
              >
                <Maximize2 className="size-3" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t border-hairline p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Playback volume
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/70">
          Adjusting a participant&rsquo;s volume changes only what you hear. It
          does not mute them for anyone else.
        </p>
        <div className="mt-2 space-y-2">
          {participants
            .filter((p) => !p.isLocal)
            .map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="w-20 truncate text-[11px]">{p.name}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={p.volume}
                  onChange={(e) => onVolume(p.id, Number(e.target.value))}
                  aria-label={`Volume for ${p.name}`}
                  className="flex-1 accent-violet"
                />
              </div>
            ))}
          {participants.filter((p) => !p.isLocal).length === 0 && (
            <p className="text-[11px] text-muted-foreground">No one else here yet.</p>
          )}
        </div>
      </div>
    </aside>
  );
}

function linkLabel(state: LinkState): string {
  switch (state) {
    case "connected":
      return "Connected peer-to-peer";
    case "connecting":
    case "new":
      return "Connecting…";
    case "reconnecting":
      return "Reconnecting…";
    case "failed":
      return "Connection failed";
    case "closed":
      return "Disconnected";
  }
}
