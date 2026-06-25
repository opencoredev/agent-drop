import { Timeline } from "convex-timeline";

import { components } from "./_generated/api";

// The snapshot we push onto the timeline for every version of a site. Undo/redo
// simply repoints `sites.currentKey` at the `key` from a previous snapshot.
export type SiteVersion = {
  key: string;
  kind: "markdown" | "html";
  title?: string;
  contentType: string;
  byteSize: number;
  createdAt: number;
};

// Keep the most recent 50 versions per site; older ones are pruned.
export const timeline = new Timeline(components.timeline, {
  maxNodesPerScope: 50,
});

export function siteScope(slug: string): string {
  return `site:${slug}`;
}
