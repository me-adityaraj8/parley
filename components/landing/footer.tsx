import { Logo } from "@/components/shared/logo";
import { GithubMark } from "@/components/shared/github-mark";

export function Footer({ repoUrl }: { repoUrl: string }) {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-5 py-10 sm:flex-row">
        <div className="flex items-center gap-2 text-sm">
          <Logo className="size-5" />
          <span className="font-medium">Parley</span>
        </div>
        <p className="text-center text-xs text-muted-foreground sm:ml-4 sm:text-left">
          Peer-to-peer video calling, built on WebRTC.
        </p>
        <a
          href={repoUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground sm:ml-auto"
        >
          <GithubMark className="size-3.5" />
          Source
        </a>
      </div>
    </footer>
  );
}
