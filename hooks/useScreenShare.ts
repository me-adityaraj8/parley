"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaFailure } from "@/types";
import { describeMediaError } from "@/lib/media/errors";

interface UseScreenShareOptions {
  /** The camera stream to restore when sharing stops. */
  localStream: MediaStream | null;
  replaceVideoTrack: (track: MediaStreamTrack | null) => Promise<void>;
}

/**
 * Screen sharing via track replacement.
 *
 * The naive approach is to add the screen as a second video track, which
 * forces a full renegotiation and makes every peer rebuild their layout.
 * Instead we call RTCRtpSender.replaceTrack(): the sender keeps its
 * transport, SSRC and ICE path, and simply starts pulling frames from a
 * different source. Remote peers see their existing <video> change content
 * with no reconnection at all.
 */
export function useScreenShare({
  localStream,
  replaceVideoTrack,
}: UseScreenShareOptions) {
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [failure, setFailure] = useState<MediaFailure | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const screenRef = useRef<MediaStream | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  localRef.current = localStream;

  const supported =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function";

  const stop = useCallback(async () => {
    const screen = screenRef.current;
    screenRef.current = null;

    // Restore the camera track on every peer BEFORE stopping the screen
    // track, so there is never a moment with no video source attached.
    const camera = localRef.current?.getVideoTracks()[0] ?? null;
    await replaceVideoTrack(camera);

    if (screen) for (const t of screen.getTracks()) t.stop();

    setScreenStream(null);
    setSharing(false);
  }, [replaceVideoTrack]);

  const start = useCallback(async () => {
    if (!supported) return;
    setStarting(true);
    setFailure(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        // Screen content is mostly static text; a lower frame rate at higher
        // resolution reads far better than the reverse.
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false,
      });

      const track = stream.getVideoTracks()[0];
      if (!track) {
        for (const t of stream.getTracks()) t.stop();
        setStarting(false);
        return;
      }

      /**
       * The browser renders its own "Stop sharing" bar outside the page.
       * When the user clicks it, the track ends without telling our UI —
       * so we must listen for `ended` or the app would claim to still be
       * sharing a dead track.
       */
      track.addEventListener("ended", () => void stop(), { once: true });

      await replaceVideoTrack(track);
      screenRef.current = stream;
      setScreenStream(stream);
      setSharing(true);
    } catch (err) {
      // Dismissing the picker throws NotAllowedError. That is a choice, not
      // a failure, so we surface nothing.
      const described = describeMediaError(err, "screen");
      if (described.kind !== "permission-denied") setFailure(described);
    } finally {
      setStarting(false);
    }
  }, [supported, replaceVideoTrack, stop]);

  const toggle = useCallback(() => {
    void (sharing ? stop() : start());
  }, [sharing, start, stop]);

  // Releasing the display capture on unmount is important: macOS and Windows
  // both show a persistent system indicator while a capture is live.
  useEffect(() => {
    return () => {
      const s = screenRef.current;
      if (s) for (const t of s.getTracks()) t.stop();
    };
  }, []);

  return { sharing, starting, failure, screenStream, supported, start, stop, toggle };
}
