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
  /** A participant sharing their screen, or one the user spotlighted. */
  stageId: string | null;
  onSpotlight: (id: string | null) => void;
  onVolume: (id: string, volume: number) => void;
}

/**
 * Adaptive layout.
 *
 * Tailwind cannot generate classes from runtime values, so column counts come
 * from a fixed lookup — every class is present in the compiled CSS.
 *
 *   1 → fullscreen        2 → 50/50
 *   3 → cinematic         4 → 2×2
 *   5-6 → adaptive grid
 */
function gridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  if (count === 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  if (count === 4) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-2 lg:grid-cols-3";
}

export function VideoGrid({
  participants,
  localId,
  stageId,
  onSpotlight,
  onVolume,
}: VideoGridProps) {
  const root = useRef<HTMLDivElement>(null);
  const previousIds = useRef<string[]>([]);
  const flipState = useRef<Flip.FlipState | null>(null);

  const stage = stageId ? (participants.find((p) => p.id === stageId) ?? null) : null;
  const others = stage ? participants.filter((p) => p.id !== stage.id) : participants;
  const layoutKey = `${stageId ?? "grid"}:${participants.map((p) => p.id).join(",")}`;

  /**
   * FLIP.
   *
   * Capture geometry BEFORE React commits the new layout, then animate each
   * tile from its old box to its new one. Without this, entering spotlight or
   * a participant joining makes every tile teleport.
   *
   * useLayoutEffect timing is what makes the capture correct — it runs after
   * render but before paint, so we still see the previous frame's boxes.
   */
  useEffect(() => {
    if (prefersReducedMotion() || !root.current) return;
    const tiles = root.current.querySelectorAll<HTMLElement>("[data-tile]");
    if (tiles.length === 0) return;
    flipState.current = Flip.getState(tiles);
  }, [layoutKey]);

  useGSAP(
    () => {
      const ids = participants.map((p) => p.id);
      const prev = previousIds.current;
      previousIds.current = ids;

      if (prefersReducedMotion() || !root.current) return;

      const added = ids.filter((id) => !prev.includes(id));
      const state = flipState.current;

      if (state && prev.length > 0) {
        Flip.from(state, {
          duration: 0.55,
          ease: "power3.out",
          absolute: true,
          nested: true,
          onEnter: (els) =>
            gsap.fromTo(
              els,
              { opacity: 0, scale: 0.86 },
              { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)" },
            ),
          onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.9, duration: 0.3 }),
        });
      }

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

      // Raised hands get a small bounce so the change is noticed.
      gsap.fromTo(
        "[data-hand]",
        { scale: 0.4, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2.4)" },
      );
    },
    { scope: root, dependencies: [layoutKey] },
  );

  const tileProps = {
    onSpotlight,
    onVolume,
  };

  if (stage) {
    return (
      <div ref={root} className="flex size-full flex-col gap-3 lg:flex-row">
        <VideoTile
          participant={stage}
          isLocal={stage.id === localId}
          spotlighted
          className="min-h-0 flex-1"
          {...tileProps}
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
                {...tileProps}
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
        // crop. Cropping a participant out of frame is worse than letterbox.
        <div key={p.id} className="flex min-h-0 items-center justify-center">
          <VideoTile
            participant={p}
            isLocal={p.id === localId}
            className="aspect-video max-h-full w-full"
            {...tileProps}
          />
        </div>
      ))}
    </div>
  );
}
