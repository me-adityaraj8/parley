"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Circle,
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  MoreHorizontal,
  Paperclip,
  PencilRuler,
  PhoneOff,
  QrCode,
  Radio,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { gsap, useGSAP } from "@/lib/gsap";
import { pressFeedback, prefersReducedMotion } from "@/lib/animations";
import { ReactionBar } from "./reaction-bar";
import { cn } from "@/lib/utils";
import type { PanelId } from "@/types";

interface ControlDockProps {
  audio: boolean;
  video: boolean;
  sharing: boolean;
  screenShareSupported: boolean;
  handRaised: boolean;
  whiteboardOpen: boolean;
  recording: boolean;
  pushToTalk: boolean;
  panel: PanelId;
  unreadCount: number;
  participantCount: number;
  activeTransfers: number;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleShare: () => void;
  onToggleHand: () => void;
  onToggleWhiteboard: () => void;
  onTogglePushToTalk: () => void;
  onReact: (emoji: string) => void;
  onPanel: (panel: PanelId) => void;
  onRecord: () => void;
  onInvite: () => void;
  onLeave: () => void;
}

export function ControlDock(props: ControlDockProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close the menu on outside click and Escape.
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  useGSAP(
    () => {
      if (!moreOpen || !moreRef.current) return;
      const menu = moreRef.current.querySelector("[data-more-menu]");
      if (!menu) return;
      if (prefersReducedMotion()) {
        gsap.set(menu, { opacity: 1, y: 0 });
        return;
      }
      gsap.fromTo(
        menu,
        { opacity: 0, y: 10, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: "back.out(1.6)" },
      );
      gsap.fromTo(
        "[data-more-item]",
        { opacity: 0, x: -6 },
        { opacity: 1, x: 0, duration: 0.25, stagger: 0.035 },
      );
    },
    { scope: moreRef, dependencies: [moreOpen] },
  );

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
        label={props.audio ? "Mute microphone" : "Unmute microphone"}
        shortcut="M"
        active={!props.audio}
        danger={!props.audio}
        onClick={props.onToggleAudio}
      >
        {props.audio ? <Mic className="size-5" /> : <MicOff className="size-5" />}
      </DockButton>

      <DockButton
        label={props.video ? "Turn camera off" : "Turn camera on"}
        shortcut="V"
        active={!props.video}
        danger={!props.video}
        onClick={props.onToggleVideo}
      >
        {props.video ? <Video className="size-5" /> : <VideoOff className="size-5" />}
      </DockButton>

      {props.screenShareSupported && (
        <DockButton
          label={props.sharing ? "Stop sharing" : "Share your screen"}
          shortcut="S"
          active={props.sharing}
          accent={props.sharing}
          onClick={props.onToggleShare}
        >
          {props.sharing ? <MonitorX className="size-5" /> : <MonitorUp className="size-5" />}
        </DockButton>
      )}

      <ReactionBar onReact={props.onReact} />

      <DockButton
        label={props.handRaised ? "Lower hand" : "Raise hand"}
        shortcut="H"
        active={props.handRaised}
        warn={props.handRaised}
        onClick={props.onToggleHand}
      >
        <Hand className="size-5" />
      </DockButton>

      <span className="mx-1 hidden h-7 w-px bg-hairline sm:block" aria-hidden />

      <DockButton
        label="Chat"
        shortcut="C"
        active={props.panel === "chat"}
        badge={props.unreadCount > 0 ? props.unreadCount : undefined}
        onClick={() => props.onPanel(props.panel === "chat" ? null : "chat")}
      >
        <MessageSquare className="size-5" />
      </DockButton>

      <DockButton
        label="Participants"
        shortcut="P"
        active={props.panel === "participants"}
        badge={props.participantCount}
        badgeTone="neutral"
        onClick={() => props.onPanel(props.panel === "participants" ? null : "participants")}
      >
        <Users className="size-5" />
      </DockButton>

      {/* Secondary features live here so the primary bar stays uncluttered. */}
      <div ref={moreRef} className="relative">
        <DockButton
          label="More"
          active={moreOpen}
          badge={props.activeTransfers > 0 ? props.activeTransfers : undefined}
          onClick={() => setMoreOpen((o) => !o)}
        >
          <MoreHorizontal className="size-5" />
        </DockButton>

        {moreOpen && (
          <div
            data-more-menu
            role="menu"
            className="glass-strong absolute bottom-full left-1/2 mb-3 w-56 -translate-x-1/2 space-y-0.5 rounded-2xl p-1.5 opacity-0"
          >
            <MoreItem
              icon={<PencilRuler className="size-4" />}
              label="Whiteboard"
              active={props.whiteboardOpen}
              onClick={() => {
                props.onToggleWhiteboard();
                setMoreOpen(false);
              }}
            />
            <MoreItem
              icon={<Paperclip className="size-4" />}
              label="Send files"
              badge={props.activeTransfers || undefined}
              active={props.panel === "files"}
              onClick={() => {
                props.onPanel(props.panel === "files" ? null : "files");
                setMoreOpen(false);
              }}
            />
            <MoreItem
              icon={<Activity className="size-4" />}
              label="Call diagnostics"
              active={props.panel === "diagnostics"}
              onClick={() => {
                props.onPanel(props.panel === "diagnostics" ? null : "diagnostics");
                setMoreOpen(false);
              }}
            />
            <MoreItem
              icon={<Circle className={cn("size-4", props.recording && "fill-danger text-danger")} />}
              label={props.recording ? "Stop recording" : "Record locally"}
              active={props.recording}
              onClick={() => {
                props.onRecord();
                setMoreOpen(false);
              }}
            />
            <MoreItem
              icon={<Radio className="size-4" />}
              label="Push to talk"
              hint="Hold Space"
              active={props.pushToTalk}
              onClick={() => {
                props.onTogglePushToTalk();
                setMoreOpen(false);
              }}
            />
            <MoreItem
              icon={<QrCode className="size-4" />}
              label="Invite others"
              onClick={() => {
                props.onInvite();
                setMoreOpen(false);
              }}
            />
          </div>
        )}
      </div>

      <span className="mx-1 hidden h-7 w-px bg-hairline sm:block" aria-hidden />

      <DockButton label="Leave call" leave onClick={props.onLeave}>
        <PhoneOff className="size-5" />
      </DockButton>
    </div>
  );
}

