import { api } from "@agent-drop/backend/convex/_generated/api";
import type { Id } from "@agent-drop/backend/convex/_generated/dataModel";
import { Button } from "@agent-drop/ui/components/button";
import { Input } from "@agent-drop/ui/components/input";
import { Skeleton } from "@agent-drop/ui/components/skeleton";
import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CodeBlock } from "./code-block";

/** Account keys let an agent publish as you: a far higher create limit, pages
 * owned by your account, private by default, and kept for 90 days. */
export function ApiKeys() {
  const keys = useQuery(api.sites.listApiKeys, {});
  const createKey = useMutation(api.sites.createApiKey);
  const revokeKey = useMutation(api.sites.revokeApiKey);

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // Shown once. The server only ever stores a hash of it.
  const [fresh, setFresh] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    try {
      const { key } = await createKey({ name });
      setFresh(key);
      setName("");
      toast.success("Key created. Copy it now.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the key.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: Id<"apiKeys">) {
    if (!confirm("Revoke this key? Anything using it stops working immediately.")) return;
    try {
      await revokeKey({ id });
      toast.success("Key revoked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke the key.");
    }
  }

  return (
    <section>
      <h2 className="font-semibold text-xl tracking-tight">Account keys</h2>
      <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
        Give one to your agent and it publishes as you: a much higher limit, pages kept for 90 days,
        and private unless you say otherwise. Send it as{" "}
        <code className="font-mono text-foreground">Authorization: Bearer &lt;key&gt;</code>.
      </p>

      {fresh ? (
        <div className="mt-5 rounded-2xl border border-primary/40 bg-accent/40 p-5">
          <p className="font-medium text-sm">Copy this now. It is not shown again.</p>
          <div className="mt-3">
            <CodeBlock text={fresh} language="plain" />
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setFresh(null)}>
            Done
          </Button>
        </div>
      ) : null}

      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What is this key for?"
          aria-label="Key name"
        />
        <Button type="submit" disabled={busy} loading={busy}>
          Create key
        </Button>
      </form>

      <div className="mt-5">
        {keys === undefined ? (
          <Skeleton className="h-14 w-full rounded-2xl" />
        ) : keys.length === 0 ? (
          <p className="text-muted-foreground text-sm">No keys yet.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{k.name}</p>
                  <p className="mt-0.5 truncate text-muted-foreground text-xs">
                    <span className="font-mono">{k.prefix}…</span>
                    <span aria-hidden> · </span>
                    {k.lastUsedAt
                      ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                      : "never used"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Revoke ${k.name}`}
                  onClick={() => revoke(k.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
