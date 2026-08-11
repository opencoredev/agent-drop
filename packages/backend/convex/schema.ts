import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const siteKind = v.union(v.literal("markdown"), v.literal("html"));

/**
 * Who may read a page.
 *
 * `public`  anyone with the link.
 * `private` the signed-in owner, or a caller holding the edit token. A stranger
 *           with the link gets the same 404 as a page that never existed, so the
 *           URL alone does not confirm that it exists.
 */
export const siteVisibility = v.union(v.literal("public"), v.literal("private"));

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
    // Absent on rows written before visibility existed; treated as public.
    visibility: v.optional(siteVisibility),
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

  // Long-lived keys that let an agent act as a signed-in account over the HTTP
  // API. Only the SHA-256 hash is stored; the raw key is shown once at creation.
  // A request carrying one gets that account's much larger create budget, and
  // the pages it makes are owned, private by default, and kept for 90 days.
  apiKeys: defineTable({
    ownerSubject: v.string(),
    name: v.string(),
    keyHash: v.string(),
    // Leading characters, so a key is recognizable in the UI without storing it.
    prefix: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_hash", ["keyHash"])
    .index("by_owner", ["ownerSubject"]),

  // ---------------------------------------------------------------------
  // OAuth 2.1, so an MCP client can act for a person instead of anonymously.
  // We are both the authorization server and the resource server.
  // ---------------------------------------------------------------------

  // Clients that registered themselves (RFC 7591). Public clients only: they
  // are installed applications that cannot keep a secret, so PKCE is required
  // instead of client authentication.
  oauthClients: defineTable({
    clientId: v.string(),
    clientName: v.string(),
    redirectUris: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_client_id", ["clientId"]),

  // Authorization codes. Single use, short lived, bound to one PKCE challenge
  // and one redirect URI.
  oauthCodes: defineTable({
    codeHash: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    // Account user id, or a generated id for someone who chose to stay anonymous.
    subject: v.string(),
    anonymous: v.boolean(),
    resource: v.optional(v.string()),
    expiresAt: v.number(),
  }).index("by_hash", ["codeHash"]),

  // Issued tokens, stored only as hashes. `audience` is checked on every call so
  // a token minted for something else cannot be replayed here.
  oauthTokens: defineTable({
    tokenHash: v.string(),
    kind: v.union(v.literal("access"), v.literal("refresh")),
    clientId: v.string(),
    subject: v.string(),
    anonymous: v.boolean(),
    audience: v.string(),
    expiresAt: v.number(),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_expiresAt", ["expiresAt"]),

  // Every R2 content object ever written for a site. The timeline only keeps the
  // most recent 50 versions, so once it prunes a node its R2 key is unreachable
  // from the timeline and would leak storage forever. This ledger is the record
  // that lets update-time pruning and purge delete every object we created.
  siteObjects: defineTable({
    siteId: v.id("sites"),
    key: v.string(),
    createdAt: v.number(),
  }).index("by_site", ["siteId", "createdAt"]),

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
