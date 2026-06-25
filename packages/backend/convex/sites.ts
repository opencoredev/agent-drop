import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import {
  type MutationCtx,
  type QueryCtx,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { authComponent } from "./auth";
import { sha256Hex, siteExpiry } from "./lib";
import { r2 } from "./r2";
import { siteKind } from "./schema";
import { type SiteVersion, timeline } from "./timeline";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function bySlug(ctx: QueryCtx, slug: string): Promise<Doc<"sites"> | null> {
  return await ctx.db
    .query("sites")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

function isSiteVersion(value: unknown): value is SiteVersion {
  return typeof value === "object" && value !== null && "key" in value;
}

/** Delete a site and every R2 object + timeline node belonging to it. */
async function purgeSite(ctx: MutationCtx, site: Doc<"sites">): Promise<void> {
  const keys = new Set<string>([site.currentKey]);
  const nodes = await timeline.listNodes(ctx, site.scope);
  for (const node of nodes) {
    if (isSiteVersion(node.document)) keys.add(node.document.key);
  }
  const images = await ctx.db
    .query("siteImages")
    .withIndex("by_site", (q) => q.eq("siteId", site._id))
    .collect();
  for (const img of images) keys.add(img.key);

  for (const key of keys) {
    try {
      await r2.deleteObject(ctx, key);
    } catch {
      // Object may already be gone; deleting metadata below is what matters.
    }
  }
  for (const img of images) await ctx.db.delete(img._id);
  await timeline.deleteScope(ctx, site.scope);
  await ctx.db.delete(site._id);
}

// ---------------------------------------------------------------------------
// Public queries (used by the web app)
// ---------------------------------------------------------------------------

/** Reactive metadata for the viewer. Returns `null` for unknown slugs. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await bySlug(ctx, slug);
    if (!site) return null;
    const status = await timeline.status(ctx, site.scope);
    const siteUrl = process.env.CONVEX_SITE_URL ?? "";
    return {
      slug: site.slug,
      kind: site.kind,
      title: site.title ?? null,
      byteSize: site.byteSize,
      hasImages: site.hasImages,
      owned: site.ownerSubject !== undefined,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
      expiresAt: site.expiresAt,
      canUndo: status.canUndo,
      canRedo: status.canRedo,
      version: status.position,
      versions: status.length,
      // Versioned so the URL changes on every deploy/update/undo, busting any
      // browser cache and reloading the viewer's <iframe>/fetch.
      contentUrl: `${siteUrl}/api/v1/sites/${encodeURIComponent(slug)}/raw?v=${encodeURIComponent(
        site.currentKey,
      )}`,
    };
  },
});

/** Sites claimed by the currently signed-in user. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const sites = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerSubject", user._id))
      .collect();
    return sites
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((s) => ({
        slug: s.slug,
        kind: s.kind,
        title: s.title ?? null,
        updatedAt: s.updatedAt,
        expiresAt: s.expiresAt,
        hasImages: s.hasImages,
      }));
  },
});

// ---------------------------------------------------------------------------
// Public mutation: claim a site by signing in
// ---------------------------------------------------------------------------

export const claim = mutation({
  args: { slug: v.string(), editToken: v.string() },
  handler: async (ctx, { slug, editToken }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error("You must be signed in to claim a site.");
    const site = await bySlug(ctx, slug);
    if (!site) throw new Error("Site not found.");
    if (site.editTokenHash !== (await sha256Hex(editToken))) {
      throw new Error("Invalid edit token for this site.");
    }
    const now = Date.now();
    const expiresAt = siteExpiry(now, true);
    await ctx.db.patch(site._id, { ownerSubject: user._id, expiresAt, updatedAt: now });
    return { ok: true, expiresAt };
  },
});

// ---------------------------------------------------------------------------
// Internal queries (used by the HTTP API)
// ---------------------------------------------------------------------------

export const slugExists = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => (await bySlug(ctx, slug)) !== null,
});

/** Verify a bearer token against a slug; returns site identity on success. */
export const authBySlug = internalQuery({
  args: { slug: v.string(), tokenHash: v.string() },
  handler: async (ctx, { slug, tokenHash }) => {
    const site = await bySlug(ctx, slug);
    if (!site || site.editTokenHash !== tokenHash) return null;
    return { siteId: site._id, slug: site.slug, scope: site.scope };
  },
});

export const rawInfoBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await bySlug(ctx, slug);
    if (!site) return null;
    return { key: site.currentKey, kind: site.kind, contentType: site.contentType };
  },
});

export const statusBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await bySlug(ctx, slug);
    if (!site) return null;
    const status = await timeline.status(ctx, site.scope);
    return {
      slug: site.slug,
      kind: site.kind,
      title: site.title ?? null,
      hasImages: site.hasImages,
      owned: site.ownerSubject !== undefined,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
      expiresAt: site.expiresAt,
      canUndo: status.canUndo,
      canRedo: status.canRedo,
      version: status.position,
      versions: status.length,
    };
  },
});

export const imageCount = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const images = await ctx.db
      .query("siteImages")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return images.length;
  },
});

