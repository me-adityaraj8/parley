"use client";

/**
 * TEMPORARY stack-verification page.
 * Replaced by the real landing page in Phase 09 (Task 9.1).
 */

import { useRef } from "react";
import { Video, MessageSquare, MonitorUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gsap, useGSAP } from "@/lib/gsap";

const ITEMS = [
  { icon: Video, label: "Peer-to-peer video" },
  { icon: MonitorUp, label: "Screen sharing" },
  { icon: MessageSquare, label: "Data channel chat" },
];

export default function StackCheckPage() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // fromTo, never from — see lib/animations. `from` infers its end value
      // from the element's current state, which React StrictMode's double
      // effect invocation can capture mid-animation, freezing elements at 0.
      gsap
        .timeline()
        .fromTo(
          "[data-anim='title']",
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1 },
        )
        .fromTo(
          "[data-anim='card']",
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.08 },
          "-=0.5",
        );
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      className="flex min-h-screen flex-col items-center justify-center gap-8 bg-neutral-950 p-8 text-neutral-100"
    >
      <h1 data-anim="title" className="text-4xl font-semibold tracking-tight">
        Parley — stack check
      </h1>

      <div className="flex flex-wrap justify-center gap-4">
        {ITEMS.map(({ icon: Icon, label }) => (
          <div
            key={label}
            data-anim="card"
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-4"
          >
            <Icon className="size-5 text-indigo-400" aria-hidden />
            <span className="text-sm">{label}</span>
          </div>
        ))}
      </div>

      <Button data-anim="card">ShadCN button</Button>
    </div>
  );
}
