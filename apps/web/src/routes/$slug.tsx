import { api } from "@agent-drop/backend/convex/_generated/api";
import { buttonVariants } from "@agent-drop/ui/components/button";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import Loader from "@/components/loader";
import { SiteViewer } from "@/components/site-viewer";
import { Wordmark } from "@/components/wordmark";

export const Route = createFileRoute("/$slug")({
  component: ViewerPage,
});

function ViewerPage() {
  const { slug } = Route.useParams();
  const site = useQuery(api.sites.getBySlug, { slug });

  if (site === undefined) return <Loader />;

  if (site === null) {
    return (
      <div className="grid min-h-svh place-items-center px-4 text-center">
        <div>
          <p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">404</p>
          <h1 className="mt-3 font-semibold text-2xl tracking-tight">Site not found</h1>
          <p className="mt-2 text-muted-foreground">This site may have expired or never existed.</p>
          <Link to="/" className={`mt-6 ${buttonVariants({ variant: "outline" })}`}>
            Back to AgentDrop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh">
      <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur">
        <Link to="/" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Wordmark className="text-sm" />
        </Link>
        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          {site.title ? <span className="max-w-[40vw] truncate">{site.title}</span> : null}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            live
          </span>
        </div>
      </div>
      <SiteViewer site={site} />
    </div>
  );
}
