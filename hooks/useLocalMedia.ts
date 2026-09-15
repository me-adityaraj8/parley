"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DeviceInventory,
  DeviceSelection,
  MediaFailure,
  MediaFlags,
  PermissionState,
} from "@/types";
import { checkMediaSupport, describeMediaError } from "@/lib/media/errors";
import {
  audioConstraints,
  enumerateDevices,
  videoConstraints,
} from "@/lib/media/devices";

interface UseLocalMediaResult {
  stream: MediaStream | null;
  permission: PermissionState;
  failure: MediaFailure | null;
  devices: DeviceInventory;
  selection: DeviceSelection;
  flags: MediaFlags;
  start: () => Promise<MediaStream | null>;
  stop: () => void;
  toggleAudio: (on?: boolean) => void;
  toggleVideo: (on?: boolean) => void;
  selectDevice: (kind: "audioInput" | "videoInput" | "audioOutput", id: string) => void;
  retry: () => Promise<MediaStream | null>;
}

const EMPTY_DEVICES: DeviceInventory = {
  audioInputs: [],
  videoInputs: [],
  audioOutputs: [],
};

/**
 * Owns the local camera and microphone.
 *
 * THE KEY CONCEPT — MediaStream vs MediaStreamTrack
 *
 * `getUserMedia` returns a MediaStream: a container. Inside it are
 * MediaStreamTracks — one for audio, one for video. Tracks are the real
 * unit of work in WebRTC: you send tracks, you replace tracks, you mute
 * tracks. The stream is just a convenient bag.
 *
 * MUTING: we set `track.enabled = false`. The track stays live and attached
 * to the peer connection, but transmits silence/black. We deliberately do
 * NOT call `track.stop()` — that permanently ends the track, turns off the
 * camera light, and would require a full renegotiation to undo. `enabled`
 * is instant and needs no signaling at all.
 */
export function useLocalMedia(): UseLocalMediaResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permission, setPermission] = useState<PermissionState>("idle");
  const [failure, setFailure] = useState<MediaFailure | null>(null);
  const [devices, setDevices] = useState<DeviceInventory>(EMPTY_DEVICES);
  const [selection, setSelection] = useState<DeviceSelection>({
    audioInput: null,
    videoInput: null,
    audioOutput: null,
  });
  const [flags, setFlags] = useState<MediaFlags>({
    audio: true,
    video: true,
    screen: false,
  });

  // A ref mirror of the stream so cleanup can reach the current tracks
  // without the effect depending on stream identity.
  const streamRef = useRef<MediaStream | null>(null);
  const selectionRef = useRef(selection);
  const flagsRef = useRef(flags);
  selectionRef.current = selection;
  flagsRef.current = flags;

  const stopStream = useCallback((s: MediaStream | null) => {
    if (!s) return;
    // Every track must be stopped individually. Dropping the reference to
    // the MediaStream does NOT release the hardware — the camera light stays
    // on until every track is stopped. This is the single most common
    // WebRTC resource leak.
    for (const track of s.getTracks()) track.stop();
  }, []);

  const acquire = useCallback(async (): Promise<MediaStream | null> => {
    const unsupported = checkMediaSupport();
    if (unsupported) {
      setFailure(unsupported);
      setPermission("denied");
      return null;
    }

    setPermission("prompting");
    setFailure(null);

    const { audioInput, videoInput } = selectionRef.current;

    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints(audioInput),
        video: videoConstraints(videoInput),
      });

      // Replace, never accumulate: stop whatever we held before.
      stopStream(streamRef.current);
      streamRef.current = next;
      setStream(next);
      setPermission("granted");

      // Re-apply the user's mute state to the newly acquired tracks —
      // switching a device must not silently unmute you.
      const f = flagsRef.current;
      for (const t of next.getAudioTracks()) t.enabled = f.audio;
      for (const t of next.getVideoTracks()) t.enabled = f.video;

      // Labels are only populated after permission is granted, so this is
      // the earliest useful moment to build the device picker.
      setDevices(await enumerateDevices());
      return next;
    } catch (err) {
      const described = describeMediaError(err, "camera");

      // Graceful degradation: no camera should still let you join by voice.
      if (described.kind === "no-device" || described.kind === "constraints") {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints(audioInput),
            video: false,
          });
          stopStream(streamRef.current);
          streamRef.current = audioOnly;
          setStream(audioOnly);
          setPermission("granted");
          setFlags((p) => ({ ...p, video: false }));
          setFailure({
            ...described,
            title: "Joined without video",
            detail: "We could not start a camera, so you are audio-only.",
          });
          setDevices(await enumerateDevices());
          return audioOnly;
        } catch {
          /* fall through to the original failure */
        }
      }

      setFailure(described);
      setPermission(described.kind === "permission-denied" ? "denied" : "idle");
      return null;
    }
  }, [stopStream]);

  const stop = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
    setPermission("idle");
  }, [stopStream]);

  const toggleAudio = useCallback((on?: boolean) => {
    setFlags((prev) => {
      const next = on ?? !prev.audio;
      for (const t of streamRef.current?.getAudioTracks() ?? []) t.enabled = next;
      return { ...prev, audio: next };
    });
  }, []);

  const toggleVideo = useCallback((on?: boolean) => {
    setFlags((prev) => {
      const next = on ?? !prev.video;
      for (const t of streamRef.current?.getVideoTracks() ?? []) t.enabled = next;
      return { ...prev, video: next };
    });
  }, []);

  const selectDevice = useCallback(
    (kind: "audioInput" | "videoInput" | "audioOutput", id: string) => {
      setSelection((prev) => ({ ...prev, [kind]: id }));
    },
    [],
  );

  // Re-acquire when the chosen input device changes. Output (speaker) is
  // applied directly to <audio> elements via setSinkId, so it must not
  // trigger a re-acquire.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (permission !== "granted") return;
    void acquire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.audioInput, selection.videoInput]);

  // Devices can appear and disappear mid-call (a headset is unplugged, a
  // USB camera is connected). Without this listener the picker goes stale
  // and selecting a removed device throws OverconstrainedError.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    const onChange = () => {
      void enumerateDevices().then(setDevices);
    };
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", onChange);
  }, []);

  // Final safety net: release hardware if the component tree unmounts
  // without an explicit stop() (navigation away, tab close, crash).
  useEffect(() => {
    return () => {
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [stopStream]);

  return {
    stream,
    permission,
    failure,
    devices,
    selection,
    flags,
    start: acquire,
    stop,
    toggleAudio,
    toggleVideo,
    selectDevice,
    retry: acquire,
  };
}
