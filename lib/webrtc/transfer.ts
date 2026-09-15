/**
 * Binary framing for peer-to-peer file transfer.
 *
 * Chunks travel on the BULK data channel as raw ArrayBuffers. Each frame is
 * prefixed with a 4-byte transfer id so the receiver can route interleaved
 * chunks from several concurrent files without any per-file channel.
 *
 *   ┌──────────────┬────────────────────────────┐
 *   │ uint32 id LE │ payload bytes              │
 *   └──────────────┴────────────────────────────┘
 *
 * Why binary rather than JSON: base64 inside a JSON message inflates payload
 * by ~33% and forces a string copy per chunk. SCTP carries binary natively.
 */

export const HEADER_BYTES = 4;

/**
 * 16 KiB. The SCTP implementations in browsers reliably handle messages of
 * this size without fragmentation problems; larger chunks (>64 KiB) are
 * refused outright by some stacks.
 */
export const CHUNK_SIZE = 16 * 1024;

export function frameChunk(transferId: number, chunk: ArrayBuffer): ArrayBuffer {
  const out = new ArrayBuffer(HEADER_BYTES + chunk.byteLength);
  new DataView(out).setUint32(0, transferId, true);
  new Uint8Array(out, HEADER_BYTES).set(new Uint8Array(chunk));
  return out;
}

export function readFrame(frame: ArrayBuffer): { id: number; payload: ArrayBuffer } | null {
  if (frame.byteLength < HEADER_BYTES) return null;
  const id = new DataView(frame).getUint32(0, true);
  return { id, payload: frame.slice(HEADER_BYTES) };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

export function formatRate(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "—";
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatEta(remainingBytes: number, rate: number): string {
  if (rate <= 0) return "—";
  const secs = Math.ceil(remainingBytes / rate);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  return `${m}m ${secs % 60}s`;
}
