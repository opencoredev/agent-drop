import { Badge } from "@agent-drop/ui/components/badge";
import { Button, buttonVariants } from "@agent-drop/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Globe, Undo2 } from "lucide-react";

import { CodeBlock } from "@/components/code-block";
import { ConvexBadge } from "@/components/convex-badge";
import { Footer } from "@/components/footer";
import { GetStartedDialog } from "@/components/get-started-dialog";
import { Nav } from "@/components/nav";
import { ProviderLogos } from "@/components/provider-logos";
import { DropletMark } from "@/components/wordmark";
import { SKILL_URL, buildCurlExample } from "@/lib/agentdrop";

export const Route = createFileRoute("/")({
  component: Landing,
});

const FEATURES = [
  {
    icon: Undo2,
    title: "Versioned & undoable",
    body: "Every deploy is a snapshot. Roll a bad edit back without re-sending the site.",
  },
  {
    icon: Globe,
    title: "Live in real time",
    body: "Viewers see updates the instant your agent pushes them — no refresh.",
  },
  {
    icon: Clock,
    title: "No account, no keys",
    body: "Sites live 30 days anonymously. Sign in only if you want to keep one for 90.",
  },
];

/** Decorative crosshair tick at a frame corner — a small coss-style detail. */
function Tick({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-10 size-3 text-border ${className ?? ""}`}
    >
      <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-current" />
      <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-current" />
    </span>
  );
}

function Landing() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 pt-24 pb-14 text-center sm:pt-32">
          <Badge
            variant="outline"
            className="h-auto gap-2 rounded-full px-3 py-1 font-mono text-[0.65rem] text-muted-foreground uppercase tracking-[0.2em]"
          >
            <span className="size-1.5 rounded-full bg-foreground/40" aria-hidden />
            Static hosting for AI agents
          </Badge>

          <h1 className="mt-7 text-balance font-semibold text-[2.5rem] leading-[1.02] tracking-[-0.03em] sm:text-6xl">
            Give your agents a place to ship sites.
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-pretty text-lg text-muted-foreground leading-relaxed">
            One API call turns Markdown or HTML into a live, shareable URL — versioned, undoable, and
            gone in 30 days unless you keep it. No account, no setup.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <GetStartedDialog>
              <Button size="lg" className="w-full sm:w-auto">
                Get started
              </Button>
            </GetStartedDialog>
            <a
              href={SKILL_URL}
              target="_blank"
              rel="noreferrer noopener"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Read the skill
            </a>
          </div>
        </section>

        {/* The deploy itself — request in, live URL out */}
        <section className="mx-auto max-w-2xl px-6 pb-16">
          <CodeBlock text={buildCurlExample()} />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 text-sm">
            <span className="text-muted-foreground">returns a URL that's already live</span>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 font-mono text-xs">
              <DropletMark className="size-3.5" />
              <span className="text-foreground">drop-agent.vercel.app</span>
              <span className="text-muted-foreground">/3f9a8c1e…</span>
              <span className="ml-0.5 inline-flex items-center gap-1.5 border-border/70 border-l pl-2 text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                live
              </span>
            </span>
          </div>
          <div className="mt-10 flex justify-center">
            <ConvexBadge />
          </div>
        </section>

        {/* Trust strip */}
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <p className="mb-7 text-center font-mono text-[0.65rem] text-muted-foreground uppercase tracking-[0.2em]">
            Works with whatever agent you already use
          </p>
          <ProviderLogos />
        </section>

        {/* Three things worth knowing, in a coss-style framed grid */}
        <section className="mx-auto max-w-4xl px-6 pb-28">
          <div className="relative border border-border/70">
            <Tick className="-top-1.5 -left-1.5" />
            <Tick className="-top-1.5 -right-1.5" />
            <Tick className="-bottom-1.5 -left-1.5" />
            <Tick className="-right-1.5 -bottom-1.5" />
            <div className="grid divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {FEATURES.map((f) => (
                <div key={f.title} className="p-7">
                  <f.icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
                  <h3 className="mt-4 font-medium text-[0.95rem]">{f.title}</h3>
                  <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
