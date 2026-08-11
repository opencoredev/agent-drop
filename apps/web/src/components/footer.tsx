import { REPO_URL, SKILL_URL } from "@/lib/agentdrop";

import { ConvexBadge } from "./convex-badge";
import { GitHubMark } from "./github-mark";
import { Wordmark } from "./wordmark";

export function Footer() {
  return (
    <footer className="border-border/70 border-t">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-5 px-5 py-10 sm:flex-row">
        <Wordmark className="text-sm" />
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-muted-foreground text-sm">
          <a
            href={SKILL_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="transition-colors hover:text-foreground"
          >
            Agent skill
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <GitHubMark className="size-3.5" />
            Source
          </a>
          <ConvexBadge />
        </div>
      </div>
    </footer>
  );
}
