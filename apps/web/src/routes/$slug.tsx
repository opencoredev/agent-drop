import { api } from "@agent-drop/backend/convex/_generated/api";
import { buttonVariants } from "@agent-drop/ui/components/button";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import Loader from "@/components/loader";
import { SiteViewer } from "@/components/site-viewer";
import { DropletMark, Wordmark } from "@/components/wordmark";

export const Route = createFileRoute("/$slug")({
  component: ViewerPage,
});

function ViewerPage() {
  const { slug } = Route.useParams();
  const site = useQuery(api.sites.getBySlug, { slug });

  if (site === undefined) return <Loader />;

  if (site === null) {
    return (
      <div className="grid min-h-svh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <DropletMark className="mx-auto size-9 opacity-35" />
          <p className="mt-6 font-mono text-[0.65rem] text-muted-foreground uppercase tracking-[0.2em]">
            404 · not found
          </p>
          <h1 className="mt-3 font-semibold text-2xl tracking-tight">This drop has dried up</h1>
          <p className="mt-2 text-muted-foreground">
            The site may have expired, been deleted, or never existed.
          </p>
          <Link to="/" className={`mt-7 ${buttonVariants({ variant: "outline" })}`}>
            Back to AgentDrop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-10 border-border/60 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-4 px-4">
          <Link
            to="/"
            className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Wordmark className="text-sm" />
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            {site.title ? (
              <span className="min-w-0 truncate text-muted-foreground text-xs">{site.title}</span>
            ) : null}
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 px-2 py-0.5 text-[0.7rem] text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              live
            </span>
          </div>
        </div>
      </header>
      <SiteViewer site={site} />
    </div>
  );
}
