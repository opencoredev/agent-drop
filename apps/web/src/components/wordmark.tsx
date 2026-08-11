import { cn } from "@agent-drop/ui/lib/utils";

/** The AgentDrop mark: a green tile with an arrow dropping onto a line. Filled
 * geometry only, identical to public/favicon.svg, so the icon rasterizes the
 * same way everywhere and holds up at 16px. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden="true">
      <rect width="24" height="24" rx="7" className="fill-primary" />
      <g className="fill-primary-foreground">
        <rect x="10.9" y="5" width="2.2" height="7.2" rx="1.1" />
        <path d="M12 15.4 7.6 10.6h8.8z" />
        <rect x="6.9" y="16.6" width="10.2" height="2.2" rx="1.1" />
      </g>
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
