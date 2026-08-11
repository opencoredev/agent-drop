import { Button } from "@agent-drop/ui/components/button";
import { cn } from "@agent-drop/ui/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { HighlightLanguage } from "@/lib/highlight";

import { Tokens } from "./tokens";

/** One command or URL, sized to be read across a room and copied in one click. */
export function CommandBlock({
  command,
  className,
  prefix = "$",
  wrap = false,
  language = "bash",
}: {
  command: string;
  className?: string;
  /** Gutter marker. `$` for a shell command, `url` for an endpoint. */
  prefix?: string;
  /** Wrap onto a second line instead of scrolling sideways. Use in narrow columns. */
  wrap?: boolean;
  /** Highlighter to use. `plain` turns highlighting off. */
  language?: HighlightLanguage;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      // Always copy the original plain text, never the highlighted markup.
      await navigator.clipboard.writeText(command);
      setCopied(true);
      toast.success("Copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed. Select the text and copy it by hand.");
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border bg-card py-2.5 pr-2.5 pl-3.5 text-left shadow-sm",
        className,
      )}
    >
      <span aria-hidden className="select-none font-mono text-muted-foreground text-sm">
        {prefix}
      </span>
      <code
        className={cn(
          "min-w-0 flex-1 font-mono text-[0.8rem] sm:text-[0.85rem]",
          wrap ? "break-all" : "overflow-x-auto whitespace-nowrap",
        )}
      >
        <Tokens text={command} language={language} />
      </code>
      <Button size="icon-sm" variant="ghost" aria-label={`Copy ${command}`} onClick={copy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  );
}
