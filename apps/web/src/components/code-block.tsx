import { Button } from "@agent-drop/ui/components/button";
import { cn } from "@agent-drop/ui/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function CodeBlock({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
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
      <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/50 p-4 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
        {text}
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
