"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Plays a short test tone so the user can confirm their speakers work before
 * joining. Synthesised with an OscillatorNode rather than shipping an audio
 * file — no asset, no network request, and it routes through the same Web
 * Audio graph the call uses.
 */
export function useSpeakerTest(sinkId: string | null) {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  const play = useCallback(async () => {
    if (playing) return;
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = ctxRef.current ?? new AudioCtx();
      ctxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();

      /**
       * Routing to a chosen speaker needs setSinkId, which exists on media
       * ELEMENTS, not on AudioContext in most browsers. We render the tone
       * into a MediaStreamDestination and play it through an <audio> element
       * so the device selection is actually honoured.
       */
      const dest = ctx.createMediaStreamDestination();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = 523.25; // C5 — clearly audible, not piercing
      // Ramp in and out; an abrupt square start produces an unpleasant click.
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.85);

      osc.connect(gain).connect(dest);

      const el = document.createElement("audio");
      el.srcObject = dest.stream;
      if (sinkId && "setSinkId" in el) {
        try {
          await (el as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(sinkId);
        } catch {
          /* fall back to the default output */
        }
      }
      await el.play().catch(() => {});

      osc.start();
      osc.stop(ctx.currentTime + 0.9);
      setPlaying(true);

      timerRef.current = window.setTimeout(() => {
        setPlaying(false);
        el.pause();
        el.srcObject = null;
        osc.disconnect();
        gain.disconnect();
        dest.disconnect();
      }, 950);
    } catch {
      setPlaying(false);
    }
  }, [playing, sinkId]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return { playing, play };
}
