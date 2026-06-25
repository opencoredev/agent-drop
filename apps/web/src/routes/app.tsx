import { api } from "@agent-drop/backend/convex/_generated/api";
import { buttonVariants } from "@agent-drop/ui/components/button";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { FileText } from "lucide-react";

import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";

export const Route = createFileRoute("/app")({
  component: AppPage,
});

function AppPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto min-h-[70svh] max-w-3xl px-4 py-14">
        <div className="mb-8">
          <h1 className="font-semibold text-2xl tracking-tight">Your sites</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Sites you've claimed are kept for 90 days from their last update.
          </p>
        </div>
        <Authenticated>
          <MySites />
        </Authenticated>
        <Unauthenticated>
          <p className="text-muted-foreground text-sm">
            Sign in to see sites you've saved.{" "}
            <Link to="/login" className="text-foreground underline underline-offset-4">
              Sign in
            </Link>
            .
          </p>
        </Unauthenticated>
      </main>
      <Footer />
    </>
  );
}

function MySites() {
  const sites = useQuery(api.sites.listMine, {});

  if (sites === undefined) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (sites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/40 px-6 py-16 text-center">
        <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
          <FileText className="size-5 text-muted-foreground" />
        </div>
        <p className="mt-4 font-medium text-sm">No saved sites yet</p>
        <p className="mt-1 max-w-xs text-muted-foreground text-sm leading-relaxed">
          Open a site's manage page and claim it to keep it here for 90 days.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
      {sites.map((s) => (
        <li
          key={s.slug}
          className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-sm">{s.title ?? "Untitled site"}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-muted-foreground text-xs">
              <span className="font-mono">/{s.slug}</span>
              <span aria-hidden>·</span>
              {s.kind === "html" ? "HTML" : "Markdown"}
              <span aria-hidden>·</span>
              expires {new Date(s.expiresAt).toLocaleDateString()}
            </p>
          </div>
          <Link
            to="/$slug"
            params={{ slug: s.slug }}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open
          </Link>
        </li>
      ))}
    </ul>
  );
}
