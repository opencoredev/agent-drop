import { Button, buttonVariants } from "@agent-drop/ui/components/button";
import { Link, useRouteContext } from "@tanstack/react-router";

import { REPO_URL } from "@/lib/agentdrop";

import { GetStartedDialog } from "./get-started-dialog";
import { GitHubMark } from "./github-mark";
import { ThemeToggle } from "./theme-toggle";
import UserMenu from "./user-menu";
import { Wordmark } from "./wordmark";

export function Nav() {
  // Convex's <Authenticated> only resolves once the client socket connects, which
  // left the nav empty for a beat on every load. The root route already knows the
  // answer on the server, so render from that and paint the right nav immediately.
  const { isAuthenticated } = useRouteContext({ from: "__root__" });

  return (
    <header className="sticky top-0 z-40 border-border/70 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5">
        <Link
          to="/"
          className="-m-1.5 rounded-full p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Wordmark className="text-[0.95rem]" />
        </Link>

        <nav className="flex items-center gap-1.5">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Source on GitHub"
            title="Source on GitHub"
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <GitHubMark className="size-4" />
          </a>
          <ThemeToggle />

          {isAuthenticated ? (
            <>
              <Link to="/app" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                My sites
              </Link>
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Sign in
              </Link>
              <GetStartedDialog>
                <Button size="sm">Set up</Button>
              </GetStartedDialog>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
