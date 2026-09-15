"use client";

import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  FileUp,
  Paperclip,
  X,
  XCircle,
} from "lucide-react";
import type { FileTransfer } from "@/types";
import { formatBytes, formatEta, formatRate } from "@/lib/webrtc/transfer";
import { useGSAP } from "@/lib/gsap";
import { panelIn, staggerUp } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface FilePanelProps {
  transfers: FileTransfer[];
  canSend: boolean;
  onSend: (files: File[]) => void;
  onCancel: (peerId: string, id: number) => void;
  onDismiss: (peerId: string, id: number) => void;
  onClose: () => void;
}

export function FilePanel({
  transfers,
  canSend,
  onSend,
  onCancel,
  onDismiss,
  onClose,
}: FilePanelProps) {
  const root = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useGSAP(
    () => {
      if (root.current) panelIn(root.current, "right");
      staggerUp("[data-transfer]", { y: 10, duration: 0.4, delay: 0.1 });
    },
    { scope: root },
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && canSend) onSend(files);
  };

  return (
    <aside
      ref={root}
      aria-label="File transfers"
      className="glass-strong flex h-full w-full flex-col rounded-2xl sm:w-80"
    >
      <header className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <Paperclip className="size-4 text-violet" aria-hidden />
        <h2 className="text-sm font-medium">Files</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close files"
          className="ml-auto flex size-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center gap-2 rounded-2xl border border-dashed p-6 text-center transition-colors",
            dragging ? "border-violet bg-violet/10" : "border-hairline bg-white/[0.02]",
          )}
        >
          <FileUp className={cn("size-6", dragging ? "text-violet" : "text-muted-foreground")} aria-hidden />
          <p className="text-xs text-muted-foreground">
            {canSend ? "Drop files here" : "Waiting for someone to join"}
          </p>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => input.current?.click()}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs transition-colors",
              canSend
                ? "bg-white/10 hover:bg-white/20"
                : "cursor-not-allowed bg-white/5 text-muted-foreground",
            )}
          >
            Choose files
          </button>
          <input
            ref={input}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) onSend(files);
              e.target.value = "";
            }}
          />
          <p className="text-[10px] leading-relaxed text-muted-foreground/70">
            Sent directly to each participant over the data channel. Never
            uploaded to a server.
          </p>
        </div>

        {transfers.map((t) => (
          <TransferRow
            key={`${t.direction}-${t.peerId}-${t.id}`}
            transfer={t}
            onCancel={() => onCancel(t.peerId, t.id)}
            onDismiss={() => onDismiss(t.peerId, t.id)}
          />
        ))}
      </div>
    </aside>
  );
}

function TransferRow({
  transfer: t,
  onCancel,
  onDismiss,
}: {
  transfer: FileTransfer;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const pct = t.size > 0 ? Math.min(100, (t.transferred / t.size) * 100) : 0;
  const done = t.state === "complete";
  const dead = t.state === "cancelled" || t.state === "failed";

  return (
    <div data-transfer className="rounded-xl border border-hairline bg-white/[0.03] p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          {done ? (
            <CheckCircle2 className="size-4 text-live" aria-hidden />
          ) : dead ? (
            <XCircle className="size-4 text-danger" aria-hidden />
          ) : (
            <ArrowDownToLine
              className={cn("size-4 text-violet", t.direction === "out" && "rotate-180")}
              aria-hidden
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{t.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {t.direction === "out" ? "To" : "From"} {t.peerName} · {formatBytes(t.size)}
          </p>
        </div>
        {!done && !dead && (
          <button
            type="button"
            onClick={onCancel}
            aria-label={`Cancel transfer of ${t.name}`}
            className="flex size-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <X className="size-3" aria-hidden />
          </button>
        )}
        {(done || dead) && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="flex size-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <X className="size-3" aria-hidden />
          </button>
        )}
      </div>

      {!done && !dead && (
        <>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-violet transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="tabular-nums">{pct.toFixed(0)}%</span>
            <span>{formatRate(t.rate)}</span>
            <span className="ml-auto">{formatEta(t.size - t.transferred, t.rate)} left</span>
          </p>
        </>
      )}

      {done && t.direction === "in" && t.url && (
        <a
          href={t.url}
          download={t.name}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-live/15 px-3 py-1 text-[11px] text-live transition-colors hover:bg-live/25"
        >
          <ArrowDownToLine className="size-3" aria-hidden />
          Save file
        </a>
      )}
      {done && t.direction === "out" && (
        <p className="mt-2 text-[10px] text-live">Sent</p>
      )}
      {dead && (
        <p className="mt-2 text-[10px] text-danger">
          {t.error ?? (t.state === "cancelled" ? "Cancelled" : "Failed")}
        </p>
      )}
    </div>
  );
}
