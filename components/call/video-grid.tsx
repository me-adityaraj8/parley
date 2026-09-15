"use client";

import { useEffect, useRef } from "react";
import type { Participant } from "@/types";
import { Flip, gsap, useGSAP } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/animations";
import { VideoTile } from "./video-tile";
import { cn } from "@/lib/utils";

interface VideoGridProps {
  participants: Participant[];
  localId: string | null;
  /** When someone shares, their tile becomes the stage and others shrink. */
  stageId: string | null;
}

/**
 * Adaptive grid.
 *
 * Tailwind cannot generate classes from runtime values, so the column count
 * is chosen from a fixed lookup rather than interpolated — this keeps every
 * class present in the compiled CSS.
 */
function gridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 6) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

export function VideoGrid({ participants, localId, stageId }: VideoGridProps) {
  const root = useRef<HTMLDivElement>(null);
  const previousIds = useRef<string[]>([]);

  const stage = stageId
    ? participants.find((p) => p.id === stageId) ?? null
    : null;
  const others = stage ? participants.filter((p) => p.id !== stage.id) : participants;

  /**
   * FLIP animation on roster change.
   *
   * When a participant joins, the grid re-flows and every existing tile
   * jumps to a new position. Flip records each tile's geometry BEFORE the
   * re-render, then animates from the old box to the new one — so tiles
   * glide into their new layout instead of teleporting.
   */
  useGSAP(
    () => {
      const ids = participants.map((p) => p.id);
      const prev = previousIds.current;
      previousIds.current = ids;

      const added = ids.filter((id) => !prev.includes(id));
      if (prev.length === 0 || prefersReducedMotion()) return;

      const tiles = gsap.utils.toArray<HTMLElement>("[data-tile]");
      if (tiles.length === 0) return;

      // Existing tiles glide to their new slots...
      Flip.from(Flip.getState(tiles), {
        duration: 0.55,
        ease: "power3.out",
        absolute: true,
        onEnter: (els) =>
          gsap.fromTo(
            els,
            { opacity: 0, scale: 0.86 },
            { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)" },
          ),
      });

      // ...and brand-new tiles pop in.
      if (added.length > 0) {
        const newTiles = added
          .map((id) => root.current?.querySelector<HTMLElement>(`[data-tile="${id}"]`))
          .filter((el): el is HTMLElement => Boolean(el));
        gsap.fromTo(
          newTiles,
          { opacity: 0, scale: 0.86, y: 16 },
          { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "back.out(1.6)" },
        );
      }
    },
    { scope: root, dependencies: [participants.map((p) => p.id).join(",")] },
  );

  // Keep the ref in sync when reduced motion skips the animation path.
  useEffect(() => {
    previousIds.current = participants.map((p) => p.id);
  }, [participants]);

  if (stage) {
    return (
      <div ref={root} className="flex size-full flex-col gap-3 lg:flex-row">
        <VideoTile
          participant={stage}
          isLocal={stage.id === localId}
          className="min-h-0 flex-1"
        />
        {others.length > 0 && (
          <div className="flex shrink-0 gap-3 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-y-auto">
            {others.map((p) => (
              <VideoTile
                key={p.id}
                participant={p}
                isLocal={p.id === localId}
                compact
                className="aspect-video w-40 shrink-0 lg:w-full"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={root}
      className={cn(
        "grid size-full auto-rows-fr place-content-center gap-3",
        gridClass(participants.length),
      )}
    >
      {participants.map((p) => (
        // Each cell centres a 16:9 tile rather than letting video fill and
        // crop. Cropping a call participant out of frame is worse than
        // showing letterbox bars.
        <div key={p.id} className="flex min-h-0 items-center justify-center">
          <VideoTile
            participant={p}
            isLocal={p.id === localId}
            className="aspect-video max-h-full w-full"
          />
        </div>
      ))}
    </div>
  );
}
