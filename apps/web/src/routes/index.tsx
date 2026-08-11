import { Button } from "@agent-drop/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";

import { CommandBlock } from "@/components/command-block";
import { Footer } from "@/components/footer";
import { GetStartedDialog } from "@/components/get-started-dialog";
import { McpInstall } from "@/components/mcp-install";
import { Nav } from "@/components/nav";
import { LivePill } from "@/components/wordmark";
import { INSTALL_COMMAND, SKILL_URL } from "@/lib/agentdrop";

export const Route = createFileRoute("/")({
  component: Landing,
});

const FACTS = [
  {
    title: "Undo any deploy",
    body: "Every push is a snapshot. If an edit went badly, roll it back without resending the site.",
  },
  {
    title: "Updates go out live",
    body: "Anyone with the page open gets the new version. Nobody has to hit refresh.",
  },
  {
    title: "No account needed",
    body: "You get a secret edit token back instead. Sign in later only if you want to keep a site around.",
  },
  {
    title: "Pages clean themselves up",
    body: "Anonymous sites last 30 days. Claim one and it lasts 90. Nothing to cancel.",
  },
];

function Landing() {
  return (
    <>
      <Nav />
      <main>
        <section className="mx-auto max-w-3xl px-5 pt-20 pb-14 text-center sm:pt-28">
          <h1 className="text-balance font-semibold text-[2.6rem] leading-[1.05] tracking-[-0.035em] sm:text-[3.5rem]">
            Give your agent a URL to put things on.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted-foreground leading-relaxed">
            It posts Markdown or HTML. It gets back a link that already works. No account, no build
            step, and you can undo any deploy.
          </p>

          <div className="mx-auto mt-10 max-w-xl text-left">
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="font-medium text-sm">Connect your agent over MCP</h2>
              <p className="mt-1 mb-4 text-muted-foreground text-sm">
                A stateless server, so there is nothing to run or keep alive.
              </p>
              <McpInstall compact />
            </div>

            <div className="mt-3 rounded-2xl border bg-card p-5">
              <h2 className="font-medium text-sm">Or install it as a skill</h2>
              <p className="mt-1 mb-4 text-muted-foreground text-sm">
                Same tools, written as instructions instead of a server.
              </p>
              <CommandBlock
                command={INSTALL_COMMAND}
                wrap
                className="border-0 bg-muted/60 shadow-none"
              />
            </div>
          </div>

          <div className="mx-auto mt-12 flex max-w-md items-center gap-3 rounded-full border bg-card px-4 py-2.5 text-left">
            <span className="shrink-0 text-muted-foreground text-sm">Your agent hands back</span>
            <span className="min-w-0 flex-1 truncate font-mono text-sm">
              agent-drop.co<span className="text-muted-foreground">/3f9a8c1e</span>
            </span>
            <LivePill />
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-24">
          <div className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
            {FACTS.map((f) => (
              <div key={f.title} className="bg-card p-7">
                <h2 className="font-semibold text-[1.05rem] tracking-tight">{f.title}</h2>
                <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-28">
          <div className="rounded-2xl border bg-card px-8 py-12 text-center">
            <h2 className="text-balance font-semibold text-2xl tracking-tight sm:text-3xl">
              Watch it publish something.
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-muted-foreground leading-relaxed">
              One prompt installs agentdrop, builds a page, and hands you the link.
            </p>
            <GetStartedDialog>
              <Button size="lg" className="mt-7">
                Copy the demo prompt
              </Button>
            </GetStartedDialog>
            <p className="mt-5 text-muted-foreground text-sm">
              <a
                href={SKILL_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Read the skill first
              </a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
