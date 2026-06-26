import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@agent-drop/ui/components/dialog";
import { Button } from "@agent-drop/ui/components/button";
import { CheckIcon, CopyIcon } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";

import { buildAgentPrompt } from "@/lib/agentdrop";

import { CodeBlock } from "./code-block";

const STEPS = [
  "Asks which tool to set up — Codex, Claude Code, Cursor, or several at once.",
  "Saves the skill there and adds one line so the tool knows when to publish.",
  "From then on it ships a live URL with a single API call.",
];

export function GetStartedDialog({ children }: { children: React.ReactElement }) {
  const prompt = buildAgentPrompt();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Agent prompt copied — paste it into your agent");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy — select the text and copy manually.");
    }
  }

  return (
    <Dialog>
      <DialogTrigger render={children} />
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Set up AgentDrop in your agent</DialogTitle>
          <DialogDescription>
            Paste this prompt into your coding agent once. It asks which tool to set up, installs the
            skill there, and adds a one-line config — then it can publish sites on its own.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="space-y-2">
            <span className="font-mono text-[0.65rem] text-muted-foreground uppercase tracking-[0.18em]">
              Agent prompt
            </span>
            <CodeBlock text={prompt} language="prompt" />
          </div>
          <Button size="lg" className="w-full" onClick={copy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy agent prompt"}
          </Button>
          <ol className="space-y-2 text-muted-foreground text-sm">
            {STEPS.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-medium text-foreground text-xs">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground text-xs">
            Works with Claude Code, Cursor, Codex, and any agent that can run a shell or HTTP request.
          </p>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
