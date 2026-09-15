"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DataMessage, FileTransfer, PeerId } from "@/types";
import { CHUNK_SIZE, frameChunk, readFrame } from "@/lib/webrtc/transfer";

interface UseFileTransferOptions {
  selfId: PeerId | null;
  peers: { id: PeerId; name: string }[];
  /** Transfers are point-to-point, so this never broadcasts. */
  sendTo: (peerId: PeerId, msg: DataMessage) => boolean;
  sendBulkTo: (peerId: PeerId, frame: ArrayBuffer) => Promise<boolean>;
}

interface Inbound {
  meta: FileTransfer;
  chunks: ArrayBuffer[];
  received: number;
  lastTick: number;
  lastBytes: number;
}

/**
 * Real peer-to-peer file transfer over WebRTC data channels.
 *
 * Nothing is uploaded anywhere: the file is read from disk in slices, framed,
 * and pushed straight down the same encrypted connection that carries video.
 *
 * SENDING is a cooperative loop, not a for-loop — after every chunk we hand
 * control back so the send can be cancelled and so `sendBulk` can await
 * backpressure (see PeerLink.sendBulk).
 *
 * RECEIVING accumulates ArrayBuffers and only assembles a Blob at the end.
 * Concatenating on every chunk would be O(n²) in memory traffic and would
 * stall the main thread on large files.
 */
export function useFileTransfer({
  selfId,
  peers,
  sendTo,
  sendBulkTo,
}: UseFileTransferOptions) {
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);

  const nextId = useRef(1);
  const inbound = useRef(new Map<string, Inbound>());
  const cancelled = useRef(new Set<string>());
  const peersRef = useRef(peers);
  peersRef.current = peers;

  const key = (peerId: PeerId, id: number) => `${peerId}:${id}`;

  const patch = useCallback(
    (peerId: PeerId, id: number, next: Partial<FileTransfer>) => {
      setTransfers((prev) =>
        prev.map((t) => (t.peerId === peerId && t.id === id ? { ...t, ...next } : t)),
      );
    },
    [],
  );

  // ----------------------------------------------------------------- send

  const sendFiles = useCallback(
    async (files: File[]) => {
      if (!selfId) return;
      const targets = peersRef.current;
      if (targets.length === 0) return;

      for (const file of files) {
        const id = nextId.current++;

        // One logical transfer per file, fanned out to every peer.
        for (const peer of targets) {
          setTransfers((prev) => [
            ...prev,
            {
              id,
              peerId: peer.id,
              peerName: peer.name,
              direction: "out",
              name: file.name,
              size: file.size,
              mime: file.type || "application/octet-stream",
              transferred: 0,
              state: "transferring",
              rate: 0,
              startedAt: Date.now(),
            },
          ]);
          sendTo(peer.id, {
            t: "file-offer",
            id,
            name: file.name,
            size: file.size,
            mime: file.type || "application/octet-stream",
          });
        }

        // Stream the file once per peer. Reading slices lazily keeps memory
        // flat regardless of file size — we never hold the whole file.
        for (const peer of targets) {
          const k = key(peer.id, id);
          let offset = 0;
          let lastTick = performance.now();
          let lastBytes = 0;

          while (offset < file.size) {
            if (cancelled.current.has(k)) break;

            const slice = file.slice(offset, offset + CHUNK_SIZE);
            const buf = await slice.arrayBuffer();
            const ok = await sendBulkTo(peer.id, frameChunk(id, buf));
            if (!ok) {
              patch(peer.id, id, { state: "failed", error: "Connection lost" });
              break;
            }
            offset += buf.byteLength;

            // Throttle UI updates to ~5/s; per-chunk setState would render
            // thousands of times for a large file.
            const now = performance.now();
            if (now - lastTick > 200 || offset >= file.size) {
              const rate = ((offset - lastBytes) / (now - lastTick)) * 1000;
              lastTick = now;
              lastBytes = offset;
              patch(peer.id, id, { transferred: offset, rate });
            }
          }

          if (cancelled.current.has(k)) {
            cancelled.current.delete(k);
            sendTo(peer.id, { t: "file-cancel", id });
            patch(peer.id, id, { state: "cancelled" });
          } else if (offset >= file.size) {
            sendTo(peer.id, { t: "file-done", id });
            patch(peer.id, id, { state: "complete", transferred: file.size });
          }
        }
      }
    },
    [selfId, sendTo, sendBulkTo, patch],
  );

  const cancel = useCallback(
    (peerId: PeerId, id: number) => {
      cancelled.current.add(key(peerId, id));
      const k = key(peerId, id);
      const inb = inbound.current.get(k);
      if (inb) {
        inbound.current.delete(k);
        sendTo(peerId, { t: "file-cancel", id });
      }
      patch(peerId, id, { state: "cancelled" });
    },
    [sendTo, patch],
  );

  // -------------------------------------------------------------- receive

  const onControl = useCallback(
    (from: PeerId, name: string, msg: DataMessage) => {
      if (msg.t === "file-offer") {
        const meta: FileTransfer = {
          id: msg.id,
          peerId: from,
          peerName: name,
          direction: "in",
          name: msg.name,
          size: msg.size,
          mime: msg.mime,
          transferred: 0,
          state: "transferring",
          rate: 0,
          startedAt: Date.now(),
        };
        inbound.current.set(key(from, msg.id), {
          meta,
          chunks: [],
          received: 0,
          lastTick: performance.now(),
          lastBytes: 0,
        });
        setTransfers((prev) => [...prev, meta]);
        return;
      }

      if (msg.t === "file-done") {
        const k = key(from, msg.id);
        const inb = inbound.current.get(k);
        if (!inb) return;
        inbound.current.delete(k);

        // Assemble once, at the end.
        const blob = new Blob(inb.chunks, { type: inb.meta.mime });
        const url = URL.createObjectURL(blob);
        patch(from, msg.id, {
          state: "complete",
          transferred: blob.size,
          url,
        });
        return;
      }

      if (msg.t === "file-cancel") {
        inbound.current.delete(key(from, msg.id));
        patch(from, msg.id, { state: "cancelled" });
      }
    },
    [patch],
  );

  const onBulk = useCallback(
    (from: PeerId, frame: ArrayBuffer) => {
      const parsed = readFrame(frame);
      if (!parsed) return;
      const k = key(from, parsed.id);
      const inb = inbound.current.get(k);
      if (!inb) return;

      inb.chunks.push(parsed.payload);
      inb.received += parsed.payload.byteLength;

      const now = performance.now();
      if (now - inb.lastTick > 200) {
        const rate = ((inb.received - inb.lastBytes) / (now - inb.lastTick)) * 1000;
        inb.lastTick = now;
        inb.lastBytes = inb.received;
        patch(from, parsed.id, { transferred: inb.received, rate });
      }
    },
    [patch],
  );

  /** Drop a finished transfer from the list and release its object URL. */
  const dismiss = useCallback((peerId: PeerId, id: number) => {
    setTransfers((prev) =>
      prev.filter((t) => {
        if (t.peerId === peerId && t.id === id) {
          if (t.url) URL.revokeObjectURL(t.url);
          return false;
        }
        return true;
      }),
    );
  }, []);

  // Object URLs are a documented leak source — the browser holds the whole
  // Blob in memory until revoked, even after the element using it is gone.
  useEffect(() => {
    const snapshot = transfers;
    return () => {
      for (const t of snapshot) if (t.url) URL.revokeObjectURL(t.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = transfers.filter((t) => t.state === "transferring").length;

  return { transfers, active, sendFiles, cancel, dismiss, onControl, onBulk };
}
