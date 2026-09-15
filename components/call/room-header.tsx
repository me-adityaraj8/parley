"use client";

import { useState } from "react";
import { Check, Copy, Users } from "lucide-react";
import type { LinkState, SignalingState } from "@/types";
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${roomId}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the URL is visible in the address bar anyway */
    }
  };

  const status = deriveStatus(signaling, worstLink, participantCount);

  return (
    <header className="pt-safe flex items-center gap-3 px-3 sm:px-5">
      <div className="glass flex min-w-0 items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5">
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
            <Check className="size-3.5 text-live" aria-hidden />
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
