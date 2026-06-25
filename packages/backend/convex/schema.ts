import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const siteKind = v.union(v.literal("markdown"), v.literal("html"));

export default defineSchema({
  // A deployed static site. The actual content lives in R2 (`currentKey`); this
  // table only holds metadata + the pointer to the current R2 object. Version
  // history / undo is owned by the `convex-timeline` component, keyed by `scope`.
  sites: defineTable({
    slug: v.string(),
    kind: siteKind,
    title: v.optional(v.string()),
    // R2 object key of the content currently served.
    currentKey: v.string(),
    contentType: v.string(),
    byteSize: v.number(),
    // SHA-256 hex of the secret edit token. The raw token is shown to the
    // caller once at deploy time and never stored.
    editTokenHash: v.string(),
    // Better Auth user id once a site has been claimed by signing in. Absent =
    // anonymous.
    ownerSubject: v.optional(v.string()),
    hasImages: v.boolean(),
    // Timeline scope, always `site:<slug>`.
    scope: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Absolute ms timestamp after which the daily cron deletes the site.
    expiresAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_owner", ["ownerSubject"]),

  // Images uploaded for a site, stored in R2. Images always expire after 7 days
  // regardless of whether the site is claimed.
  siteImages: defineTable({
    siteId: v.id("sites"),
    slug: v.string(),
    key: v.string(),
    contentType: v.string(),
    byteSize: v.number(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_expiresAt", ["expiresAt"]),
});
