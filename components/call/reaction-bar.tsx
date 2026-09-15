"use client";

import { useRef, useState } from "react";
import { Smile } from "lucide-react";
import { REACTIONS } from "@/types";
import { gsap, useGSAP } from "@/lib/gsap";
import { pressFeedback, prefersReducedMotion } from "@/lib/animations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Emoji picker that expands from the control dock. */
export function ReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const pop = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!open || !pop.current) return;
      if (prefersReducedMotion()) {
        gsap.set(pop.current, { opacity: 1, y: 0 });
        gsap.set("[data-emoji]", { opacity: 1, scale: 1 });
        return;
      }
      gsap
        .timeline()
        .fromTo(pop.current, { opacity: 0, y: 8, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.24, ease: "back.out(1.8)" })
        .fromTo(
          "[data-emoji]",
          { opacity: 0, scale: 0.5, y: 6 },
          { opacity: 1, scale: 1, y: 0, duration: 0.26, stagger: 0.03, ease: "back.out(2)" },
          0.04,
        );
    },
    { scope: pop, dependencies: [open] },
  );

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Send a reaction"
            aria-expanded={open}
            className={cn(
              "flex size-11 items-center justify-center rounded-full transition-colors sm:size-12",
              "focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              open ? "bg-white/15" : "bg-white/5 hover:bg-white/10",
            )}
          >
            <Smile className="size-5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={10}>
          Reactions
        </TooltipContent>
      </Tooltip>

      {open && (
        <div
          ref={pop}
          className="glass-strong absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 gap-1 rounded-full p-1.5 opacity-0"
        >
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              data-emoji
              type="button"
              onClick={(e) => {
                pressFeedback(e.currentTarget);
                onReact(emoji);
                setOpen(false);
              }}
              aria-label={`React ${emoji}`}
              className="flex size-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
