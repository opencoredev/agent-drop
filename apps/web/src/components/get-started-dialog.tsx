import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@agent-drop/ui/components/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@agent-drop/ui/components/tabs";
import type React from "react";

import { buildAgentPrompt, buildCurlExample } from "@/lib/agentdrop";

import { CodeBlock } from "./code-block";

export function GetStartedDialog({ children }: { children: React.ReactElement }) {
  return (
    <Dialog>
      <DialogTrigger render={children} />
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Give your agent a place to publish</DialogTitle>
          <DialogDescription>
            Paste this into your coding agent once. After that it can ship sites on its own.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <Tabs defaultValue="prompt">
            <TabsList className="mb-4">
              <TabsTrigger value="prompt">Agent prompt</TabsTrigger>
              <TabsTrigger value="api">Raw API</TabsTrigger>
            </TabsList>
            <TabsContent value="prompt" className="space-y-3">
              <CodeBlock text={buildAgentPrompt()} />
              <p className="text-muted-foreground text-sm">
                Works with Claude Code, Cursor, Codex, and any agent that can run a shell or HTTP
                request.
              </p>
            </TabsContent>
            <TabsContent value="api" className="space-y-3">
              <CodeBlock text={buildCurlExample()} />
              <p className="text-muted-foreground text-sm">
                No SDK, no API key. Save the returned <code className="font-mono">editToken</code>{" "}
                to update, undo, or delete the site later.
              </p>
            </TabsContent>
          </Tabs>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
