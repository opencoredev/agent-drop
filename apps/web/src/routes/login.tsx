import { buttonVariants } from "@agent-drop/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { useState } from "react";

import { Nav } from "@/components/nav";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { Mark } from "@/components/wordmark";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = search.redirect;
    return typeof redirect === "string" && redirect ? { redirect } : {};
  },
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const [showSignIn, setShowSignIn] = useState(true);
  const target = redirect || "/app";

  return (
    <>
      <Nav />
      <main className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-sm flex-col justify-center px-5 py-16">
        <Authenticated>
          <div className="text-center">
            <Mark className="mx-auto size-9" />
            <h1 className="mt-5 font-semibold text-2xl tracking-tight">You're signed in</h1>
            <a href={target} className={`mt-6 ${buttonVariants({ size: "lg" })}`}>
              Continue
            </a>
          </div>
        </Authenticated>
        <Unauthenticated>
          {showSignIn ? (
            <SignInForm redirectTo={target} onSwitchToSignUp={() => setShowSignIn(false)} />
          ) : (
            <SignUpForm redirectTo={target} onSwitchToSignIn={() => setShowSignIn(true)} />
          )}
        </Unauthenticated>
      </main>
    </>
  );
}
