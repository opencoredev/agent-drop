import { SKILL_URL } from "@/lib/agentdrop";

import { ConvexBadge } from "./convex-badge";
import { Wordmark } from "./wordmark";

export function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
        <Wordmark className="text-sm" />
        <div className="flex items-center gap-5 text-muted-foreground text-sm">
          <a
            href={SKILL_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="transition-colors hover:text-foreground"
          >
            Agent skill
          </a>
          <a
            href="https://github.com/get-convex/r2"
            target="_blank"
            rel="noreferrer noopener"
            className="transition-colors hover:text-foreground"
          >
            R2 component
          </a>
          <ConvexBadge />
        </div>
      </div>
    </footer>
  );
}
