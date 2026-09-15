"use client";

import { useRef, useState } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import type { Participant } from "@/types";
import { useGSAP } from "@/lib/gsap";
import { fadeUp, scaleIn } from "@/lib/animations";
import { VideoTile } from "@/components/call/video-tile";
import { cn } from "@/lib/utils";

/**
 * Shown while you are the only person in the room. Your spec called for
 * animated empty states — the important job here is reassurance: the user
 * needs to know the call is working and that the next step is theirs.
 */
export function WaitingState({
  roomId,
  local,
}: {
  roomId: string;
  local: Participant;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useGSAP(
    () => {
      scaleIn("[data-waiting-tile]", { duration: 0.7, from: 0.95 });
      fadeUp("[data-waiting-item]", { stagger: 0.08, delay: 0.2 });
    },
    { scope: root },
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${roomId}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      ref={root}
      className="flex size-full flex-col items-center justify-center gap-6 lg:flex-row lg:gap-10"
    >
      <div
        data-waiting-tile
        className="aspect-video w-full max-w-md lg:max-w-lg"
      >
        <VideoTile participant={local} isLocal className="size-full" />
      </div>

      <div className="flex max-w-xs flex-col items-center gap-4 text-center lg:items-start lg:text-left">
        <span
          data-waiting-item
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Loader2 className="size-3.5 animate-spin text-violet" aria-hidden />
          Waiting for others to join
        </span>

        <h2 data-waiting-item className="text-2xl font-semibold tracking-tight">
          You&rsquo;re the first one here
        </h2>

        <p
          data-waiting-item
          className="text-sm leading-relaxed text-muted-foreground"
        >
          Share this link to bring someone in. The call connects directly
          between your browsers once they arrive.
        </p>

        <button
          data-waiting-item
          type="button"
          onClick={copy}
          className={cn(
            "group flex w-full items-center gap-2 rounded-xl border border-hairline bg-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/10",
          )}
        >
          <Link2 className="size-4 shrink-0 text-violet" aria-hidden />
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
            /r/{roomId}
          </code>
          {copied ? (
            <Check className="size-4 shrink-0 text-live" aria-hidden />
          ) : (
            <Copy className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="sr-only">Copy invite link</span>
        </button>
      </div>
    </div>
  );
}
