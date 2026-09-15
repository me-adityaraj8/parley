"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Pen, RotateCcw, Trash2, Type, X } from "lucide-react";
import type { Stroke, TextNote } from "@/types";
import { cn } from "@/lib/utils";

const COLORS = ["#a78bfa", "#22d3ee", "#f472b6", "#fbbf24", "#4ade80", "#f8fafc"];
const WIDTHS = [2, 4, 8, 16];

interface WhiteboardProps {
  strokes: Stroke[];
  notes: TextNote[];
  version: number;
  onBegin: (x: number, y: number, color: string, width: number, erase: boolean) => void;
  onExtend: (x: number, y: number) => void;
  onEnd: () => void;
  onText: (x: number, y: number, body: string, color: string, size: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * Collaborative canvas.
 *
 * All geometry is stored in NORMALISED 0-1 space and scaled at paint time, so
 * participants with different window sizes see the same drawing in the same
 * relative place.
 *
 * Rendering is imperative and runs on an animation frame. Strokes are NOT
 * React children — a whiteboard with a few thousand points would otherwise
 * reconcile thousands of nodes per pointermove.
 */
export function Whiteboard(props: WhiteboardProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState(COLORS[0]!);
  const [width, setWidth] = useState(WIDTHS[1]!);
  const [tool, setTool] = useState<"pen" | "eraser" | "text">("pen");
  const drawing = useRef(false);
  const dpr = useRef(1);

  /** Paint everything. Cheap enough at this scale; no dirty-rect bookkeeping. */
  const paint = useCallback(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;

    const w = el.width;
    const h = el.height;
    ctx.clearRect(0, 0, w, h);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const s of props.strokes) {
      if (s.points.length < 2) continue;
      ctx.beginPath();
      // Eraser paints with destination-out so it removes pixels rather than
      // drawing background-coloured lines over other strokes.
      ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * dpr.current;
      ctx.moveTo(s.points[0]! * w, s.points[1]! * h);
      for (let i = 2; i < s.points.length; i += 2) {
        ctx.lineTo(s.points[i]! * w, s.points[i + 1]! * h);
      }
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "source-over";
    for (const n of props.notes) {
      ctx.fillStyle = n.color;
      ctx.font = `${n.size * dpr.current}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(n.body, n.x * w, n.y * h);
    }
  }, [props.strokes, props.notes]);

  // Resize with the container, accounting for device pixel ratio so lines
  // are not blurry on retina displays.
  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box) return;

    const resize = () => {
      const rect = box.getBoundingClientRect();
      dpr.current = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(rect.width * dpr.current);
      el.height = Math.round(rect.height * dpr.current);
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
      paint();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    return () => ro.disconnect();
  }, [paint]);

  useEffect(() => {
    paint();
  }, [props.version, paint]);

  const toNormalised = (e: React.PointerEvent): [number, number] => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const [x, y] = toNormalised(e);

    if (tool === "text") {
      const body = window.prompt("Text to place on the board");
      if (body) props.onText(x, y, body, color, 18);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    props.onBegin(x, y, color, width, tool === "eraser");
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const [x, y] = toNormalised(e);
    props.onExtend(x, y);
  };

  const stop = () => {
    if (!drawing.current) return;
    drawing.current = false;
    props.onEnd();
  };

  return (
    <div className="glass-strong absolute inset-3 z-30 flex flex-col overflow-hidden rounded-2xl sm:inset-5">
      <header className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2">
        <span className="mr-1 text-xs font-medium">Whiteboard</span>

        <div className="flex items-center gap-1">
          <ToolButton active={tool === "pen"} onClick={() => setTool("pen")} label="Pen">
            <Pen className="size-3.5" />
          </ToolButton>
          <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")} label="Eraser">
            <Eraser className="size-3.5" />
          </ToolButton>
          <ToolButton active={tool === "text"} onClick={() => setTool("text")} label="Text">
            <Type className="size-3.5" />
          </ToolButton>
        </div>

        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              className={cn(
                "size-5 rounded-full transition-transform",
                color === c && "scale-125 ring-2 ring-white/60",
              )}
              style={{ background: c }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWidth(w)}
              aria-label={`Stroke width ${w}`}
              aria-pressed={width === w}
              className={cn(
                "flex size-6 items-center justify-center rounded-full transition-colors",
                width === w ? "bg-white/20" : "hover:bg-white/10",
              )}
            >
              <span className="rounded-full bg-current" style={{ width: w / 1.5 + 2, height: w / 1.5 + 2 }} />
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <ToolButton onClick={props.onUndo} label="Undo my last mark">
            <RotateCcw className="size-3.5" />
          </ToolButton>
          <ToolButton onClick={props.onClear} label="Clear board for everyone">
            <Trash2 className="size-3.5" />
          </ToolButton>
          <ToolButton onClick={props.onClose} label="Close whiteboard">
            <X className="size-3.5" />
          </ToolButton>
        </div>
      </header>

      <div ref={wrap} className="relative min-h-0 flex-1 bg-[#0d0b17]">
        <canvas
          ref={canvas}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          className={cn(
            "size-full touch-none",
            tool === "text" ? "cursor-text" : "cursor-crosshair",
          )}
        />
        {props.strokes.length === 0 && props.notes.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Draw here — strokes sync to everyone over the data channel
          </p>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex size-7 items-center justify-center rounded-full transition-colors",
        active ? "bg-violet text-white" : "hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}
