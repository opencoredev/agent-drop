import type React from "react";

/** Shared frame for sign in and sign up, so both screens sit on the same grid
 * and only the fields differ. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full rounded-2xl border bg-card p-7 shadow-sm sm:p-8">
      <h1 className="font-semibold text-xl tracking-tight">{title}</h1>
      <p className="mt-1.5 mb-7 text-muted-foreground text-sm">{subtitle}</p>
      {children}
    </div>
  );
}

type FieldError = { message?: string } | undefined;

export function AuthField({
  errors,
  children,
}: {
  errors: readonly FieldError[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {children}
      {errors.map((error) => (
        <p key={error?.message} className="text-destructive-foreground text-sm">
          {error?.message}
        </p>
      ))}
    </div>
  );
}

export function AuthSwitch({
  label,
  action,
  onClick,
}: {
  label: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <p className="mt-6 text-center text-muted-foreground text-sm">
      {label}{" "}
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer rounded-sm font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {action}
      </button>
    </p>
  );
}
