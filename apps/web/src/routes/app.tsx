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
      <main className="mx-auto min-h-[60svh] max-w-3xl px-4 py-12">
        <h1 className="mb-6 font-semibold text-3xl tracking-tight">Your sites</h1>
        <Authenticated>
          <MySites />
        </Authenticated>
        <Unauthenticated>
          <p className="text-muted-foreground">
            Sign in to see sites you've saved.{" "}
            <Link to="/login" className="underline">
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

  if (sites === undefined) return <p className="text-muted-foreground">Loading…</p>;

  if (sites.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <FileText className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 font-medium">No saved sites yet</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Claim a site from its manage page to keep it here for 90 days.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border">
      {sites.map((s) => (
        <li key={s.slug} className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{s.title ?? s.slug}</p>
            <p className="mt-0.5 text-muted-foreground text-sm">
              /{s.slug} · {s.kind === "html" ? "HTML" : "Markdown"} · expires{" "}
              {new Date(s.expiresAt).toLocaleDateString()}
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
