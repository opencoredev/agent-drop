import { Button, buttonVariants } from "@agent-drop/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";

import { GetStartedDialog } from "./get-started-dialog";
import { ThemeToggle } from "./theme-toggle";
import UserMenu from "./user-menu";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block size-2.5 rounded-full bg-primary" />
          AgentDrop
        </Link>
        <nav className="flex items-center gap-1.5">
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
          </Unauthenticated>
          <GetStartedDialog>
            <Button size="sm">Get started</Button>
          </GetStartedDialog>
        </nav>
      </div>
    </header>
  );
}
