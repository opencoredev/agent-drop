import { cn } from "@agent-drop/ui/lib/utils";
import { useState } from "react";

import { MCP_TARGETS } from "@/lib/agentdrop";

import { AgentLogo } from "./agent-logo";
import { CodeBlock } from "./code-block";
import { CommandBlock } from "./command-block";

/** Pick your agent, get the exact line that connects it. A bare endpoint URL
 * asks the reader to go find their own instructions, so we ship those instead. */
export function McpInstall({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState(MCP_TARGETS[0]!.id);
  const target = MCP_TARGETS.find((t) => t.id === selected) ?? MCP_TARGETS[0]!;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {MCP_TARGETS.map((t) => {
          const active = t.id === target.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(t.id)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary/40 bg-accent text-accent-foreground"
                  : "border-transparent bg-muted/60 text-muted-foreground hover:text-foreground",
              )}
            >
              <AgentLogo logo={t.logo} className="size-3.5" />
              {t.name}
            </button>
          );
        })}
      </div>

      {target.install.kind === "command" ? (
        <CommandBlock
          command={target.install.value}
          wrap
          className={compact ? "border-0 bg-muted/60 shadow-none" : undefined}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {target.name} has no CLI for this. Add it to{" "}
            <code className="font-mono text-foreground">{target.install.path}</code>.
          </p>
          <CodeBlock text={target.install.value} language="prompt" compact />
        </div>
      )}
    </div>
  );
}
