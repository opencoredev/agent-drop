import "streamdown/styles.css";

import { Skeleton } from "@agent-drop/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@agent-drop/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { Streamdown } from "streamdown";

export function MarkdownView({ contentUrl }: { contentUrl: string }) {
  const { data, isPending, isError } = useQuery({
    // Keyed by the versioned URL, so undo/update refetches automatically.
    queryKey: ["site-content", contentUrl],
    queryFn: async () => {
      const res = await fetch(contentUrl);
      if (!res.ok) throw new Error(`Failed to load content (${res.status})`);
      return res.text();
    },
  });

  return (
    <Tabs defaultValue="formatted">
      <div className="mb-10 flex justify-center">
        <TabsList className="h-8 rounded-full p-0.5">
          <TabsTrigger value="formatted" className="rounded-full px-3.5 text-xs">
            Formatted
          </TabsTrigger>
          <TabsTrigger value="raw" className="rounded-full px-3.5 text-xs">
            Raw
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="formatted">
        {isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : isError ? (
          <p className="text-center text-muted-foreground text-sm">Couldn't load this content.</p>
        ) : (
          <Streamdown className="text-[0.975rem] leading-7 [&_:first-child]:mt-0">
            {data ?? ""}
          </Streamdown>
        )}
      </TabsContent>

      <TabsContent value="raw">
        <pre className="overflow-auto rounded-xl border bg-muted/40 p-5 font-mono text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap break-words">
          {data ?? ""}
        </pre>
      </TabsContent>
    </Tabs>
  );
}
