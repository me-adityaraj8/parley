"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Video } from "lucide-react";
import { generateRoomId } from "@/lib/room";
import { useMagnetic } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface CreateRoomButtonProps {
  size?: "sm" | "lg";
  className?: string;
}

/**
 * Creating a room is instant — the ID is generated in the browser and the
 * room only exists once someone connects to it. There is no "create room"
 * API call, which is why this feels immediate. The brief loading state is
 * real though: it covers the route transition and media permission prompt.
 */
export function CreateRoomButton({ size = "lg", className }: CreateRoomButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const magnetRef = useMagnetic<HTMLButtonElement>(size === "lg" ? 0.3 : 0.15);
  const glowRef = useRef<HTMLSpanElement>(null);

  const create = () => {
    setPending(true);
    router.push(`/r/${generateRoomId()}`);
  };

  return (
    <button
      ref={magnetRef}
      type="button"
      onClick={create}
      disabled={pending}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-medium transition-all",
        "bg-violet text-white hover:brightness-110",
        "focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        size === "lg" ? "px-7 py-3.5 text-sm glow-violet" : "px-4 py-2 text-xs",
        pending && "cursor-wait opacity-90",
        className,
      )}
    >
      <span
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle at 50% 120%, oklch(0.95 0.05 281 / 45%), transparent 60%)",
        }}
      />
      {pending ? (
        <Loader2 className={cn("animate-spin", size === "lg" ? "size-4" : "size-3.5")} aria-hidden />
      ) : (
        <Video className={cn(size === "lg" ? "size-4" : "size-3.5")} aria-hidden />
      )}
      <span className="relative">{pending ? "Starting room…" : "Create room"}</span>
      {size === "lg" && !pending && (
        <ArrowRight
          className="relative size-4 transition-transform duration-300 group-hover:translate-x-1"
          aria-hidden
        />
      )}
    </button>
  );
}
