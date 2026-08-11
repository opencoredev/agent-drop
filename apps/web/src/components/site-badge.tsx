import { Link } from "@tanstack/react-router";

import { Mark } from "./wordmark";

/** The only mark we put on a published page: a small badge in the corner that
 * says the page is live and where it came from. It stays out of the way and
 * fades back until pointed at. */
export function SiteBadge() {
  return (
    <Link
      to="/"
      className="fixed right-4 bottom-4 z-50 inline-flex items-center gap-2 rounded-full border bg-card/85 py-1.5 pr-3 pl-1.5 text-xs opacity-70 shadow-md backdrop-blur transition-opacity outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Mark className="size-4" />
      <span className="font-medium">agentdrop</span>
      <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
      <span className="sr-only">This page is live and hosted on agentdrop</span>
    </Link>
  );
}
