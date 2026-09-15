import type { DeviceInventory, DeviceOption } from "@/types";

const EMPTY: DeviceInventory = { audioInputs: [], videoInputs: [], audioOutputs: [] };

/**
 * Enumerates capture devices.
 *
 * Important browser behaviour: before the user grants permission,
 * enumerateDevices() returns entries with EMPTY labels. That is a
 * deliberate anti-fingerprinting measure — you cannot show a useful device
 * picker until after the first successful getUserMedia call. The lobby
 * therefore requests media first, then enumerates.
 */
export async function enumerateDevices(): Promise<DeviceInventory> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return EMPTY;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const map = (kind: MediaDeviceKind): DeviceOption[] =>
      devices
        .filter((d) => d.kind === kind && d.deviceId !== "")
        .map((d, i) => ({
          deviceId: d.deviceId,
          kind: d.kind,
          label: d.label || fallbackLabel(kind, i),
        }));

    return {
      audioInputs: map("audioinput"),
      videoInputs: map("videoinput"),
      audioOutputs: map("audiooutput"),
    };
  } catch {
    return EMPTY;
  }
}

function fallbackLabel(kind: MediaDeviceKind, index: number): string {
  const noun =
    kind === "videoinput" ? "Camera" : kind === "audioinput" ? "Microphone" : "Speaker";
  return `${noun} ${index + 1}`;
}

/** Quality ladder. 720p is the sweet spot for mesh calls — see README. */
export function videoConstraints(deviceId: string | null): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: deviceId ? undefined : "user",
  };
}

export function audioConstraints(deviceId: string | null): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    // These three are what make a call sound like a call rather than a
    // feedback loop. All are implemented natively by the browser.
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
}

/** Attaching audio output to a specific device is Chromium-only today. */
export function canSelectSpeaker(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype
  );
}
