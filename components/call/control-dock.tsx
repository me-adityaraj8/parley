"use client";

import { useRef } from "react";
import {
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { pressFeedback } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { PanelId } from "@/types";

interface ControlDockProps {
  audio: boolean;
  video: boolean;
  sharing: boolean;
  screenShareSupported: boolean;
  panel: PanelId;
  unreadCount: number;
  participantCount: number;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleShare: () => void;
  onPanel: (panel: PanelId) => void;
  onLeave: () => void;
}

export function ControlDock({
  audio,
  video,
  sharing,
  screenShareSupported,
  panel,
  unreadCount,
  participantCount,
  onToggleAudio,
  onToggleVideo,
  onToggleShare,
  onPanel,
  onLeave,
}: ControlDockProps) {
  return (
    <div
      className={cn(
        "glass-strong pb-safe flex items-center gap-1.5 rounded-2xl p-2 sm:gap-2 sm:rounded-full sm:p-2.5",
        "shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)]",
      )}
      role="toolbar"
      aria-label="Call controls"
    >
      <DockButton
        label={audio ? "Mute microphone" : "Unmute microphone"}
        shortcut="M"
        active={!audio}
        danger={!audio}
        onClick={onToggleAudio}
      >
        {audio ? <Mic className="size-5" /> : <MicOff className="size-5" />}
      </DockButton>

      <DockButton
        label={video ? "Turn camera off" : "Turn camera on"}
        shortcut="V"
        active={!video}
        danger={!video}
        onClick={onToggleVideo}
      >
        {video ? <Video className="size-5" /> : <VideoOff className="size-5" />}
      </DockButton>

      {screenShareSupported && (
        <DockButton
          label={sharing ? "Stop sharing" : "Share your screen"}
          shortcut="S"
          active={sharing}
          accent={sharing}
          onClick={onToggleShare}
        >
          {sharing ? <MonitorX className="size-5" /> : <MonitorUp className="size-5" />}
        </DockButton>
      )}

      <span className="mx-1 hidden h-7 w-px bg-hairline sm:block" aria-hidden />

      <DockButton
        label="Chat"
        shortcut="C"
        active={panel === "chat"}
        badge={unreadCount > 0 ? unreadCount : undefined}
        onClick={() => onPanel(panel === "chat" ? null : "chat")}
      >
        <MessageSquare className="size-5" />
      </DockButton>

      <DockButton
        label="Participants"
        shortcut="P"
        active={panel === "participants"}
        badge={participantCount}
        badgeTone="neutral"
        onClick={() => onPanel(panel === "participants" ? null : "participants")}
      >
        <Users className="size-5" />
      </DockButton>

      <span className="mx-1 hidden h-7 w-px bg-hairline sm:block" aria-hidden />

      <DockButton label="Leave call" leave onClick={onLeave}>
        <PhoneOff className="size-5" />
      </DockButton>
    </div>
  );
}

interface DockButtonProps {
  label: string;
  shortcut?: string;
  active?: boolean;
  danger?: boolean;
  accent?: boolean;
  leave?: boolean;
  badge?: number;
  badgeTone?: "accent" | "neutral";
  onClick: () => void;
  children: React.ReactNode;
}

function DockButton({
  label,
  shortcut,
  active,
  danger,
  accent,
  leave,
  badge,
  badgeTone = "accent",
  onClick,
  children,
}: DockButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (ref.current) pressFeedback(ref.current);
    onClick();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          onClick={handleClick}
          aria-label={label}
          aria-pressed={leave ? undefined : Boolean(active)}
          className={cn(
            "relative flex size-11 items-center justify-center rounded-full sm:size-12",
            "transition-colors duration-200 outline-none",
            "focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            // Default: quiet. Only state changes earn colour.
            !active && !leave && "bg-white/5 text-foreground hover:bg-white/10",
            danger && "bg-danger/20 text-danger hover:bg-danger/25",
            accent && "bg-live/20 text-live hover:bg-live/25",
            active && !danger && !accent && "bg-white/15 text-foreground",
            // Leave is distinct but not alarming — it is a normal action,
            // not a destructive one.
            leave && "bg-danger/90 text-white hover:bg-danger",
          )}
        >
          {children}
          {badge !== undefined && badge > 0 && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                badgeTone === "accent"
                  ? "bg-violet text-white"
                  : "bg-white/20 text-foreground",
              )}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={10}>
        {label}
        {shortcut && (
          <kbd className="ml-2 rounded border border-hairline bg-white/10 px-1 text-[10px]">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
