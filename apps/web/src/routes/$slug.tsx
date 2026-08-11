import { api } from "@agent-drop/backend/convex/_generated/api";
import { buttonVariants } from "@agent-drop/ui/components/button";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { SiteBadge } from "@/components/site-badge";
import { SiteViewer } from "@/components/site-viewer";
import { Mark } from "@/components/wordmark";

export const Route = createFileRoute("/$slug")({
  component: ViewerPage,
});

function ViewerPage() {
  const { slug } = Route.useParams();
  const site = useQuery(api.sites.getBySlug, { slug });

  // A published page belongs to whoever published it, so there is no app chrome
  // here at all: no nav, no spinner flash, just the document and a small badge.
  if (site === undefined) return <div className="min-h-svh bg-background" />;

  if (site === null) {
    return (
      <div className="grid min-h-svh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <Mark className="mx-auto size-10 opacity-40" />
          <h1 className="mt-6 font-semibold text-2xl tracking-tight">This page is gone</h1>
          <p className="mt-2 text-muted-foreground">
            It expired, someone deleted it, or the link was never right.
          </p>
          <Link to="/" className={`mt-7 ${buttonVariants({ variant: "outline", size: "lg" })}`}>
            Back to agentdrop
          </Link>
        </div>
      </div>
    );
  }

  const isHtml = site.kind === "html";

  return (
    <div className={isHtml ? "flex h-svh flex-col overflow-hidden" : "min-h-svh"}>
      <SiteViewer site={site} />
      <SiteBadge />
    </div>
  );
}
