"use client";

import { useEffect, useRef, useState } from "react";
import type { PeerId } from "@/types";

interface SpeakerSource {
  id: PeerId;
  stream: MediaStream | null;
}

/**
 * Detects which REMOTE participants are speaking.
 *
 * Design choice: each client analyses the audio it receives, rather than
 * peers broadcasting "I am talking" over the data channel. Analysing locally
 * is authoritative — it reflects what you can actually hear, survives a
 * degraded data channel, and cannot be desynchronised by a peer whose
 * message was dropped.
 *
 * Cost is controlled by sharing ONE AudioContext and ONE requestAnimationFrame
 * loop across every peer. Browsers cap AudioContexts per page (typically ~6),
 * so creating one per participant would break a full room outright.
 */
export interface SpeakerSignal {
  speaking: boolean;
  /** 0-1 smoothed RMS — drives the animated mic ring, not just on/off. */
  level: number;
}

export function useActiveSpeakers(sources: SpeakerSource[]): Record<PeerId, SpeakerSignal> {
  const [signals, setSignals] = useState<Record<PeerId, SpeakerSignal>>({});

  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef(
    new Map<
      PeerId,
      {
        src: MediaStreamAudioSourceNode;
        analyser: AnalyserNode;
        buf: Float32Array<ArrayBuffer>;
        quiet: number;
        on: boolean;
        level: number;
      }
    >(),
  );
  const rafRef = useRef<number | null>(null);

  // Identity of the current source set — lets the effect re-run only when the
  // actual peers or streams change, not on every parent render.
  const key = sources.map((s) => `${s.id}:${s.stream?.id ?? "none"}`).join("|");

  useEffect(() => {
    const withAudio = sources.filter(
      (s) => s.stream && s.stream.getAudioTracks().length > 0,
    );

    if (withAudio.length === 0) {
      setSignals({});
      return;
    }

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    ctxRef.current ??= new AudioCtx();
    const ctx = ctxRef.current;
    const nodes = nodesRef.current;

    // Add analysers for new peers.
    for (const { id, stream } of withAudio) {
      if (nodes.has(id) || !stream) continue;
      try {
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.7;
        src.connect(analyser);
        // Deliberately NOT connected to ctx.destination — the <video>
        // element already plays this audio. Connecting here would play it
        // a second time.
        nodes.set(id, {
          src,
          analyser,
          buf: new Float32Array(new ArrayBuffer(analyser.fftSize * 4)),
          quiet: 0,
          on: false,
          level: 0,
        });
      } catch {
        /* stream ended between render and now */
      }
    }

    // Remove analysers for departed peers.
    const live = new Set(withAudio.map((s) => s.id));
    for (const [id, node] of nodes) {
      if (live.has(id)) continue;
      node.src.disconnect();
      node.analyser.disconnect();
      nodes.delete(id);
    }

    const ON = 0.045;
    const OFF = 0.028;

    let lastPush = 0;

    const tick = () => {
      let changed = false;
      const next: Record<PeerId, SpeakerSignal> = {};

      for (const [id, node] of nodes) {
        node.analyser.getFloatTimeDomainData(node.buf);
        let sum = 0;
        for (const v of node.buf) sum += v * v;
        const rms = Math.sqrt(sum / node.buf.length);

        if (rms > ON) {
          node.quiet = 0;
          if (!node.on) {
            node.on = true;
            changed = true;
          }
        } else if (rms < OFF) {
          node.quiet++;
          // ~400ms of quiet before clearing: speech has natural pauses, and
          // a ring that strobes between words is worse than none at all.
          if (node.on && node.quiet > 24) {
            node.on = false;
            changed = true;
          }
        }
        // Smooth the level so the ring breathes instead of jittering.
        node.level = node.level * 0.75 + Math.min(1, rms * 6) * 0.25;
        next[id] = { speaking: node.on, level: node.level };
      }

      // Push immediately on a speaking flip; otherwise throttle level updates
      // to ~12/s. Writing every frame would re-render the whole grid at 60Hz
      // while video is decoding.
      const now = performance.now();
      if (changed || now - lastPush > 80) {
        lastPush = now;
        setSignals(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Release the shared AudioContext when the call ends.
  useEffect(() => {
    const nodes = nodesRef.current;
    return () => {
      for (const node of nodes.values()) {
        node.src.disconnect();
        node.analyser.disconnect();
      }
      nodes.clear();
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return signals;
}
