"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CallHealth, CallStats, DirectionStats, PeerStats } from "@/types/stats";
import { EMPTY_DIRECTION } from "@/types/stats";
import type { PeerId } from "@/types";

interface Snapshot {
  bytes: number;
  packets: number;
  lost: number;
  at: number;
}

interface UseCallStatsOptions {
  getConnections: () => { id: PeerId; name: string; pc: RTCPeerConnection }[];
  /** Only poll while the HUD is visible — getStats() is not free. */
  enabled: boolean;
  intervalMs?: number;
}

/**
 * Live WebRTC diagnostics from RTCPeerConnection.getStats().
 *
 * TWO THINGS MAKE THIS NON-TRIVIAL:
 *
 * 1. Most counters are CUMULATIVE for the life of the connection.
 *    `bytesReceived` alone tells you nothing about current bitrate, and
 *    lifetime `packetsLost` keeps showing a blip from 10 minutes ago. Both
 *    must be differentiated against the previous poll, which is why we keep
 *    a per-stream snapshot in a ref.
 *
 * 2. The report is a flat Map of interlinked objects. To get a codec name
 *    you read `inbound-rtp.codecId`, then look that id up in the same map.
 *    Same for the candidate pair behind a connection.
 *
 * Polling runs on a timer in a ref and writes to React state at most once
 * per interval, so high-frequency stats never drive the render loop.
 */
