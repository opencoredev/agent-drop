import { MarkdownView } from "./markdown-view";

export type ViewerSite = {
  slug: string;
  kind: "markdown" | "html";
  title: string | null;
  contentUrl: string;
};

export function SiteViewer({ site }: { site: ViewerSite }) {
  if (site.kind === "html") {
    return (
      // Untrusted HTML is isolated: a sandbox without `allow-same-origin` runs
      // in a null origin with no access to our cookies/storage, and the raw
      // endpoint is served from the separate Convex `.site` domain with CSP.
      <iframe
        key={site.contentUrl}
        src={site.contentUrl}
        title={site.title ?? site.slug}
        sandbox="allow-scripts allow-popups allow-forms allow-modals"
        className="h-[calc(100svh-3rem)] w-full border-0 bg-white"
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
      <MarkdownView contentUrl={site.contentUrl} />
    </div>
  );
}
