import { cn } from "@agent-drop/ui/lib/utils";

/** The AgentDrop mark: a green tile with an arrow going down into it. Two
 * shapes, no gradient, no detail that falls apart at 16px. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden="true">
      <rect width="24" height="24" rx="7" className="fill-primary" />
      <path
        d="M12 6v8m0 0 3.2-3.2M12 14l-3.2-3.2M7.5 17.5h9"
        fill="none"
        stroke="currentColor"
        className="text-primary-foreground"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The full lockup. Single source of truth for the brand. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <Mark className="size-[1.45em]" />
      <span>agentdrop</span>
    </span>
  );
}

/** The small "live" pill shown next to a URL or a site title. */
export function LivePill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 font-medium text-[0.7rem] text-accent-foreground",
        className,
      )}
    >
      <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
      live
    </span>
  );
}
