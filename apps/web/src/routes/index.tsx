import { Button, buttonVariants } from "@agent-drop/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Globe, ShieldCheck, Undo2 } from "lucide-react";

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

const STEPS = [
  {
    n: "01",
    title: "Install the skill",
    body: "Paste one prompt into your agent. It saves the AgentDrop skill and a single config line.",
  },
  {
    n: "02",
    title: "Your agent deploys",
    body: "It POSTs Markdown or HTML to the API and gets back a live URL — no account, no keys.",
  },
  {
    n: "03",
    title: "Share the link",
    body: "Open it anywhere. Updates appear in real time, and any version can be undone.",
  },
];

const FEATURES = [
  {
    icon: Undo2,
    title: "Versioned & undoable",
    body: "Every deploy is a snapshot. Roll back without re-sending the whole site.",
  },
  {
    icon: Globe,
    title: "Real-time",
    body: "Viewers see edits instantly — no refresh, powered by Convex subscriptions.",
  },
  {
    icon: Clock,
    title: "No account needed",
    body: "Sites live 30 days anonymously. Sign in to keep them for 90.",
  },
  {
    icon: ShieldCheck,
    title: "Secrets blocked",
    body: "Content is scanned for keys and tokens, and HTML is sandboxed on render.",
  },
];

function Landing() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-4 pt-20 pb-16 text-center sm:pt-28">
          <p className="mb-5 font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">
            Static hosting for AI agents
          </p>
          <h1 className="text-balance font-semibold text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            Give your agents a simple way to host static sites.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
            AgentDrop turns one API call into a live, shareable URL — Markdown or HTML, versioned
            and undoable. No account, no setup.
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
          <div className="mt-8 flex justify-center">
            <ConvexBadge />
          </div>
        </section>

        {/* Providers */}
        <section className="mx-auto max-w-4xl px-4 py-10">
          <p className="mb-7 text-center text-muted-foreground text-sm">
            Works with whatever agent you already use
          </p>
          <ProviderLogos />
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-5xl px-4 py-20">
          <h2 className="mb-12 text-center font-semibold text-2xl tracking-tight sm:text-3xl">
            From prompt to published in three steps
          </h2>
          <div className="grid gap-10 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="border-border/70 border-t pt-5">
                <span className="font-mono text-muted-foreground text-sm">{s.n}</span>
                <h3 className="mt-2 font-medium text-lg">{s.title}</h3>
                <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The API */}
        <section className="mx-auto max-w-3xl px-4 py-16">
          <div className="mb-6 text-center">
            <h2 className="font-semibold text-2xl tracking-tight sm:text-3xl">
              One call to deploy
            </h2>
            <p className="mt-2 text-muted-foreground">
              The whole API is a handful of HTTP routes. This is all it takes:
            </p>
          </div>
          <CodeBlock text={buildCurlExample()} />
        </section>

        {/* Features */}
        <section className="mx-auto max-w-4xl px-4 py-16">
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <f.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="mt-1 text-muted-foreground text-sm leading-relaxed">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-3xl px-4 pt-8 pb-24 text-center">
          <h2 className="font-semibold text-3xl tracking-tight">Ready when your agent is.</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Set it up once. Your agent ships sites for the rest of the project.
          </p>
          <div className="mt-7 flex justify-center">
            <GetStartedDialog>
              <Button size="lg">Get started</Button>
            </GetStartedDialog>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
