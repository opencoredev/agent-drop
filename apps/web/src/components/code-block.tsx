import { Button } from "@agent-drop/ui/components/button";
import { cn } from "@agent-drop/ui/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { type HighlightLanguage, type TokenKind, highlight } from "@/lib/highlight";

/**
 * Maps each semantic token kind to a coss theme color. Deliberately restrained:
 * three muted accents (info/success/warning) over foreground/muted so the block
 * reads as premium, not a rainbow. `plain` inherits the surrounding text color.
 */
const KIND_CLASS: Record<TokenKind, string | undefined> = {
  plain: undefined,
  comment: "text-muted-foreground/70 italic",
  string: "text-success",
  url: "text-info underline decoration-info/30 underline-offset-2",
  number: "text-warning",
  keyword: "text-foreground font-medium",
  flag: "text-warning",
  property: "text-foreground/90",
  punctuation: "text-muted-foreground",
  marker: "text-warning font-medium",
};

export function CodeBlock({
  text,
  className,
  language = "bash",
}: {
  text: string;
  className?: string;
  /** Highlighter to use. Defaults to shell/curl, the landing-hero case. */
  language?: HighlightLanguage;
}) {
  const [copied, setCopied] = useState(false);

  // Pure + deterministic, so server and client render the same tokens (no
  // hydration mismatch). Memoized only to avoid re-tokenizing on copy state.
  const tokens = useMemo(() => highlight(text, language), [text, language]);

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
      <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/50 p-4 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
        <code>
          {tokens.map((token, i) => {
            const cls = KIND_CLASS[token.kind];
            // Tokens are a stable, deterministic stream, so the index is a fine key.
            return (
              <span key={i} className={cls}>
                {token.value}
              </span>
            );
          })}
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
