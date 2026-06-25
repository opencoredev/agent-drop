import { cn } from "@agent-drop/ui/lib/utils";

/**
 * The AgentDrop logo lockup — the single source of truth for the brand.
 * The droplet mark (a dark rounded tile, so it reads on both themes) sits beside
 * the wordmark: "Agent" in full contrast, "Drop" muted. The mark scales with the
 * surrounding font-size (em units), so one component fits nav, footer, and viewer.
 * Swap `/icon.png` to rebrand.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <img
        src="/icon.png"
        alt=""
        aria-hidden
        className="size-[1.45em] rounded-[0.3em] ring-1 ring-foreground/10"
      />
      <span>
        Agent<span className="text-muted-foreground">Drop</span>
      </span>
    </span>
  );
}
