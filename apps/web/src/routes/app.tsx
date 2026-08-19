import { api } from "@agent-drop/backend/convex/_generated/api";
import { buttonVariants } from "@agent-drop/ui/components/button";
import { Skeleton } from "@agent-drop/ui/components/skeleton";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";

import { ApiKeys } from "@/components/api-keys";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";

export const Route = createFileRoute("/app")({
  component: AppPage,
});

function AppPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto min-h-[60svh] max-w-3xl px-5 py-14">
        <h1 className="font-semibold text-3xl tracking-tight">Your sites</h1>
        <p className="mt-2 text-muted-foreground">
          A claimed site stays up for 90 days after its last update.
        </p>

        <div className="mt-9">
          <Authenticated>
            <MySites />
            <div className="mt-14 border-t pt-10">
              <ApiKeys />
            </div>
          </Authenticated>
          <Unauthenticated>
            <p className="text-muted-foreground">
              <Link to="/login" className="text-foreground underline underline-offset-4">
                Sign in
              </Link>{" "}
              to see the sites you saved.
            </p>
          </Unauthenticated>
        </div>
      </main>
      <Footer />
    </>
  );
}

function MySites() {
  const sites = useQuery(api.sites.listMine, {});

  if (sites === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
        <p className="font-medium">Nothing saved yet</p>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm leading-relaxed">
          Open a site's manage page and claim it. It shows up here and stays up three times longer.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
      {sites.map((s) => (
        <li
          key={s.slug}
          className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{s.title ?? "Untitled site"}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 truncate text-muted-foreground text-xs">
              <span className="font-mono">/{s.slug}</span>
              <span aria-hidden>·</span>
              <span>{s.kind === "html" ? "HTML" : "Markdown"}</span>
              <span aria-hidden>·</span>
              <span>expires {new Date(s.expiresAt).toLocaleDateString()}</span>
            </p>
          </div>
          <Link
            to="/$slug"
            params={{ slug: s.slug }}
            search={{ t: "" }}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open
          </Link>
        </li>
      ))}
    </ul>
  );
}
