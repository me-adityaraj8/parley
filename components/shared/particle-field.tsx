"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/animations";
import { cn } from "@/lib/utils";

/**
 * Ambient 3D particle field.
 *
 * CANVAS, NOT DOM. A few hundred DOM nodes each carrying a transform would
 * mean a few hundred style recalculations and composited layers every frame;
 * one canvas is a single element and a single paint. The whole field costs
 * roughly what one animated div costs.
 *
 * Depth is real: each particle has a z, and its projected size, speed,
 * opacity and parallax response all derive from it. Far particles are small,
 * dim and barely move; near ones are larger and track the cursor noticeably.
 */

interface Particle {
  x: number;
  y: number;
  z: number;
  /** Slow constant drift, in world units per second. */
  vx: number;
  vy: number;
  r: number;
  /** Phase offset for the twinkle. */
  phase: number;
  hue: "violet" | "cyan";
}

const DENSITY = 1 / 16000; // particles per px² of viewport
const MAX_PARTICLES = 130;
const PERSPECTIVE = 700;

export function ParticleField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    if (prefersReducedMotion()) {
      // Still render one static frame so the space does not feel empty.
      drawStatic(canvas, ctx);
      return;
    }

    let particles: Particle[] = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf: number | null = null;
    let last = performance.now();
    const pointer = { tx: 0, ty: 0, x: 0, y: 0 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // Cap DPR at 1.5: this is out-of-focus background texture, and a 3rd
      // of the pixels is indistinguishable here but a third of the fill cost.
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(MAX_PARTICLES, Math.round(w * h * DENSITY));
      particles = Array.from({ length: count }, () => spawn(w, h));
    };

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Wrap in world space so the field never runs out.
        if (p.x < -w * 0.1) p.x = w * 1.1;
        if (p.x > w * 1.1) p.x = -w * 0.1;
        if (p.y < -h * 0.1) p.y = h * 1.1;
        if (p.y > h * 1.1) p.y = -h * 0.1;

        // Perspective: k > 1 near, < 1 far.
        const k = PERSPECTIVE / (PERSPECTIVE + p.z);
        const cx = w / 2;
        const cy = h / 2;

        // Parallax scales with nearness, so the field gains depth as the
        // cursor moves rather than sliding as one flat sheet.
        const px = cx + (p.x - cx) * k + pointer.x * 46 * k;
        const py = cy + (p.y - cy) * k + pointer.y * 32 * k;

        const radius = p.r * k;
        if (radius < 0.12) continue;

        // Twinkle, plus a depth fade.
        const twinkle = 0.65 + Math.sin(now / 1400 + p.phase) * 0.35;
        const alpha = Math.min(0.5, 0.5 * k * k) * twinkle;
        if (alpha < 0.01) continue;

        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle =
          p.hue === "cyan"
            ? `oklch(0.82 0.13 196 / ${alpha.toFixed(3)})`
            : `oklch(0.72 0.16 285 / ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    const start = () => {
      if (raf !== null) return;
      last = performance.now();
      raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    };

    resize();
    start();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      pointer.tx = e.clientX / window.innerWidth - 0.5;
      pointer.ty = e.clientY / window.innerHeight - 0.5;
    };
    if (fine) window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (fine) window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-particle-field
      className={cn("pointer-events-none fixed inset-0 -z-10 size-full", className)}
    />
  );
}

function spawn(w: number, h: number): Particle {
  const z = Math.random() * 900 - 120;
  return {
    x: Math.random() * w * 1.2 - w * 0.1,
    y: Math.random() * h * 1.2 - h * 0.1,
    z,
    // Near particles drift faster, which is the strongest depth cue of all.
    vx: (Math.random() - 0.5) * 14,
    vy: -(6 + Math.random() * 12),
    r: 0.9 + Math.random() * 1.9,
    phase: Math.random() * Math.PI * 2,
    hue: Math.random() < 0.22 ? "cyan" : "violet",
  };
}

/** One static frame for reduced-motion users. */
function drawStatic(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const count = Math.min(MAX_PARTICLES, Math.round(rect.width * rect.height * DENSITY));
  for (let i = 0; i < count; i++) {
    const p = spawn(rect.width, rect.height);
    const k = PERSPECTIVE / (PERSPECTIVE + p.z);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * k, 0, Math.PI * 2);
    ctx.fillStyle = `oklch(0.72 0.16 285 / ${(0.35 * k * k).toFixed(3)})`;
    ctx.fill();
  }
}
