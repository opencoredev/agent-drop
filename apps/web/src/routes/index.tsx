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
import { SKILL_URL, buildCurlExample } from "@/lib/agentdrop";

export const Route = createFileRoute("/")({
  component: Landing,
});

const FEATURES = [
  {
    icon: Undo2,
    title: "Versioned & undoable",
    body: "Every deploy is a snapshot. Roll back without re-sending the site.",
  },
  {
    icon: Globe,
    title: "Real-time",
    body: "Viewers see edits instantly — no refresh, powered by Convex.",
  },
  {
    icon: Clock,
    title: "No account needed",
    body: "Sites live 30 days anonymously. Sign in to keep them for 90.",
  },
];

function Landing() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero — the whole page is one screen */}
        <section className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-20 pb-16 text-center sm:pt-28">
          <Badge
            variant="outline"
            className="h-auto gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.65rem] text-muted-foreground uppercase tracking-[0.18em]"
          >
            <span className="size-1.5 rounded-full bg-foreground/40" aria-hidden />
            Static hosting for AI agents
          </Badge>

          <h1 className="mt-6 text-balance font-semibold text-4xl leading-[1.04] tracking-tight sm:text-6xl">
            Give your agents a simple way to host static sites.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
            AgentDrop turns one API call into a live, shareable URL — Markdown or HTML, versioned and
            undoable. No account, no setup.
          </p>

          <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
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

          {/* The product is one call → a URL. Make the call the centerpiece. */}
          <CodeBlock text={buildCurlExample()} className="mt-12 w-full max-w-2xl text-left" />

          <ConvexBadge className="mt-6" />
        </section>

        {/* Works with any agent — slim proof strip */}
        <section className="mx-auto max-w-4xl px-4 pb-16">
          <p className="mb-7 text-center text-muted-foreground text-sm">
            Works with whatever agent you already use
          </p>
          <ProviderLogos />
        </section>

        {/* Three things worth knowing — one compact row, no card soup */}
        <section className="mx-auto max-w-4xl px-4 pb-24">
          <div className="grid gap-8 border-border/70 border-t pt-10 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <f.icon className="size-5 text-muted-foreground" />
                <h3 className="mt-3 font-medium text-sm">{f.title}</h3>
                <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
