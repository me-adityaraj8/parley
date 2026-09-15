"use client";

import { useEffect, useState } from "react";
import { MonitorX } from "lucide-react";
import type { MediaFailure } from "@/types";
import { checkMediaSupport } from "@/lib/media/errors";

/**
 * Blocks the call UI on browsers that cannot run it at all.
 *
 * Runs after mount rather than during render: the capability checks touch
 * `navigator` and `window.isSecureContext`, neither of which exists during
 * server rendering.
 */
export function BrowserGate({ children }: { children: React.ReactNode }) {
  const [failure, setFailure] = useState<MediaFailure | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setFailure(checkMediaSupport());
    setChecked(true);
  }, []);

  if (!checked) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-white/15 border-t-violet" />
        <span className="sr-only">Checking browser support</span>
      </div>
    );
  }

  if (failure) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="glass-strong max-w-md rounded-3xl p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-warn/15">
            <MonitorX className="size-5 text-warn" aria-hidden />
          </div>
          <h1 className="mt-5 text-xl font-semibold">{failure.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {failure.detail}
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
