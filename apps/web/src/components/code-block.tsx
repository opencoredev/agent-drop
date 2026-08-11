import { Button } from "@agent-drop/ui/components/button";
import { cn } from "@agent-drop/ui/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { HighlightLanguage } from "@/lib/highlight";

import { Tokens } from "./tokens";

export function CodeBlock({
  text,
  className,
  language = "bash",
  compact = false,
}: {
  text: string;
  className?: string;
  /** Highlighter to use. Defaults to shell/curl, the landing-hero case. */
  language?: HighlightLanguage;
  /** Shorter scroll box, for long text inside a dialog. */
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      // Always copy the original plain text, never the highlighted markup.
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  }

  return (
    <div className={cn("relative", className)}>
      <pre
        className={cn(
          "overflow-auto rounded-xl border bg-muted/50 p-4 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground/90",
          compact ? "max-h-56" : "max-h-80",
        )}
      >
        <code>
          <Tokens text={text} language={language} />
        </code>
      </pre>
      <Button
        size="icon-sm"
        variant="ghost"
        className="absolute end-2 top-2"
        aria-label="Copy to clipboard"
        onClick={copy}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  );
}
