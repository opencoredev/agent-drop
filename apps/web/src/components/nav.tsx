import { Button, buttonVariants } from "@agent-drop/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";

import { SKILL_URL } from "@/lib/agentdrop";

import { GetStartedDialog } from "./get-started-dialog";
import { ThemeToggle } from "./theme-toggle";
import UserMenu from "./user-menu";
import { Wordmark } from "./wordmark";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-border/70 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5">
        <Link
          to="/"
          className="-m-1.5 rounded-full p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Wordmark className="text-[0.95rem]" />
        </Link>

        <nav className="flex items-center gap-2">
          <a
            href={SKILL_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="hidden rounded-full px-2 text-muted-foreground text-sm transition-colors hover:text-foreground sm:inline-flex"
          >
            Skill
          </a>
          <ThemeToggle />
          <Authenticated>
            <Link to="/app" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              My sites
            </Link>
            <UserMenu />
          </Authenticated>
          <Unauthenticated>
            <Link to="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Sign in
            </Link>
            <GetStartedDialog>
              <Button size="sm">Set up</Button>
            </GetStartedDialog>
          </Unauthenticated>
        </nav>
      </div>
    </header>
  );
}
