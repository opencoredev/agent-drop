import { Button } from "@agent-drop/ui/components/button";
import { Input } from "@agent-drop/ui/components/input";
import { Label } from "@agent-drop/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import { AuthCard, AuthField, AuthSwitch } from "./auth-shell";

export default function SignInForm({
  onSwitchToSignUp,
  redirectTo = "/app",
}: {
  onSwitchToSignUp: () => void;
  redirectTo?: string;
}) {
  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        { email: value.email, password: value.password },
        {
          onSuccess: () => {
            toast.success("Signed in");
            window.location.href = redirectTo;
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Enter a valid email address"),
        password: z.string().min(8, "Passwords are at least 8 characters"),
      }),
    },
  });

  return (
    <AuthCard title="Sign in" subtitle="Pick up the sites you saved.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="email">
          {(field) => (
            <AuthField errors={field.state.meta.errors}>
              <Label htmlFor={field.name}>Email</Label>
              <Input
                id={field.name}
                name={field.name}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </AuthField>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <AuthField errors={field.state.meta.errors}>
              <Label htmlFor={field.name}>Password</Label>
              <Input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete="current-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </AuthField>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              type="submit"
              size="lg"
              className="mt-2 w-full"
              disabled={!canSubmit || isSubmitting}
              loading={isSubmitting}
            >
              Sign in
            </Button>
          )}
        </form.Subscribe>
      </form>

      <AuthSwitch label="No account yet?" action="Create one" onClick={onSwitchToSignUp} />
    </AuthCard>
  );
}
