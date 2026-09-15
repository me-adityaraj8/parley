"use client";

import { useRef } from "react";
import { Mic, MicOff, MonitorUp, Users, Video, VideoOff, X } from "lucide-react";
import type { LinkState, Participant } from "@/types";
import { useGSAP } from "@/lib/gsap";
import { panelIn, staggerUp } from "@/lib/animations";
import { avatarStyle, initials } from "@/lib/room";
import { cn } from "@/lib/utils";

interface ParticipantsPanelProps {
  open: boolean;
  participants: Participant[];
  onClose: () => void;
}

export function ParticipantsPanel({
  open,
  participants,
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

      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {participants.map((p) => (
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
            </div>
          </li>
        ))}
      </ul>
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
