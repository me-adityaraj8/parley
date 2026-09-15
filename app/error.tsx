"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

/**
 * Route-level error boundary.
 *
 * Users never see the raw error — that goes to the console for us. They get
 * a plain explanation and the one action that usually helps.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[parley] route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="glass-strong max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-danger/15">
          <TriangleAlert className="size-5 text-danger" aria-hidden />
        </div>
        <h1 className="mt-5 text-xl font-semibold">Something broke</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Parley hit an unexpected problem. Your call was not recorded or sent
          anywhere — reloading usually clears it.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-violet px-5 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110"
        >
          <RefreshCw className="size-4" aria-hidden />
          Try again
        </button>
      </div>
    </main>
  );
}
