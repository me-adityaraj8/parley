"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Measures how loud a stream is, for the mic test and active-speaker ring.
 *
 * HOW: the Web Audio API exposes an AnalyserNode that reads the raw samples
 * flowing through a stream. We take the RMS (root mean square) of each frame
 * — a better proxy for perceived loudness than peak amplitude, which spikes
 * on transients like a keyboard click.
 *
 * Note this is completely independent of WebRTC. It reads the local
 * MediaStream directly, so it works in the lobby before any call exists.
 */
export function useAudioLevel(
  stream: MediaStream | null,
  enabled = true,
): { level: number; speaking: boolean } {
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !enabled) {
      setLevel(0);
      setSpeaking(false);
      return;
    }
    const tracks = stream.getAudioTracks();
    if (tracks.length === 0) return;

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    // Small FFT keeps this cheap; we only need loudness, not spectrum.
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    // Hysteresis: separate on/off thresholds stop the indicator strobing
    // when someone speaks near the threshold.
    const ON = 0.045;
    const OFF = 0.028;
    let quietFrames = 0;
    let isSpeaking = false;

    const tick = () => {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (const v of buffer) sum += v * v;
      const rms = Math.sqrt(sum / buffer.length);

      setLevel(Math.min(1, rms * 6));

      if (rms > ON) {
        quietFrames = 0;
        if (!isSpeaking) {
          isSpeaking = true;
          setSpeaking(true);
        }
      } else if (rms < OFF) {
        quietFrames++;
        // ~400ms of quiet before we call it: natural speech has pauses.
        if (isSpeaking && quietFrames > 24) {
          isSpeaking = false;
          setSpeaking(false);
        }
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      source.disconnect();
      analyser.disconnect();
      // AudioContexts are a limited resource — browsers cap them per page.
      void ctx.close();
    };
  }, [stream, enabled]);

  return { level, speaking };
}
