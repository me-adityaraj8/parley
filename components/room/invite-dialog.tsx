"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, Share2, X } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/animations";
import { cn } from "@/lib/utils";

/**
 * Invite sheet: QR code, copy link, and native share where available.
 *
 * The QR is generated entirely client-side — the room URL is never sent to a
 * QR service, which would leak the link to a third party and undo the point
 * of an unguessable room.
 */
export function InviteDialog({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const url = typeof window !== "undefined" ? `${window.location.origin}/r/${roomId}` : "";

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    void QRCode.toDataURL(url, {
      width: 640,
      margin: 1,
      color: { dark: "#0b0b12", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [url]);

  useGSAP(
    () => {
      if (!root.current) return;
      if (prefersReducedMotion()) {
        gsap.set(root.current, { opacity: 1, scale: 1 });
        return;
      }
      gsap.fromTo(
        root.current,
        { opacity: 0, scale: 0.94, y: 12 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.5)" },
      );
    },
    { scope: root },
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: "Join my Parley call", url });
    } catch {
      /* user dismissed the sheet */
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Invite others"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={root} className="glass-strong w-full max-w-sm rounded-3xl p-6 opacity-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Invite to this room</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close invite"
            className="ml-auto flex size-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="mt-5 flex justify-center">
          {dataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={dataUrl}
              alt={`QR code linking to room ${roomId}`}
              className="size-48 rounded-2xl bg-white p-2"
            />
          ) : (
            <div className="size-48 animate-pulse rounded-2xl bg-white/10" />
          )}
        </div>

        <p className="mt-4 break-all text-center font-mono text-[11px] text-muted-foreground">{url}</p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-violet px-4 py-2.5 text-xs font-medium text-white transition-all hover:brightness-110"
          >
            {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            {copied ? "Copied" : "Copy link"}
          </button>
          {canShare && (
            <button
              type="button"
              onClick={share}
              aria-label="Share link"
              className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            >
              <Share2 className="size-4" aria-hidden />
            </button>
          )}
          {dataUrl && (
            <a
              href={dataUrl}
              download={`parley-${roomId}.png`}
              aria-label="Download QR code"
              className={cn(
                "flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20",
              )}
            >
              <Download className="size-4" aria-hidden />
            </a>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground">
          Anyone with this link can join. The QR is generated in your browser —
          the link is never sent to a third-party service.
        </p>
      </div>
    </div>
  );
}
