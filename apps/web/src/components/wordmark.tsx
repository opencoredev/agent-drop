import { cn } from "@agent-drop/ui/lib/utils";

/** The AgentDrop droplet mark — a transparent, theme-adaptive SVG (no tile).
 * The drop inherits the current text color; the spark keeps the brand blue, so
 * the mark reads cleanly on any surface and stays crisp at every size. */
export function DropletMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("text-foreground", className)}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2.2c0 0-7.3 8.1-7.3 13.2a7.3 7.3 0 1 0 14.6 0C19.3 10.3 12 2.2 12 2.2Z"
        fill="currentColor"
      />
      <path
        d="M12 11.3c.18 1.78.92 2.52 2.7 2.7-1.78.18-2.52.92-2.7 2.7-.18-1.78-.92-2.52-2.7-2.7 1.78-.18 2.52-.92 2.7-2.7Z"
        fill="#3b6bff"
      />
    </svg>
  );
}

/** The full AgentDrop lockup: droplet mark + wordmark ("Agent" solid, "Drop"
 * muted). Single source of truth for the brand — swap here to rebrand. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <DropletMark className="size-[1.3em]" />
      <span>
        Agent<span className="text-muted-foreground">Drop</span>
      </span>
    </span>
  );
}
