import { api } from "@agent-drop/backend/convex/_generated/api";
import { Button, buttonVariants } from "@agent-drop/ui/components/button";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { Mark } from "@/components/wordmark";
import { RETENTION } from "@/lib/agentdrop";

/**
 * The OAuth consent screen an MCP client sends people to.
 *
 * Two ways forward, deliberately equal in weight: connect an account, or carry
 * on anonymously. Anonymous is a real choice rather than a dead end, because
 * publishing a throwaway page should not require signing up for anything.
 */
export const Route = createFileRoute("/oauth/authorize")({
  validateSearch: (search: Record<string, unknown>) => ({
    client_id: typeof search.client_id === "string" ? search.client_id : "",
    redirect_uri: typeof search.redirect_uri === "string" ? search.redirect_uri : "",
    state: typeof search.state === "string" ? search.state : "",
    code_challenge: typeof search.code_challenge === "string" ? search.code_challenge : "",
    code_challenge_method:
      typeof search.code_challenge_method === "string" ? search.code_challenge_method : "",
    resource: typeof search.resource === "string" ? search.resource : "",
    scope: typeof search.scope === "string" ? search.scope : "",
  }),
  component: AuthorizePage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-5 py-16">
      <div className="rounded-2xl border bg-card p-7 shadow-sm sm:p-8">{children}</div>
    </main>
  );
}

function AuthorizePage() {
  const search = Route.useSearch();
  const approve = useMutation(api.oauth.approveAuthorization);
  const [busy, setBusy] = useState<"account" | "anonymous" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useQuery(
    api.oauth.describeAuthorization,
    search.client_id && search.redirect_uri
      ? { clientId: search.client_id, redirectUri: search.redirect_uri }
      : "skip",
  );

  const badRequest =
    !search.client_id ||
    !search.redirect_uri ||
    !search.code_challenge ||
    search.code_challenge_method !== "S256";

  if (badRequest) {
    return (
      <Shell>
        <h1 className="font-semibold text-xl tracking-tight">This link is incomplete</h1>
        <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
          The app that sent you here left out something required, or asked for a challenge method we
          do not accept. Start the connection again from the app.
        </p>
      </Shell>
    );
  }

  if (request === undefined) {
    return (
      <Shell>
        <p className="text-muted-foreground text-sm">Checking the request…</p>
      </Shell>
    );
  }

  if (!request.ok) {
    return (
      <Shell>
        <h1 className="font-semibold text-xl tracking-tight">We cannot approve this</h1>
        <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
          {request.reason === "unknown_client"
            ? "That app is not registered with agentdrop."
            : "That app asked to be sent back to an address it never registered, so we stopped."}
        </p>
      </Shell>
    );
  }

  async function decide(useAccount: boolean) {
    setBusy(useAccount ? "account" : "anonymous");
    setError(null);
    try {
      const { code } = await approve({
        clientId: search.client_id,
        redirectUri: search.redirect_uri,
        codeChallenge: search.code_challenge,
        resource: search.resource || undefined,
        useAccount,
      });
      const target = new URL(search.redirect_uri);
      target.searchParams.set("code", code);
      if (search.state) target.searchParams.set("state", search.state);
      window.location.href = target.toString();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  const signedIn = request.signedInAs !== null;
  const returnTo = `/oauth/authorize${window.location.search}`;

  return (
    <Shell>
      <Mark className="size-9" />
      <h1 className="mt-5 font-semibold text-xl tracking-tight">
        {request.clientName} wants to publish pages
      </h1>
      <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
        It will be able to create pages, update them, and delete the ones it made. It cannot read
        anything else in your account.
      </p>

      <div className="mt-7 space-y-3">
        {signedIn ? (
          <Button
            size="lg"
            className="w-full"
            disabled={busy !== null}
            loading={busy === "account"}
            onClick={() => decide(true)}
          >
            Connect as {request.signedInAs}
          </Button>
        ) : (
          <Link
            to="/login"
            search={{ redirect: returnTo }}
            className={`w-full ${buttonVariants({ size: "lg" })}`}
          >
            Sign in and connect
          </Link>
        )}

        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={busy !== null}
          loading={busy === "anonymous"}
          onClick={() => decide(false)}
        >
          Continue without an account
        </Button>
      </div>

      <p className="mt-5 text-muted-foreground text-xs leading-relaxed">
        With an account, pages are kept {RETENTION.claimedDays} days, are private unless you say
        otherwise, and appear under Your sites. Without one, pages are public, are deleted after{" "}
        {RETENTION.anonymousDays} days, and cannot be recovered.
      </p>

      {error ? <p className="mt-4 text-destructive-foreground text-sm">{error}</p> : null}
    </Shell>
  );
}
