"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { ROOM_CAPACITY } from "@/types";
import { AmbientBackground } from "@/components/shared/ambient-background";

export function RoomFull() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-6">
      <AmbientBackground />
      <div className="glass-strong max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-warn/15">
          <Users className="size-5 text-warn" aria-hidden />
        </div>
        <h1 className="mt-5 text-xl font-semibold">This room is full</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Parley connects everyone directly to everyone else, which keeps calls
          private and fast but limits rooms to {ROOM_CAPACITY} people. Ask the
          host to start a second room.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-violet px-5 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110"
        >
          Start a new room
        </Link>
      </div>
    </main>
  );
}
