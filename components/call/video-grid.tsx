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
  const previousStage = useRef<string | null>(null);

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

      const stageChanged = previousStage.current !== stageId;
      previousStage.current = stageId;

      if (state && prev.length > 0) {
        Flip.from(state, {
          duration: stageChanged ? 0.7 : 0.55,
          ease: "power3.out",
          absolute: true,
          nested: true,
          /*
           * Participants enter the SCENE, not just the layout: they arrive
           * turned away and far back, then swing square and settle.
           */
          onEnter: (els) =>
            gsap.fromTo(
              els,
              { opacity: 0, scale: 0, rotateY: 25, z: -200 },
              {
                opacity: 1,
                scale: 1,
                rotateY: 0,
                z: 0,
                duration: 0.75,
                ease: "back.out(1.4)",
              },
            ),
          // Leaving is the same move reversed.
          onLeave: (els) =>
            gsap.to(els, {
              opacity: 0,
              scale: 0,
              rotateY: -25,
              z: -200,
              duration: 0.45,
              ease: "power2.in",
            }),
        });
      }

      if (added.length > 0) {
        const newTiles = added
          .map((id) => root.current?.querySelector<HTMLElement>(`[data-tile="${id}"]`))
          .filter((el): el is HTMLElement => Boolean(el));
        gsap.fromTo(
          newTiles,
          { opacity: 0, scale: 0, rotateY: 25, z: -200 },
          {
            opacity: 1,
            scale: 1,
            rotateY: 0,
            z: 0,
            duration: 0.75,
            ease: "back.out(1.4)",
            clearProps: "rotateY",
          },
        );
      }

      /*
       * SPOTLIGHT — a camera focusing on a speaker.
       *
       * Flip already moves the tiles to their new boxes; this adds the depth
       * axis on top: the subject comes toward the viewer while everyone else
       * pulls back, dims and shrinks slightly. Reversed when it is released.
       */
      if (stageChanged) {
        const tiles = gsap.utils.toArray<HTMLElement>("[data-tile]");
        for (const tile of tiles) {
          const isStage = tile.dataset.tile === stageId;
          gsap.to(tile, {
            /*
             * Small Z on purpose. The layout change already delivers the
             * size increase — the stage tile goes from a grid cell to the
             * full stage. Perspective magnification on top of that pushed
             * it past the viewport and clipped the name label, so Z here
             * only supplies the depth cue, not the scale.
             */
            z: stageId ? (isStage ? 24 : -32) : 0,
            opacity: stageId && !isStage ? 0.75 : 1,
            scale: stageId && !isStage ? 0.96 : 1,
            duration: 0.7,
            ease: "power3.out",
            overwrite: "auto",
          });
        }
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
      <div
        ref={root}
        className="flex size-full flex-col gap-3 lg:flex-row"
        style={{ perspective: "1600px", transformStyle: "preserve-3d" }}
      >
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
      // Perspective lives on the grid so each tile's Z reads as real depth.
      style={{ perspective: "1600px", transformStyle: "preserve-3d" }}
    >
      {participants.map((p) => (
        // Each cell centres a 16:9 tile rather than letting video fill and
        // crop. Cropping a participant out of frame is worse than letterbox.
        <div key={p.id} className="flex min-h-0 items-center justify-center" style={{ transformStyle: "preserve-3d" }}>
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