export function useCallStats({
  getConnections,
  enabled,
  intervalMs = 1000,
}: UseCallStatsOptions) {
  const [stats, setStats] = useState<CallStats | null>(null);
  const prev = useRef(new Map<string, Snapshot>());
  const timer = useRef<number | null>(null);
  const getConnectionsRef = useRef(getConnections);
  getConnectionsRef.current = getConnections;

  const sample = useCallback(async () => {
    const conns = getConnectionsRef.current();
    if (conns.length === 0) {
      setStats(null);
      return;
    }

    const peers: PeerStats[] = [];

    for (const { id, name, pc } of conns) {
      let report: RTCStatsReport;
      try {
        report = await pc.getStats();
      } catch {
        continue;
      }

      const byId = new Map<string, Record<string, unknown>>();
      report.forEach((v, k) => byId.set(k, v as Record<string, unknown>));

      const num = (v: unknown): number => (typeof v === "number" ? v : 0);
      const str = (v: unknown): string => (typeof v === "string" ? v : "");

      const codecOf = (codecId: unknown): string => {
        const codec = byId.get(str(codecId));
        const mime = str(codec?.["mimeType"]);
        return mime ? mime.split("/")[1]?.toUpperCase() ?? mime : "";
      };

      /** Differentiate cumulative counters against the previous poll. */
      const direction = (
        s: Record<string, unknown> | undefined,
        key: string,
        outbound: boolean,
      ): DirectionStats => {
        if (!s) return { ...EMPTY_DIRECTION };

        const bytes = num(s[outbound ? "bytesSent" : "bytesReceived"]);
        const packets = num(s[outbound ? "packetsSent" : "packetsReceived"]);
        const lost = num(s["packetsLost"]);
        const now = performance.now();

        const last = prev.current.get(key);
        prev.current.set(key, { bytes, packets, lost, at: now });

        let kbps = 0;
        let lossPct = 0;
        if (last && now > last.at) {
          const secs = (now - last.at) / 1000;
          kbps = Math.max(0, ((bytes - last.bytes) * 8) / 1000 / secs);
          const dPackets = packets - last.packets;
          const dLost = lost - last.lost;
          // Recent loss, not lifetime — a spike must be able to recover.
          if (dPackets + dLost > 0) {
            lossPct = Math.max(0, (dLost / (dPackets + dLost)) * 100);
          }
        }

        return {
          kbps,
          packets,
          packetsLost: lost,
          lossPct,
          jitterMs: num(s["jitter"]) * 1000,
          width: num(s[outbound ? "frameWidth" : "frameWidth"]),
          height: num(s[outbound ? "frameHeight" : "frameHeight"]),
          fps: num(s["framesPerSecond"]),
          codec: codecOf(s["codecId"]),
        };
      };

      let inVideo: Record<string, unknown> | undefined;
      let inAudio: Record<string, unknown> | undefined;
      let outVideo: Record<string, unknown> | undefined;
      let pair: Record<string, unknown> | undefined;

      byId.forEach((s) => {
        const type = str(s["type"]);
        const kind = str(s["kind"]) || str(s["mediaType"]);
        if (type === "inbound-rtp" && kind === "video") inVideo = s;
        else if (type === "inbound-rtp" && kind === "audio") inAudio = s;
        else if (type === "outbound-rtp" && kind === "video") outVideo = s;
        else if (type === "candidate-pair" && s["nominated"] === true) pair = s;
      });

      const video = direction(inVideo, `${id}:v:in`, false);
      const audio = direction(inAudio, `${id}:a:in`, false);
      const sent = direction(outVideo, `${id}:v:out`, true);
      // Outbound resolution is what WE send; show it when there is no inbound.
      if (video.width === 0 && sent.width > 0) {
        video.width = sent.width;
        video.height = sent.height;
        video.fps = sent.fps;
      }

      const localCand = byId.get(str(pair?.["localCandidateId"]));
      const remoteCand = byId.get(str(pair?.["remoteCandidateId"]));
      const lType = str(localCand?.["candidateType"]);
      const rType = str(remoteCand?.["candidateType"]);
      const rttMs = num(pair?.["currentRoundTripTime"]) * 1000;

      peers.push({
        peerId: id,
        peerName: name,
        connectionState: pc.connectionState,
        iceState: pc.iceConnectionState,
        rttMs,
        candidatePair: lType && rType ? `${lType} ⇄ ${rType}` : "—",
        relayed: lType === "relay" || rType === "relay",
        availableOutgoingKbps: num(pair?.["availableOutgoingBitrate"]) / 1000,
        video,
        audio,
        health: gradeHealth(rttMs, Math.max(video.jitterMs, audio.jitterMs), Math.max(video.lossPct, audio.lossPct)),
      });
    }

    if (peers.length === 0) {
      setStats(null);
      return;
    }

    const worst = peers.reduce<PeerStats>(
      (a, b) => (HEALTH_RANK[b.health] > HEALTH_RANK[a.health] ? b : a),
      peers[0]!,
    );

    setStats({
      peers,
      health: worst.health,
      rttMs: Math.max(...peers.map((p) => p.rttMs)),
      jitterMs: Math.max(...peers.map((p) => Math.max(p.video.jitterMs, p.audio.jitterMs))),
      lossPct: Math.max(...peers.map((p) => Math.max(p.video.lossPct, p.audio.lossPct))),
      updatedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    // Capture the map now; the ref could point elsewhere by cleanup time.
    const snapshots = prev.current;
    if (!enabled) {
      setStats(null);
      snapshots.clear();
      return;
    }
    void sample();
    timer.current = window.setInterval(() => void sample(), intervalMs);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      timer.current = null;
      snapshots.clear();
    };
  }, [enabled, intervalMs, sample]);

  return stats;
}

const HEALTH_RANK: Record<CallHealth, number> = {
  excellent: 0,
  good: 1,
  fair: 2,
  poor: 3,
  unknown: 4,
};

/**
 * Thresholds follow ITU-T G.114 guidance for interactive voice: under 150 ms
 * one-way delay is imperceptible, beyond 400 ms conversation breaks down.
 * RTT here is round trip, so the bands are roughly doubled.
 */
function gradeHealth(rttMs: number, jitterMs: number, lossPct: number): CallHealth {
  if (rttMs === 0 && jitterMs === 0) return "unknown";
  if (rttMs < 100 && jitterMs < 15 && lossPct < 1) return "excellent";
  if (rttMs < 200 && jitterMs < 30 && lossPct < 3) return "good";
  if (rttMs < 350 && jitterMs < 60 && lossPct < 8) return "fair";
  return "poor";
}
