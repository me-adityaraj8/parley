import Link from "next/link";
import { SearchX } from "lucide-react";
import { AmbientBackground } from "@/components/shared/ambient-background";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-6">
      <AmbientBackground />
      <div className="glass-strong max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white/5">
          <SearchX className="size-5 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="mt-5 text-xl font-semibold">That room link isn&rsquo;t valid</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Parley room links look like{" "}
          <code className="font-mono text-violet">k4mq-7rtz-9wfx</code>. Check
          that you copied the whole link, or start a room of your own.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-violet px-5 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110"
        >
          Go to Parley
        </Link>
      </div>
    </main>
  );
}
