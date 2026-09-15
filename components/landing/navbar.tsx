"use client";

import { useRef } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useGSAP } from "@/lib/gsap";
import { fadeUp } from "@/lib/animations";
import { CreateRoomButton } from "./create-room-button";
import { Logo } from "@/components/shared/logo";
import { GithubMark } from "@/components/shared/github-mark";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#tech", label: "Architecture" },
];

export function Navbar({ repoUrl }: { repoUrl: string }) {
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useGSAP(
    () => {
      fadeUp("[data-nav]", { y: -16, duration: 0.7, delay: 0.1 });
    },
    { scope: root },
  );

  return (
    <header
      ref={root}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5 sm:pt-5"
    >
      <nav
        data-nav
        aria-label="Main"
        className="glass-strong flex w-full max-w-5xl items-center gap-2 rounded-2xl px-3 py-2.5 sm:rounded-full sm:px-4"
      >
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full pr-2 text-sm font-semibold tracking-tight"
        >
          <Logo className="size-6" />
          Parley
        </Link>

        <ul className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="View source on GitHub"
            className="hidden size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground sm:flex"
          >
            <GithubMark className="size-4" />
          </a>
          <CreateRoomButton size="sm" />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 md:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>

      {open && (
        <ul
          className={cn(
            "glass-strong absolute inset-x-3 top-[4.5rem] space-y-1 rounded-2xl p-2 md:hidden",
          )}
        >
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
