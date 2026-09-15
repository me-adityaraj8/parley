/** Local media acquisition, device selection, and failure modes. */

export type MediaErrorKind =
  | "permission-denied"
  | "no-device"
  | "device-in-use"
  | "constraints"
  | "insecure-context"
  | "unsupported"
  | "unknown";

/** A media failure translated into something a human can act on. */
export interface MediaFailure {
  kind: MediaErrorKind;
  title: string;
  detail: string;
  /** Whether retrying could plausibly succeed (e.g. after granting access). */
  retryable: boolean;
}

export type PermissionState = "idle" | "prompting" | "granted" | "denied";

export interface DeviceOption {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface DeviceSelection {
  audioInput: string | null;
  videoInput: string | null;
  audioOutput: string | null;
}

export interface DeviceInventory {
  audioInputs: DeviceOption[];
  videoInputs: DeviceOption[];
  audioOutputs: DeviceOption[];
}
