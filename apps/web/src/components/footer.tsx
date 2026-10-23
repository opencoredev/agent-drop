import { REPO_URL, SKILL_URL } from "@/lib/agentdrop";
import { otherOpenCoreSites } from "@/lib/opencore-sites";

import { ConvexBadge } from "./convex-badge";
import { GitHubMark } from "./github-mark";
import { Wordmark } from "./wordmark";

// Plain followed links on purpose: they share authority between our sites.
const OPENCORE_LINKS = otherOpenCoreSites("https://www.agent-drop.co");

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
      <div className="mx-auto max-w-5xl px-5">
        <nav
          aria-labelledby="footer-opencore-label"
          className="flex flex-col gap-4 border-border/70 border-t py-8"
        >
          <span id="footer-opencore-label" className="font-medium text-foreground text-sm">
            More from OpenCore
          </span>
          <ul className="grid gap-x-6 gap-y-2.5 text-muted-foreground text-sm sm:grid-cols-2 md:grid-cols-3">
            {OPENCORE_LINKS.map((site) => (
              <li key={site.url}>
                <a href={site.url} className="transition-colors hover:text-foreground">
                  <span className="text-foreground">{site.name}</span> {site.description}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
