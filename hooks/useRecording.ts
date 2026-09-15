"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

/**
 * LOCAL call recording via MediaRecorder.
 *
 * Important scope note, reflected in the UI: this records only what THIS
 * browser can produce locally — your own camera and microphone. Recording
 * every remote participant would mean compositing their streams onto a
 * canvas and mixing their audio, which is a genuinely different feature and
 * would misrepresent what is happening. Nothing is uploaded; the result is a
 * Blob in memory that you download.
 */
export function useRecording(stream: MediaStream | null) {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);
  const startedAt = useRef(0);
  const accumulated = useRef(0);

  const supported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof MediaRecorder.isTypeSupported === "function";

  /** Browsers disagree on containers; pick the first supported one. */
  const pickMimeType = useCallback((): string | undefined => {
    if (!supported) return undefined;
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    return candidates.find((c) => MediaRecorder.isTypeSupported(c));
  }, [supported]);

  const tick = useCallback(() => {
    setElapsed(accumulated.current + (performance.now() - startedAt.current));
  }, []);

  const start = useCallback(() => {
    if (!stream || !supported) {
      setError(!supported ? "Recording is not supported in this browser." : "No media to record.");
      return;
    }
    if (stream.getTracks().length === 0) {
      setError("Your camera and microphone are off.");
      return;
    }

    try {
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      if (url) URL.revokeObjectURL(url);
      setUrl(null);
      setError(null);

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: mimeType ?? "video/webm" });
        chunks.current = [];
        setUrl(URL.createObjectURL(blob));
        setState("stopped");
      };
      rec.onerror = () => {
        setError("Recording stopped unexpectedly.");
        setState("idle");
      };

      // Timeslice so data is flushed periodically — without it a crash loses
      // the entire recording.
      rec.start(1000);
      recorder.current = rec;
      accumulated.current = 0;
      startedAt.current = performance.now();
      setElapsed(0);
      setState("recording");
      timer.current = window.setInterval(tick, 200);
    } catch {
      setError("Could not start recording.");
    }
  }, [stream, supported, pickMimeType, url, tick]);

  const pause = useCallback(() => {
    if (recorder.current?.state !== "recording") return;
    recorder.current.pause();
    accumulated.current += performance.now() - startedAt.current;
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    if (recorder.current?.state !== "paused") return;
    recorder.current.resume();
    startedAt.current = performance.now();
    timer.current = window.setInterval(tick, 200);
    setState("recording");
  }, [tick]);

  const stop = useCallback(() => {
    if (!recorder.current || recorder.current.state === "inactive") return;
    recorder.current.stop();
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  }, []);

  const reset = useCallback(() => {
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    setElapsed(0);
    setState("idle");
  }, [url]);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      if (recorder.current && recorder.current.state !== "inactive") {
        try {
          recorder.current.stop();
        } catch {
          /* already stopped */
        }
      }
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, elapsed, url, error, supported, start, pause, resume, stop, reset };
}
