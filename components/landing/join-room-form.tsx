"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { isValidRoomId } from "@/lib/room";
import { useMagnetic } from "@/lib/animations";
import { cn } from "@/lib/utils";

/** Accepts a bare room code or a full invite URL pasted from a message. */
function extractRoomId(raw: string): string | null {
  const trimmed = raw.trim();
  const fromUrl = trimmed.match(/\/r\/([a-z0-9-]+)/i)?.[1];
  const candidate = (fromUrl ?? trimmed).toLowerCase();
  return isValidRoomId(candidate) ? candidate : null;
}

export function JoinRoomForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const magnetRef = useMagnetic<HTMLButtonElement>(0.22);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractRoomId(value);
    if (!id) {
      setError("That doesn't look like a Parley link.");
      return;
    }
    router.push(`/r/${id}`);
  };

  return (
    <form onSubmit={submit} className="w-full sm:w-auto">
      <div
        className={cn(
          "glass flex items-center gap-1 rounded-full p-1 pl-4 transition-colors",
          error && "border-danger/50",
        )}
      >
        <label htmlFor="join-code" className="sr-only">
          Room code or invite link
        </label>
        <input
          id="join-code"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Paste an invite link"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "join-error" : undefined}
          className="w-full min-w-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground sm:w-52"
        />
        <button
          ref={magnetRef}
          type="submit"
          aria-label="Join room"
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-white/8 transition-colors hover:bg-white/15"
        >
          <span
            data-magnet-glow
            aria-hidden
            className="pointer-events-none absolute -inset-3 rounded-full opacity-0"
            style={{
              background:
                "radial-gradient(closest-side, oklch(0.64 0.191 281 / 45%), transparent 70%)",
            }}
          />
          <ArrowRight data-magnet-icon className="relative size-4" aria-hidden />
        </button>
      </div>
      {error && (
        <p id="join-error" role="alert" className="mt-2 pl-4 text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
