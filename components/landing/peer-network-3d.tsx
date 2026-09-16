"use client";

import { useEffect, useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import {
  controlPoint,
  depthBlur,
  depthOpacity,
  prefersReducedMotion,
  project,
  quadPoint,
  type Point3D,
  type Projected,
} from "@/lib/animations";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ scene */

type NodeKind = "browser" | "core" | "signal" | "satellite";

interface SceneNode extends Point3D {
  id: string;
  kind: NodeKind;
  label?: string;
  sub?: string;
  /** Phase offset so nodes breathe out of sync with each other. */
  phase: number;
}

/**
 * Laid out as a diamond so the hero copy sits in the empty middle: the
 * signalling node above, the two browsers to either side, the peer-to-peer
 * core below. The shape is the product's architecture, not decoration.
 */
const NODES: SceneNode[] = [
  // Positions are chosen so the labelled cards land in the page gutters,
  // OUTSIDE the hero's text column. Anything readable sitting behind the
  // headline reads as clutter rather than atmosphere.
  /*
   * The setup hub is an unlabelled node on purpose. A labelled "Signaling"
   * box sitting in the middle of a headline that reads "Nothing in between"
   * argues with the copy — and the architecture section below already
   * explains signalling properly. Here it is just where the dashed setup
   * traffic originates.
   */
  { id: "signal", kind: "signal", x: 0, y: -250, z: 40, phase: 0 },
  { id: "a", kind: "browser", label: "Browser A", sub: "MediaStream", x: -472, y: 34, z: 70, phase: 1.1 },
  { id: "b", kind: "browser", label: "Browser B", sub: "MediaStream", x: 472, y: 34, z: -70, phase: 2.3 },
  { id: "core", kind: "core", x: 0, y: 330, z: 30, phase: 3.4 },
  { id: "s1", kind: "satellite", x: -330, y: -190, z: -230, phase: 0.6 },
  { id: "s2", kind: "satellite", x: 356, y: -168, z: 200, phase: 1.9 },
  { id: "s3", kind: "satellite", x: -392, y: 236, z: -170, phase: 2.8 },
  { id: "s4", kind: "satellite", x: 404, y: 252, z: 150, phase: 4.2 },
  { id: "s5", kind: "satellite", x: -150, y: 320, z: 210, phase: 3.1 },
  { id: "s6", kind: "satellite", x: 286, y: -308, z: -120, phase: 5.0 },
];

type EdgeKind = "signaling" | "media";

interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
  bend: number;
  /** How many packets ride this edge. */
  packets: number;
}

const EDGES: Edge[] = [
  { from: "signal", to: "a", kind: "signaling", bend: -46, packets: 2 },
  { from: "signal", to: "b", kind: "signaling", bend: 46, packets: 2 },
  { from: "a", to: "core", kind: "signaling", bend: -34, packets: 1 },
  { from: "b", to: "core", kind: "signaling", bend: 34, packets: 1 },
  // The direct path: brightest, thickest, most packets. The whole point.
  // Deep bow so the media arc sweeps well below the call-to-action row
  // instead of cutting straight through it.
  { from: "a", to: "b", kind: "media", bend: 430, packets: 5 },
];

interface Packet {
  edge: number;
  kind: EdgeKind;
  /** Mutated by GSAP; read by the render loop. */
  t: number;
  offset: number;
}

const PERSPECTIVE = 900;

/* -------------------------------------------------------------- component */

