"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { peerConfig } from "@/lib/webrtc/config";

export type NetworkGrade = "idle" | "testing" | "direct" | "relay" | "blocked" | "error";

export interface NetworkResult {
  grade: NetworkGrade;
  /** Milliseconds to gather the first server-reflexive candidate. */
  stunMs: number;
  /** Candidate types discovered, e.g. ["host", "srflx"]. */
  types: string[];
  label: string;
  detail: string;
}

const INITIAL: NetworkResult = {
  grade: "idle",
  stunMs: 0,
  types: [],
  label: "Not tested",
  detail: "Run a check to see whether a direct connection is possible.",
};

/**
 * Pre-call connectivity probe.
 *
 * This runs a REAL ICE gathering cycle against the configured STUN servers
 * using a throwaway RTCPeerConnection — the same machinery a call uses,
 * minus the media. What comes back tells you something genuinely useful
 * before you join:
 *
 *  - a `srflx` candidate means STUN is reachable and a direct peer-to-peer
 *    path is likely,
 *  - only `host` candidates means UDP to STUN is being blocked, and the call
 *    will probably need a TURN relay to work at all,
 *  - the time to first `srflx` is a rough proxy for network responsiveness.
 *
 * Note this measures YOUR path to STUN, not the path to another participant,
 * which cannot be known until someone else is in the room.
 */
export function useNetworkProbe() {
  const [result, setResult] = useState<NetworkResult>(INITIAL);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.onicegatheringstatechange = null;
      try {
        pcRef.current.close();
      } catch {
        /* already closed */
      }
      pcRef.current = null;
    }
  }, []);

  const run = useCallback(async () => {
    cleanup();
    setResult({ ...INITIAL, grade: "testing", label: "Testing…", detail: "Gathering ICE candidates." });

    try {
      const pc = new RTCPeerConnection(peerConfig());
      pcRef.current = pc;
      const types = new Set<string>();
      const started = performance.now();
      let srflxAt = 0;

      // A data channel is needed or there is nothing to gather candidates for.
      pc.createDataChannel("probe");

      const finish = () => {
        cleanup();
        const list = [...types];
        if (types.has("srflx") || types.has("relay")) {
          const ms = Math.round(srflxAt || performance.now() - started);
          setResult({
            grade: types.has("relay") && !types.has("srflx") ? "relay" : "direct",
            stunMs: ms,
            types: list,
            label: ms < 300 ? "Excellent" : ms < 800 ? "Good" : "Slow",
            detail:
              `Reached STUN in ${ms} ms. A direct peer-to-peer connection ` +
              `should work on this network.`,
          });
        } else if (types.size > 0) {
          setResult({
            grade: "blocked",
            stunMs: 0,
            types: list,
            label: "Restricted",
            detail:
              "Only local candidates were found — this network appears to block " +
              "STUN. Calls may fail without a TURN relay.",
          });
        } else {
          setResult({
            grade: "error",
            stunMs: 0,
            types: [],
            label: "Unknown",
            detail: "No ICE candidates were gathered.",
          });
        }
      };

      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          finish();
          return;
        }
        const type = e.candidate.type ?? "";
        if (type) types.add(type);
        if (type === "srflx" && srflxAt === 0) {
          srflxAt = Math.round(performance.now() - started);
        }
      };

      await pc.setLocalDescription(await pc.createOffer());

      // Gathering can hang on hostile networks; report what we have.
      timeoutRef.current = window.setTimeout(finish, 6000);
    } catch {
      cleanup();
      setResult({
        grade: "error",
        stunMs: 0,
        types: [],
        label: "Unavailable",
        detail: "This browser could not run a connectivity check.",
      });
    }
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return { result, run };
}
