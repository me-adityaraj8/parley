"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateRoomId } from "@/lib/room";
import { CreateTransition } from "@/components/room/create-transition";
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
  // Held in state so the transition can show the ID the user is about to join.
  const [creating, setCreating] = useState<{ id: string; origin: { x: number; y: number } } | null>(null);
  const magnetRef = useMagnetic<HTMLButtonElement>(size === "lg" ? 0.3 : 0.15);
  const glowRef = useRef<HTMLSpanElement>(null);

  const create = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (pending) return;
    setPending(true);
    const r = e.currentTarget.getBoundingClientRect();
    setCreating({
      id: generateRoomId(),
      origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
    });
  };

  return (
    <>
      <Button
      ref={magnetRef}
      type="button"
      onClick={create}
      disabled={pending}
      size={size === "lg" ? "lg" : "sm"}
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
      </Button>

      {creating && (
        <CreateTransition
          roomId={creating.id}
          origin={creating.origin}
          onNavigate={() => router.push(`/r/${creating.id}`)}
        />
      )}
    </>
  );
}
