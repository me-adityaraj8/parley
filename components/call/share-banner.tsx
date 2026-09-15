"use client";

import { useRef } from "react";
import { MonitorUp } from "lucide-react";
import { useGSAP } from "@/lib/gsap";
import { fadeUp } from "@/lib/animations";

export function ShareBanner({ onStop }: { onStop: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      fadeUp(root.current, { y: -12, duration: 0.4 });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="flex justify-center px-3 pt-2">
      <div
        role="status"
        className="glass flex items-center gap-3 rounded-full border-live/30 py-1.5 pl-3.5 pr-1.5 text-sm"
      >
        <MonitorUp className="size-4 text-live" aria-hidden />
        <span>You&rsquo;re sharing your screen</span>
        <button
          type="button"
          onClick={onStop}
          className="rounded-full bg-danger/90 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-danger"
        >
          Stop sharing
        </button>
      </div>
    </div>
  );
}
