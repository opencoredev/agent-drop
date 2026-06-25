import { api } from "@agent-drop/backend/convex/_generated/api";
import { Button, buttonVariants } from "@agent-drop/ui/components/button";
import { Separator } from "@agent-drop/ui/components/separator";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowLeft, ExternalLink, Redo2, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CodeBlock } from "@/components/code-block";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { appOrigin, deleteSite, redoSite, undoSite } from "@/lib/agentdrop";

export const Route = createFileRoute("/manage/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : "",
  }),
  component: ManagePage,
});

function ManagePage() {
  const { slug } = Route.useParams();
  const { t: token } = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();
  const site = useQuery(api.sites.getBySlug, { slug });
  const claim = useMutation(api.sites.claim);
  const [busy, setBusy] = useState(false);

  const viewerUrl = `${appOrigin()}/${slug}`;

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back
          </Link>
          <h1 className="mt-4 font-semibold text-3xl tracking-tight">Manage site</h1>
          <p className="mt-1.5 truncate font-mono text-muted-foreground text-xs">/{slug}</p>
        </div>

        {site === undefined ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : site === null ? (
          <p className="text-muted-foreground">
            This site doesn't exist or has expired.{" "}
            <Link to="/" className="underline">
              Go home
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-8">
            {/* Overview */}
            <div className="rounded-xl border p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{site.title ?? slug}</p>
                  <p className="mt-0.5 text-muted-foreground text-sm">
                    {site.kind === "html" ? "HTML" : "Markdown"} · version{" "}
                    {typeof site.version === "number" ? site.version + 1 : "—"} of {site.versions} ·
                    expires {new Date(site.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <a
                  href={viewerUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ExternalLink /> Open
                </a>
              </div>
            </div>

            {!token ? (
              <div className="rounded-xl border border-dashed p-5 text-muted-foreground text-sm">
                Add the site's edit token to this URL (<code className="font-mono">?t=…</code>) to
                manage it. The token was included in the{" "}
                <code className="font-mono">manageUrl</code> your agent received at deploy time.
              </div>
            ) : (
              <>
                {/* History */}
                <section className="space-y-3">
                  <h2 className="font-medium">History</h2>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={busy || !site.canUndo}
                      onClick={() =>
                        run("Reverted to previous version", () => undoSite(slug, token))
                      }
                    >
                      <Undo2 /> Undo
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || !site.canRedo}
                      onClick={() => run("Re-applied next version", () => redoSite(slug, token))}
                    >
                      <Redo2 /> Redo
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Changes appear on the live site instantly — no redeploy needed.
                  </p>
                </section>

                <Separator />

                {/* Keep it longer */}
                <section className="space-y-3">
                  <h2 className="font-medium">Keep this site</h2>
                  {site.owned ? (
                    <p className="text-muted-foreground text-sm">
                      Saved to your account — kept for 90 days from the last update.
                    </p>
                  ) : isAuthenticated ? (
                    <>
                      <p className="text-muted-foreground text-sm">
                        Claim this site to extend its life from 30 to 90 days.
                      </p>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          run("Site saved to your account", async () => {
                            await claim({ slug, editToken: token });
                          })
                        }
                      >
                        Claim site
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground text-sm">
                        Anonymous sites live 30 days. Sign in to keep this one for 90.
                      </p>
                      <Link
                        to="/login"
                        search={{ redirect: `/manage/${slug}?t=${token}` }}
                        className={buttonVariants({ variant: "default" })}
                      >
                        Sign in to claim
                      </Link>
                    </>
                  )}
                </section>

                <Separator />

                {/* Token + danger */}
                <section className="space-y-3">
                  <h2 className="font-medium">Edit token</h2>
                  <p className="text-muted-foreground text-sm">
                    Keep this secret — anyone with it can edit or delete the site.
                  </p>
                  <CodeBlock text={token} />
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => {
                      if (!confirm("Permanently delete this site? This cannot be undone.")) return;
                      void run("Site deleted", async () => {
                        await deleteSite(slug, token);
                        await navigate({ to: "/" });
                      });
                    }}
                  >
                    <Trash2 /> Delete site
                  </Button>
                </section>
              </>
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
