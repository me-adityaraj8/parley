import { cn } from "@/lib/utils";

/**
 * Two nodes joined by a direct line — the product's whole thesis in a mark.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="parley-mark" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="oklch(0.78 0.14 281)" />
          <stop offset="100%" stopColor="oklch(0.79 0.142 196)" />
        </linearGradient>
      </defs>
      <path
        d="M7 8.5 17 15.5"
        stroke="url(#parley-mark)"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="6" cy="7.5" r="3.6" fill="url(#parley-mark)" />
      <circle cx="18" cy="16.5" r="3.6" fill="url(#parley-mark)" opacity="0.8" />
    </svg>
  );
}
