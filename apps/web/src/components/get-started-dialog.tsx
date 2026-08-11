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

import { INSTALL_COMMAND, buildDemoPrompt } from "@/lib/agentdrop";

import { CodeBlock } from "./code-block";
import { CommandBlock } from "./command-block";
import { McpInstall } from "./mcp-install";

export function GetStartedDialog({ children }: { children: React.ReactElement }) {
  return (
    <Dialog>
      <DialogTrigger render={children} />
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Set up agentdrop</DialogTitle>
          <DialogDescription>Pick whichever one your agent already speaks.</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <Tabs defaultValue="skill">
            <TabsList className="w-full">
              <TabsTrigger value="skill" className="flex-1">
                Skill
              </TabsTrigger>
              <TabsTrigger value="mcp" className="flex-1">
                MCP
              </TabsTrigger>
              <TabsTrigger value="demo" className="flex-1">
                Demo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="skill" className="mt-5 space-y-3">
              <CommandBlock command={INSTALL_COMMAND} />
              <p className="text-muted-foreground text-sm leading-relaxed">
                Run it where your agent lives. The CLI asks which tools to install into and writes
                the skill there.
              </p>
            </TabsContent>

            <TabsContent value="mcp" className="mt-5 space-y-3">
              <p className="text-muted-foreground text-sm leading-relaxed">
                A stateless Streamable HTTP server: no session, no process to run, no key.
              </p>
              <McpInstall />
            </TabsContent>

            <TabsContent value="demo" className="mt-5 space-y-3">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Paste this into your agent. It installs agentdrop, publishes a real page, and hands
                you the link.
              </p>
              <CodeBlock text={buildDemoPrompt()} language="prompt" compact />
            </TabsContent>
          </Tabs>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
