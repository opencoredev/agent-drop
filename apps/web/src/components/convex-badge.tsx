import { cn } from "@agent-drop/ui/lib/utils";

function ConvexMark({ className }: { className?: string }) {
  // Three overlapping lobes evoking the Convex logomark.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="7" r="4.4" fill="#F3B01C" fillOpacity="0.92" />
      <circle cx="7.2" cy="15.5" r="4.4" fill="#EE342F" fillOpacity="0.92" />
      <circle cx="16.8" cy="15.5" r="4.4" fill="#8B5CF6" fillOpacity="0.92" />
    </svg>
  );
}

export function ConvexBadge({ className }: { className?: string }) {
  return (
    <a
      href="https://www.convex.dev"
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <span>Powered by</span>
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        <ConvexMark className="size-4" />
        <span className="underline decoration-muted-foreground/40 decoration-[1.5px] underline-offset-4 transition-colors group-hover:decoration-foreground">
          Convex
        </span>
      </span>
    </a>
  );
}