export function PeerNetwork3D({ className }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeEls = useRef(new Map<string, HTMLDivElement>());
  const pathEls = useRef<(SVGPathElement | null)[]>([]);
  const packetEls = useRef<(SVGCircleElement | null)[]>([]);

  /** Scene state, mutated by GSAP and read by one rAF. Never React state. */
  const scene = useRef({ rotY: -0.22, rotX: 0.1, breathe: 0, intro: 0 });
  const pointer = useRef({ tx: 0, ty: 0, x: 0, y: 0 });
  const packets = useRef<Packet[]>(
    EDGES.flatMap((e, i) =>
      Array.from({ length: e.packets }, (_, k) => ({
        edge: i,
        kind: e.kind,
        t: 0,
        offset: k / e.packets,
      })),
    ),
  );
  const size = useRef({ w: 0, h: 0 });
  const running = useRef(false);
  const rafId = useRef<number | null>(null);

  /* --------------------------------------------------------- render loop */

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      size.current = { w: r.width, h: r.height };
      const svg = svgRef.current;
      if (svg) svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
    };
    measure();

    const reduced = prefersReducedMotion();

    /*
     * Below 1024px there is no gutter for the nodes to occupy — they crowd
     * the viewport edges and the connection lines cut through the copy.
     * Narrow screens are also the devices least able to spare a continuous
     * rAF, so there the visual is hidden by CSS and the loop never starts.
     */
    const wideEnough = window.matchMedia("(min-width: 1024px)");
    if (!wideEnough.matches) return;

    /**
     * One frame: project every node, write transforms, rebuild the curves,
     * then place the packets along those same curves.
     *
     * Everything is written directly to the DOM. Putting per-frame geometry
     * into React state would re-render the whole hero 60 times a second.
     */
    const draw = () => {
      const { w, h } = size.current;
      if (w === 0) return;
      const cx = w / 2;
      const cy = h / 2;
      // Scale the scene to the container so it works from 320px up.
      const fit = Math.min(w / 1180, h / 780, 1.1);

      const rot = {
        rotY: scene.current.rotY + pointer.current.x * 0.16,
        rotX: scene.current.rotX + pointer.current.y * 0.1,
      };

      const projected = new Map<string, Projected>();

      for (const n of NODES) {
        // Vertical drift — the "breathing". Tiny, slow, out of phase.
        const bob = Math.sin(scene.current.breathe + n.phase) * 10;
        const p = project({ x: n.x, y: n.y + bob, z: n.z }, rot, PERSPECTIVE);

        const sx = cx + p.x * fit;
        const sy = cy + p.y * fit;
        projected.set(n.id, { ...p, x: sx, y: sy });

        const dom = nodeEls.current.get(n.id);
        if (!dom) continue;

        const s = p.scale * fit * (0.9 + scene.current.intro * 0.1);
        dom.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%) scale(${s})`;
        const isCard = n.kind === "browser" || n.kind === "signal";
        const base = depthOpacity(p.z);
        dom.style.opacity = String((isCard ? 0.55 + base * 0.45 : base) * scene.current.intro);
        // Keep labelled cards legible; only ambient geometry blurs hard.
        const blur = depthBlur(p.z, 420, n.kind === "satellite" ? 3.5 : 1.4);
        dom.style.filter = blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : "";
        // Painter's algorithm: nearer nodes sit above further ones.
        dom.style.zIndex = String(Math.round(500 - p.z));
      }

      // Connections.
      for (let i = 0; i < EDGES.length; i++) {
        const e = EDGES[i]!;
        const a = projected.get(e.from);
        const b = projected.get(e.to);
        const path = pathEls.current[i];
        if (!a || !b || !path) continue;

        const ctrl = controlPoint(a.x, a.y, b.x, b.y, e.bend * fit);
        path.setAttribute("d", `M ${a.x} ${a.y} Q ${ctrl.x} ${ctrl.y} ${b.x} ${b.y}`);
        // Links fade with the average depth of their endpoints.
        const depth = (depthOpacity(a.z) + depthOpacity(b.z)) / 2;
        path.style.opacity = String(depth * scene.current.intro * (e.kind === "media" ? 1 : 0.55));
      }

      // Packets ride the identical curve, so they can never drift off a line.
      for (let i = 0; i < packets.current.length; i++) {
        const pk = packets.current[i]!;
        const circle = packetEls.current[i];
        const e = EDGES[pk.edge]!;
        const a = projected.get(e.from);
        const b = projected.get(e.to);
        if (!a || !b || !circle) continue;

        const t = (pk.t + pk.offset) % 1;
        const ctrl = controlPoint(a.x, a.y, b.x, b.y, e.bend * fit);
        const pt = quadPoint(a.x, a.y, ctrl.x, ctrl.y, b.x, b.y, t);

        circle.setAttribute("cx", pt.x.toFixed(2));
        circle.setAttribute("cy", pt.y.toFixed(2));
        // Fade in and out at the ends so packets emerge from the nodes.
        const edgeFade = Math.sin(t * Math.PI);
        circle.style.opacity = String(edgeFade * scene.current.intro);
        const r = (e.kind === "media" ? 3.6 : 2.6) * (0.8 + a.scale * 0.2);
        circle.setAttribute("r", r.toFixed(2));
      }
    };

    const tick = () => {
      // Ease the pointer so parallax glides instead of snapping.
      pointer.current.x += (pointer.current.tx - pointer.current.x) * 0.045;
      pointer.current.y += (pointer.current.ty - pointer.current.y) * 0.045;
      draw();
      rafId.current = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running.current || reduced) return;
      running.current = true;
      rafId.current = requestAnimationFrame(tick);
    };
    const stop = () => {
      running.current = false;
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      rafId.current = null;
    };

    if (reduced) {
      // Static, fully visible composition — no loop, no motion.
      scene.current.intro = 1;
      draw();
    } else {
      // Only animate while actually on screen and the tab is focused.
      const io = new IntersectionObserver(
        ([entry]) => (entry?.isIntersecting ? start() : stop()),
        { threshold: 0.01 },
      );
      io.observe(el);

      const onVisibility = () => (document.hidden ? stop() : start());
      document.addEventListener("visibilitychange", onVisibility);

      const ro = new ResizeObserver(() => {
        measure();
        draw();
      });
      ro.observe(el);

      const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        pointer.current.tx = (e.clientX - (r.left + r.width / 2)) / r.width;
        pointer.current.ty = (e.clientY - (r.top + r.height / 2)) / r.height;
      };
      if (fine) window.addEventListener("pointermove", onMove, { passive: true });

      return () => {
        stop();
        io.disconnect();
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        if (fine) window.removeEventListener("pointermove", onMove);
      };
    }

    const ro = new ResizeObserver(() => {
      measure();
      draw();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------------------------------------------------------- GSAP drive */

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const s = scene.current;

      // Entrance: the scene assembles rather than appearing.
      gsap.fromTo(
        s,
        { intro: 0 },
        { intro: 1, duration: 1.8, ease: "power2.out", delay: 0.25 },
      );
      gsap.fromTo(
        s,
        { rotY: -0.9 },
        { rotY: -0.22, duration: 2.6, ease: "expo.out", delay: 0.15 },
      );

      // Continuous, very slow turntable — the "breathing".
      gsap.to(s, {
        rotY: "+=0.42",
        duration: 26,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: 2.6,
      });
      gsap.to(s, {
        rotX: 0.02,
        duration: 15,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
      gsap.to(s, { breathe: Math.PI * 2, duration: 14, ease: "none", repeat: -1 });

      // Packets. Signalling traffic is quick and bursty; media is a steady
      // stream — the difference is legible at a glance.
      for (const pk of packets.current) {
        gsap.to(pk, {
          t: 1,
          duration: pk.kind === "media" ? 3.4 : 2.2,
          ease: "none",
          repeat: -1,
        });
      }

      gsap.to("[data-core-ring]", {
        scale: 1.35,
        opacity: 0,
        duration: 2.8,
        ease: "power2.out",
        repeat: -1,
        stagger: 0.9,
      });
    },
    { scope: root },
  );

  /* -------------------------------------------------------------- render */

  return (
    <div
      ref={root}
      aria-hidden
      data-peer-network
      className={cn(
        "pointer-events-none absolute inset-0 hidden overflow-hidden lg:block",
        className,
      )}
      style={{ perspective: `${PERSPECTIVE}px` }}
    >
      {/* Connections and packets share one SVG so they cannot desynchronise. */}
      <svg ref={svgRef} className="absolute inset-0 size-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pn-media" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.64 0.191 281)" />
            <stop offset="50%" stopColor="oklch(0.75 0.16 300)" />
            <stop offset="100%" stopColor="oklch(0.79 0.142 196)" />
          </linearGradient>
          <filter id="pn-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {EDGES.map((e, i) => (
          <path
            key={`${e.from}-${e.to}`}
            ref={(el) => {
              pathEls.current[i] = el;
            }}
            fill="none"
            stroke={e.kind === "media" ? "url(#pn-media)" : "oklch(0.64 0.191 281)"}
            strokeWidth={e.kind === "media" ? 2.4 : 1.2}
            strokeLinecap="round"
            strokeDasharray={e.kind === "signaling" ? "5 9" : undefined}
            opacity={0}
            filter={e.kind === "media" ? "url(#pn-glow)" : undefined}
          />
        ))}

        {packets.current.map((pk, i) => (
          <circle
            key={i}
            ref={(el) => {
              packetEls.current[i] = el;
            }}
            r={3}
            fill={pk.kind === "media" ? "oklch(0.88 0.13 196)" : "oklch(0.82 0.13 285)"}
            opacity={0}
            filter="url(#pn-glow)"
          />
        ))}
      </svg>

      {/* Nodes are real DOM so they can use glass, borders and type. */}
      {NODES.map((n) => (
        <div
          key={n.id}
          ref={(el) => {
            if (el) nodeEls.current.set(n.id, el);
            else nodeEls.current.delete(n.id);
          }}
          data-node={n.id}
          className="absolute left-0 top-0 opacity-0 will-change-transform"
          style={{ transformStyle: "preserve-3d" }}
        >
          <NodeVisual node={n} />
        </div>
      ))}
    </div>
  );
}

function NodeVisual({ node }: { node: SceneNode }) {
  if (node.kind === "satellite") {
    return (
      <span
        className="block size-2 rounded-full bg-violet/70"
        style={{ boxShadow: "0 0 14px 2px oklch(0.64 0.191 281 / 45%)" }}
      />
    );
  }

  if (node.kind === "core") {
    return (
      <div className="relative flex size-16 items-center justify-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            data-core-ring
            className="absolute inset-0 rounded-full border border-live/50"
          />
        ))}
        <div
          className="flex size-9 items-center justify-center rounded-full border border-live/40 backdrop-blur-md"
          style={{
            background:
              "radial-gradient(circle at 30% 25%, oklch(0.42 0.12 200 / 75%), oklch(0.18 0.03 250 / 85%))",
            boxShadow: "0 0 34px -4px oklch(0.79 0.142 196 / 55%)",
          }}
        >
          <span className="size-2 rounded-full bg-live" />
        </div>
      </div>
    );
  }

  if (node.kind === "signal") {
    return (
      <div className="relative flex size-10 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-violet/35" />
        <span
          className="size-2.5 rounded-full bg-violet"
          style={{ boxShadow: "0 0 18px 3px oklch(0.64 0.191 281 / 55%)" }}
        />
      </div>
    );
  }

  const isSignal = false;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border backdrop-blur-md",
        isSignal ? "size-auto px-4 py-2.5" : "w-36 px-4 py-3.5",
        isSignal ? "border-white/12" : "border-violet/35",
      )}
      style={{
        background: isSignal
          ? "linear-gradient(150deg, oklch(0.24 0.012 265 / 70%), oklch(0.15 0.01 265 / 78%))"
          : "linear-gradient(150deg, oklch(0.30 0.07 281 / 72%), oklch(0.16 0.03 281 / 82%))",
        boxShadow: isSignal
          ? "inset 0 1px 0 0 oklch(1 0 0 / 10%)"
          : "inset 0 1px 0 0 oklch(1 0 0 / 14%), 0 18px 50px -20px oklch(0.64 0.191 281 / 65%)",
      }}
    >
      <span
        className={cn(
          "font-semibold tracking-tight",
          isSignal ? "text-[10px] text-muted-foreground" : "text-xs text-white",
        )}
      >
        {node.label}
      </span>
      {node.sub && (
        <span className={cn("text-[8px]", isSignal ? "text-muted-foreground/70" : "text-violet-soft")}>
          {node.sub}
        </span>
      )}
    </div>
  );
}
