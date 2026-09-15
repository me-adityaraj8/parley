"use client";

import { useRef } from "react";
import { Download, Pause, Play, Square } from "lucide-react";
import type { RecordingState } from "@/hooks/useRecording";
import { useGSAP } from "@/lib/gsap";
import { fadeUp } from "@/lib/animations";

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function RecordingIndicator({
  state,
  elapsed,
  url,
  onPause,
  onResume,
  onStop,
  onDismiss,
}: {
  state: RecordingState;
  elapsed: number;
  url: string | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDismiss: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      fadeUp(root.current, { y: -10, duration: 0.35 });
    },
    { scope: root, dependencies: [state] },
  );

  if (state === "idle") return null;

  if (state === "stopped") {
    return (
      <div ref={root} className="flex justify-center px-3 pt-2">
        <div className="glass flex items-center gap-3 rounded-full py-1.5 pl-3.5 pr-1.5 text-sm">
          <span className="text-xs">Recording ready · {formatElapsed(elapsed)}</span>
          {url && (
            <a
              href={url}
              download={`parley-recording-${Date.now()}.webm`}
              className="flex items-center gap-1.5 rounded-full bg-live/20 px-3 py-1 text-xs text-live transition-colors hover:bg-live/30"
            >
              <Download className="size-3" aria-hidden />
              Download
            </a>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-white/10"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={root} className="flex justify-center px-3 pt-2">
      <div
        role="status"
        className="glass flex items-center gap-3 rounded-full border-danger/30 py-1.5 pl-3.5 pr-1.5 text-sm"
      >
        <span className="flex items-center gap-2">
          <span
            className={cnDot(state)}
            aria-hidden
          />
          <span className="text-xs">
            {state === "paused" ? "Paused" : "Recording locally"}
          </span>
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatElapsed(elapsed)}
        </span>
        <div className="flex items-center gap-1">
          {state === "recording" ? (
            <button
              type="button"
              onClick={onPause}
              aria-label="Pause recording"
              className="flex size-7 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            >
              <Pause className="size-3" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={onResume}
              aria-label="Resume recording"
              className="flex size-7 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            >
              <Play className="size-3" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop recording"
            className="flex size-7 items-center justify-center rounded-full bg-danger/90 text-white transition-colors hover:bg-danger"
          >
            <Square className="size-3" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function cnDot(state: RecordingState): string {
  return state === "recording"
    ? "size-2 rounded-full bg-danger animate-pulse"
    : "size-2 rounded-full bg-warn";
}
