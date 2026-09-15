"use client";

import { useCallback, useRef, useState } from "react";
import type { DataMessage, PeerId, Stroke, TextNote, WhiteboardOp } from "@/types";

interface UseWhiteboardOptions {
  selfId: PeerId | null;
  broadcast: (msg: DataMessage) => number;
}

/**
 * Collaborative whiteboard state, synchronised peer-to-peer.
 *
 * DESIGN: strokes are streamed as deltas (`start` → `point` → `end`), not
 * sent once on pen-up, so remote peers watch the line being drawn.
 *
 * Coordinates are NORMALISED to 0-1. Participants have different canvas
 * sizes and aspect ratios; sending pixels would put everyone's drawing in a
 * different place. Each client scales into its own canvas on render.
 *
 * Points are BATCHED on an animation frame rather than sent per pointermove.
 * A fast pointer fires 100+ events/second; one message each would flood the
 * data channel for no visual gain.
 */
export function useWhiteboard({ selfId, broadcast }: UseWhiteboardOptions) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [notes, setNotes] = useState<TextNote[]>([]);
  const [version, setVersion] = useState(0);

  const pending = useRef<number[]>([]);
  const activeId = useRef<string | null>(null);
  const flushTimer = useRef<number | null>(null);

  /** Local mutation + broadcast, in that order so the artist sees zero lag. */
  const apply = useCallback(
    (op: WhiteboardOp, authorId: PeerId) => {
      switch (op.k) {
        case "start":
          setStrokes((prev) => [
            ...prev,
            {
              id: op.id,
              authorId,
              color: op.color,
              width: op.width,
              erase: op.erase,
              points: [op.x, op.y],
            },
          ]);
          break;
        case "point":
          setStrokes((prev) =>
            prev.map((s) => (s.id === op.id ? { ...s, points: [...s.points, ...op.pts] } : s)),
          );
          break;
        case "end":
          break;
        case "text":
          setNotes((prev) => [
            ...prev,
            { id: op.id, authorId, x: op.x, y: op.y, body: op.body, color: op.color, size: op.size },
          ]);
          break;
        case "undo":
          setStrokes((prev) => prev.filter((s) => s.id !== op.id));
          setNotes((prev) => prev.filter((n) => n.id !== op.id));
          break;
        case "clear":
          setStrokes([]);
          setNotes([]);
          break;
      }
      setVersion((v) => v + 1);
    },
    [],
  );

  const send = useCallback(
    (op: WhiteboardOp) => {
      if (!selfId) return;
      apply(op, selfId);
      broadcast({ t: "wb", op });
    },
    [selfId, apply, broadcast],
  );

  /** Called for ops arriving from a remote peer. */
  const receive = useCallback(
    (from: PeerId, op: WhiteboardOp) => apply(op, from),
    [apply],
  );

  // ------------------------------------------------------------- drawing

  const beginStroke = useCallback(
    (x: number, y: number, color: string, width: number, erase: boolean) => {
      const id = crypto.randomUUID();
      activeId.current = id;
      pending.current = [];
      send({ k: "start", id, color, width, erase, x, y });
    },
    [send],
  );

  const flush = useCallback(() => {
    flushTimer.current = null;
    const id = activeId.current;
    if (!id || pending.current.length === 0) return;
    const pts = pending.current;
    pending.current = [];
    send({ k: "point", id, pts });
  }, [send]);

  const extendStroke = useCallback(
    (x: number, y: number) => {
      if (!activeId.current) return;
      pending.current.push(x, y);
      // Coalesce to one message per frame.
      if (flushTimer.current === null) {
        flushTimer.current = requestAnimationFrame(flush);
      }
    },
    [flush],
  );

  const endStroke = useCallback(() => {
    if (flushTimer.current !== null) {
      cancelAnimationFrame(flushTimer.current);
      flushTimer.current = null;
    }
    flush();
    const id = activeId.current;
    activeId.current = null;
    if (id) send({ k: "end", id });
  }, [flush, send]);

  const addText = useCallback(
    (x: number, y: number, body: string, color: string, size: number) => {
      if (!body.trim()) return;
      send({ k: "text", id: crypto.randomUUID(), x, y, body: body.slice(0, 120), color, size });
    },
    [send],
  );

  /** Undo removes only YOUR last object — never another participant's. */
  const undo = useCallback(() => {
    if (!selfId) return;
    const mineStrokes = strokes.filter((s) => s.authorId === selfId);
    const mineNotes = notes.filter((n) => n.authorId === selfId);
    const last = mineStrokes[mineStrokes.length - 1];
    const lastNote = mineNotes[mineNotes.length - 1];
    const target = lastNote && (!last || lastNote.id > last.id) ? lastNote : last;
    if (target) send({ k: "undo", id: target.id });
  }, [selfId, strokes, notes, send]);

  const clear = useCallback(() => send({ k: "clear" }), [send]);

  return {
    strokes,
    notes,
    version,
    beginStroke,
    extendStroke,
    endStroke,
    addText,
    undo,
    clear,
    receive,
    isEmpty: strokes.length === 0 && notes.length === 0,
  };
}
