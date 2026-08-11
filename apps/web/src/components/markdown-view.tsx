import "streamdown/styles.css";

import { Skeleton } from "@agent-drop/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Streamdown } from "streamdown";

export function MarkdownView({ contentUrl }: { contentUrl: string }) {
  const [raw, setRaw] = useState(false);
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
    <div className="mx-auto w-full max-w-[46rem] px-6 pt-16 pb-28 sm:px-8">
      {isPending ? (
        <div className="space-y-5">
          <Skeleton className="h-10 w-2/3" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-9/12" />
          </div>
        </div>
      ) : isError ? (
        <p className="text-muted-foreground">This content could not be loaded.</p>
      ) : (
        <>
          {raw ? (
            <pre className="overflow-auto rounded-xl border bg-muted/40 p-5 font-mono text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap break-words">
              {data ?? ""}
            </pre>
          ) : (
            <Streamdown className="doc">{data ?? ""}</Streamdown>
          )}

          <button
            type="button"
            onClick={() => setRaw((v) => !v)}
            className="mt-14 cursor-pointer rounded-sm text-muted-foreground text-xs underline underline-offset-4 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {raw ? "Show formatted" : "View source"}
          </button>
        </>
      )}
    </div>
  );
}