export const assetInfo = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const normalized = ctx.db.normalizeId("siteImages", id);
    if (!normalized) return null;
    const doc = await ctx.db.get(normalized);
    if (!doc || doc.expiresAt < Date.now()) return null;
    return { key: doc.key, contentType: doc.contentType };
  },
});

// ---------------------------------------------------------------------------
// Internal mutations (write paths, called after R2 stores in the HTTP API)
// ---------------------------------------------------------------------------

export const recordDeploy = internalMutation({
  args: {
    slug: v.string(),
    scope: v.string(),
    kind: siteKind,
    title: v.optional(v.string()),
    key: v.string(),
    contentType: v.string(),
    byteSize: v.number(),
    editTokenHash: v.string(),
    now: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, a) => {
    if (await bySlug(ctx, a.slug)) throw new Error("slug-taken");
    const siteId = await ctx.db.insert("sites", {
      slug: a.slug,
      kind: a.kind,
      title: a.title,
      currentKey: a.key,
      contentType: a.contentType,
      byteSize: a.byteSize,
      editTokenHash: a.editTokenHash,
      hasImages: false,
      scope: a.scope,
      createdAt: a.now,
      updatedAt: a.now,
      expiresAt: a.expiresAt,
    });
    const version: SiteVersion = {
      key: a.key,
      kind: a.kind,
      title: a.title,
      contentType: a.contentType,
      byteSize: a.byteSize,
      createdAt: a.now,
    };
    await timeline.push(ctx, a.scope, version);
    return { siteId };
  },
});

export const recordUpdate = internalMutation({
  args: {
    slug: v.string(),
    kind: siteKind,
    title: v.optional(v.string()),
    key: v.string(),
    contentType: v.string(),
    byteSize: v.number(),
  },
  handler: async (ctx, a) => {
    const site = await bySlug(ctx, a.slug);
    if (!site) throw new Error("not-found");
    const now = Date.now();
    await ctx.db.patch(site._id, {
      kind: a.kind,
      title: a.title ?? site.title,
      currentKey: a.key,
      contentType: a.contentType,
      byteSize: a.byteSize,
      updatedAt: now,
      expiresAt: siteExpiry(now, site.ownerSubject !== undefined),
    });
    const version: SiteVersion = {
      key: a.key,
      kind: a.kind,
      title: a.title ?? site.title,
      contentType: a.contentType,
      byteSize: a.byteSize,
      createdAt: now,
    };
    await timeline.push(ctx, site.scope, version);
    return { ok: true };
  },
});

async function step(
  ctx: MutationCtx,
  slug: string,
  direction: "undo" | "redo",
): Promise<null | {
  changed: boolean;
  canUndo: boolean;
  canRedo: boolean;
  version: number | null;
  versions: number;
}> {
  const site = await bySlug(ctx, slug);
  if (!site) return null;
  const state =
    direction === "undo"
      ? await timeline.undo(ctx, site.scope)
      : await timeline.redo(ctx, site.scope);
  if (isSiteVersion(state)) {
    const now = Date.now();
    await ctx.db.patch(site._id, {
      currentKey: state.key,
      kind: state.kind,
      title: state.title ?? site.title,
      contentType: state.contentType,
      byteSize: state.byteSize,
      updatedAt: now,
      expiresAt: siteExpiry(now, site.ownerSubject !== undefined),
    });
  }
  const status = await timeline.status(ctx, site.scope);
  return {
    changed: state !== null,
    canUndo: status.canUndo,
    canRedo: status.canRedo,
    version: status.position,
    versions: status.length,
  };
}

export const applyUndo = internalMutation({
  args: { slug: v.string() },
  handler: (ctx, { slug }) => step(ctx, slug, "undo"),
});

export const applyRedo = internalMutation({
  args: { slug: v.string() },
  handler: (ctx, { slug }) => step(ctx, slug, "redo"),
});

export const recordImage = internalMutation({
  args: {
    siteId: v.id("sites"),
    slug: v.string(),
    key: v.string(),
    contentType: v.string(),
    byteSize: v.number(),
    now: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, a) => {
    const imageId = await ctx.db.insert("siteImages", {
      siteId: a.siteId,
      slug: a.slug,
      key: a.key,
      contentType: a.contentType,
      byteSize: a.byteSize,
      createdAt: a.now,
      expiresAt: a.expiresAt,
    });
    const site = await ctx.db.get(a.siteId);
    if (site && !site.hasImages) await ctx.db.patch(a.siteId, { hasImages: true });
    return { imageId };
  },
});

export const purgeBySlug = internalMutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await bySlug(ctx, slug);
    if (!site) return { ok: false };
    await purgeSite(ctx, site);
    return { ok: true };
  },
});

/** Daily cron: delete expired images, then expired sites (bounded batches). */
export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const expiredImages = await ctx.db
      .query("siteImages")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(100);
    for (const img of expiredImages) {
      try {
        await r2.deleteObject(ctx, img.key);
      } catch {
        // ignore; metadata removal below is the source of truth
      }
      await ctx.db.delete(img._id);
    }

    const expiredSites = await ctx.db
      .query("sites")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(25);
    for (const site of expiredSites) await purgeSite(ctx, site);

    return { images: expiredImages.length, sites: expiredSites.length };
  },
});