function MoreItem({
  icon,
  label,
  hint,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      data-more-item
      role="menuitem"
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors",
        active ? "bg-violet/20 text-violet" : "hover:bg-white/8",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className="rounded-full bg-violet px-1.5 text-[10px] font-semibold text-white">{badge}</span>
      )}
      {hint && <kbd className="text-[10px] text-muted-foreground">{hint}</kbd>}
    </button>
  );
}

interface DockButtonProps {
  label: string;
  shortcut?: string;
  active?: boolean;
  danger?: boolean;
  accent?: boolean;
  warn?: boolean;
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
  warn,
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
            "outline-none transition-colors duration-200",
            "focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            !active && !leave && "bg-white/5 text-foreground hover:bg-white/10",
            danger && "bg-danger/20 text-danger hover:bg-danger/25",
            accent && "bg-live/20 text-live hover:bg-live/25",
            warn && "bg-warn/20 text-warn hover:bg-warn/25",
            active && !danger && !accent && !warn && "bg-white/15 text-foreground",
            leave && "bg-danger/90 text-white hover:bg-danger",
          )}
        >
          {children}
          {badge !== undefined && badge > 0 && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                badgeTone === "accent" ? "bg-violet text-white" : "bg-white/20 text-foreground",
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
          <kbd className="ml-2 rounded border border-hairline bg-white/10 px-1 text-[10px]">{shortcut}</kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
