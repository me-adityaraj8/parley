import type { MediaFailure } from "@/types";

/**
 * Translates the raw exceptions getUserMedia/getDisplayMedia throw into
 * something a person can act on.
 *
 * The browser's own error names are precise but useless to users:
 * "NotReadableError" means "another app has your camera", and no user will
 * ever work that out. Your spec said never show raw technical errors — this
 * is where that is enforced, once, for every caller.
 */
export function describeMediaError(err: unknown, kindHint?: "camera" | "screen"): MediaFailure {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return {
      kind: "insecure-context",
      title: "Secure connection required",
      detail:
        "Browsers only allow camera and microphone access over HTTPS. Open this page on a secure address and try again.",
      retryable: false,
    };
  }

  if (!(err instanceof DOMException)) {
    return {
      kind: "unknown",
      title: "Something went wrong",
      detail: "We could not start your camera and microphone. Try again.",
      retryable: true,
    };
  }

  switch (err.name) {
    case "NotAllowedError":
    case "SecurityError":
      return kindHint === "screen"
        ? {
            kind: "permission-denied",
            title: "Screen share cancelled",
            detail: "You dismissed the picker, so nothing is being shared.",
            retryable: true,
          }
        : {
            kind: "permission-denied",
            title: "Camera and microphone blocked",
            detail:
              "Your browser is blocking access. Click the camera icon in the address bar, allow access, then try again.",
            retryable: true,
          };

    case "NotFoundError":
    case "OverconstrainedError" as string:
      if (err.name === "NotFoundError") {
        return {
          kind: "no-device",
          title: "No camera or microphone found",
          detail:
            "We could not find any capture devices. Connect one, or join with audio only.",
          retryable: true,
        };
      }
      return {
        kind: "constraints",
        title: "Device settings not supported",
        detail:
          "The selected camera cannot run at the requested quality. We will fall back to its default settings.",
        retryable: true,
      };

    case "NotReadableError":
    case "AbortError":
      return {
        kind: "device-in-use",
        title: "Your camera is busy",
        detail:
          "Another application is using it. Close any other video app — including other browser tabs — and try again.",
        retryable: true,
      };

    case "TypeError":
      return {
        kind: "unsupported",
        title: "Not supported in this browser",
        detail: "This browser does not support the media features Parley needs.",
        retryable: false,
      };

    default:
      return {
        kind: "unknown",
        title: "Could not start your devices",
        detail: "An unexpected problem occurred while starting your camera.",
        retryable: true,
      };
  }
}

/** Fails fast with a clear message rather than throwing deep inside a hook. */
export function checkMediaSupport(): MediaFailure | null {
  if (typeof navigator === "undefined") return null;

  if (!window.isSecureContext) {
    return {
      kind: "insecure-context",
      title: "Secure connection required",
      detail: "Camera access needs HTTPS. Open this page over a secure address.",
      retryable: false,
    };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      kind: "unsupported",
      title: "Browser not supported",
      detail:
        "Parley needs a modern browser with WebRTC support — try the latest Chrome, Edge, Firefox or Safari.",
      retryable: false,
    };
  }
  if (typeof RTCPeerConnection === "undefined") {
    return {
      kind: "unsupported",
      title: "WebRTC unavailable",
      detail: "This browser cannot make peer-to-peer connections.",
      retryable: false,
    };
  }
  return null;
}
