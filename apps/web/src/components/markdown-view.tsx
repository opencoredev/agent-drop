import "streamdown/styles.css";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@agent-drop/ui/components/tabs";
import { Skeleton } from "@agent-drop/ui/components/skeleton";
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
      <div className="mb-8 flex justify-center">
        <TabsList>
          <TabsTrigger value="formatted">Formatted</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="formatted">
        {isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : isError ? (
          <p className="text-center text-muted-foreground">Couldn't load this content.</p>
        ) : (
          <Streamdown className="text-[0.95rem] leading-relaxed">{data ?? ""}</Streamdown>
        )}
      </TabsContent>

      <TabsContent value="raw">
        <pre className="overflow-auto rounded-lg border bg-muted/40 p-5 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
          {data ?? ""}
        </pre>
      </TabsContent>
    </Tabs>
  );
}
