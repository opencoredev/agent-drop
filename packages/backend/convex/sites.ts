import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  type QueryCtx,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { authComponent } from "./auth";
import { LIMITS, generateEditToken, mintViewToken, sha256Hex, siteExpiry } from "./lib";
import { r2 } from "./r2";
import { siteKind, siteVisibility } from "./schema";
import { MAX_VERSIONS, type SiteVersion, timeline } from "./timeline";

/** How many stale content objects one update may clean up. Keeps the mutation
 * cheap while still draining any backlog over successive updates. */
const PRUNE_BATCH = 5;

/** Bounded drain sizes so one mutation stays well inside Convex budgets. */
const PURGE_OBJECT_BATCH = 10;
const PURGE_IMAGE_BATCH = 10;
const CLEANUP_IMAGE_BATCH = 50;
const CLEANUP_SITE_BATCH = 5;

/** Enough keys to separate machines or agents, few enough to stay reviewable. */
const MAX_KEYS_PER_ACCOUNT = 10;

/** Soft cap on the account sites list; the UI is a recent-sites panel, not an archive browser. */
const LIST_MINE_LIMIT = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function bySlug(ctx: QueryCtx, slug: string): Promise<Doc<"sites"> | null> {
  return await ctx.db
    .query("sites")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

/**
 * A site that has not expired yet. Cleanup is a once-a-day cron, so a row can
 * outlive its own `expiresAt` by up to a day; serving or editing it in that
 * window would break the retention promise and let a token holder revive a page
 * that was supposed to be gone. Every read and auth path goes through this.
 */
async function liveBySlug(ctx: QueryCtx, slug: string): Promise<Doc<"sites"> | null> {
  const site = await bySlug(ctx, slug);
  if (!site || site.expiresAt <= Date.now()) return null;
  return site;
}

/** A page with no stored visibility predates the field and is public. */
function visibilityOf(site: Doc<"sites">): "public" | "private" {
  return site.visibility ?? "public";
}

/** Whether the caller signed in as the owner of this page. */
async function isOwner(ctx: QueryCtx, site: Doc<"sites">): Promise<boolean> {
  if (!site.ownerSubject) return false;
  const user = await authComponent.safeGetAuthUser(ctx);
  return user?._id === site.ownerSubject;
}

/** Record an R2 content object so purge can delete it even after the timeline
 * has pruned the version that referenced it. */
async function trackObject(ctx: MutationCtx, siteId: Id<"sites">, key: string): Promise<void> {
  await ctx.db.insert("siteObjects", { siteId, key, createdAt: Date.now() });
}

/**
 * Delete an R2 object. Returns true when the key is gone (deleted or already
 * absent). On a transient failure, returns false so the caller keeps the ledger
 * row and retries later — never forget a key we still owe a delete for.
 */
async function tryDeleteR2(ctx: MutationCtx, key: string): Promise<boolean> {
  try {
    await r2.deleteObject(ctx, key);
    return true;
  } catch {
    return false;
  }
}

/** Drop content objects that fell out of the retained history. The timeline keeps
 * MAX_VERSIONS nodes, so anything older can never be reached by undo again. One
 * update adds one object, so trimming a small batch per update holds steady. */
async function pruneObjects(ctx: MutationCtx, siteId: Id<"sites">): Promise<void> {
  const tracked = await ctx.db
    .query("siteObjects")
    .withIndex("by_site", (q) => q.eq("siteId", siteId))
    .order("asc")
    .take(MAX_VERSIONS + PRUNE_BATCH);
  const excess = tracked.length - MAX_VERSIONS;
  if (excess <= 0) return;

  for (const row of tracked.slice(0, excess)) {
    if (!(await tryDeleteR2(ctx, row.key))) continue;
    await ctx.db.delete(row._id);
  }
}

function isSiteVersion(value: unknown): value is SiteVersion {
  return typeof value === "object" && value !== null && "key" in value;
}

/**
 * One bounded step of destroying a site's R2 blobs + metadata.
 *
 * Ledger rows are removed only after a successful R2 delete. The site row and
 * timeline scope stay until every blob is gone, so a failed delete can be
 * retried without losing the key.
 *
 * - `done` — site document removed
 * - `more` — more ledger rows to process (chain immediately)
 * - `retry` — R2 failed for at least one key (back off before retrying)
 */
async function drainSite(ctx: MutationCtx, site: Doc<"sites">): Promise<"done" | "more" | "retry"> {
  let failed = false;

  const objects = await ctx.db
    .query("siteObjects")
    .withIndex("by_site", (q) => q.eq("siteId", site._id))
    .take(PURGE_OBJECT_BATCH);
  for (const row of objects) {
    if (await tryDeleteR2(ctx, row.key)) await ctx.db.delete(row._id);
    else failed = true;
  }
  if (objects.length === PURGE_OBJECT_BATCH) return failed ? "retry" : "more";

  const images = await ctx.db
    .query("siteImages")
    .withIndex("by_site", (q) => q.eq("siteId", site._id))
    .take(PURGE_IMAGE_BATCH);
  for (const img of images) {
    if (await tryDeleteR2(ctx, img.key)) await ctx.db.delete(img._id);
    else failed = true;
  }
  if (images.length === PURGE_IMAGE_BATCH) return failed ? "retry" : "more";

  // Anything still on the ledger failed this round — keep the site for retry.
  const leftoverObject = await ctx.db
    .query("siteObjects")
    .withIndex("by_site", (q) => q.eq("siteId", site._id))
    .take(1);
  if (leftoverObject.length > 0) return "retry";
  const leftoverImage = await ctx.db
    .query("siteImages")
    .withIndex("by_site", (q) => q.eq("siteId", site._id))
    .take(1);
  if (leftoverImage.length > 0) return "retry";

  // Keys that predate the ledger, or the live pointer, still live on the site
  // row / timeline. Delete them before dropping the only place we remember them.
  const legacyKeys = new Set<string>([site.currentKey]);
  for (const node of await timeline.listNodes(ctx, site.scope)) {
    if (isSiteVersion(node.document)) legacyKeys.add(node.document.key);
  }
  for (const key of legacyKeys) {
    if (!(await tryDeleteR2(ctx, key))) return "retry";
  }

  await timeline.deleteScope(ctx, site.scope);
  await ctx.db.delete(site._id);
  return "done";
}

/** Make a site unreadable immediately, then drain what this mutation can. */
async function beginSiteDeletion(
  ctx: MutationCtx,
  site: Doc<"sites">,
): Promise<"done" | "more" | "retry"> {
  const now = Date.now();
  if (site.expiresAt > now) {
    await ctx.db.patch(site._id, { expiresAt: now, updatedAt: now });
    site = { ...site, expiresAt: now, updatedAt: now };
  }
  return await drainSite(ctx, site);
}

function scheduleDrain(ctx: MutationCtx, siteId: Id<"sites">, status: "more" | "retry") {
  const delay = status === "more" ? 0 : 60_000;
  return ctx.scheduler.runAfter(delay, internal.sites.drainSiteById, { siteId });
}

// ---------------------------------------------------------------------------
// Public queries (used by the web app)
// ---------------------------------------------------------------------------

/** Shared viewer/manage payload once the caller is allowed to see the site. */
async function sitePayload(ctx: QueryCtx, site: Doc<"sites">) {
  const visibility = visibilityOf(site);
  const status = await timeline.status(ctx, site.scope);
  const siteUrl = process.env.CONVEX_SITE_URL ?? "";
  return {
    slug: site.slug,
    kind: site.kind,
    title: site.title ?? null,
    byteSize: site.byteSize,
    hasImages: site.hasImages,
    visibility,
    owned: site.ownerSubject !== undefined,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
    expiresAt: site.expiresAt,
    canUndo: status.canUndo,
    canRedo: status.canRedo,
    version: status.position,
    versions: status.length,
    // Versioned so the URL changes on every deploy/update/undo, busting any
    // browser cache and reloading the viewer's <iframe>/fetch. A private page
    // also carries a short-lived capability, minted only because the caller
    // already proved they may see it.
    contentUrl:
      `${siteUrl}/api/v1/sites/${encodeURIComponent(site.slug)}/raw?v=${encodeURIComponent(
        site.currentKey,
      )}` +
      (visibility === "private"
        ? `&vt=${encodeURIComponent(await mintViewToken(site.slug, site.currentKey, Date.now()))}`
        : ""),
  };
}

/** Reactive metadata for the viewer. Returns `null` for unknown or expired slugs. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await liveBySlug(ctx, slug);
    if (!site) return null;

    // A private page must not even confirm it exists to a stranger, so this is
    // the same null the viewer renders as "this page is gone".
    if (visibilityOf(site) === "private" && !(await isOwner(ctx, site))) return null;

    return await sitePayload(ctx, site);
  },
});

/**
 * Same payload as `getBySlug`, but authorized by the edit token instead of a
 * session. The manage URL agents return includes `?t=…`; without this query a
 * private page looks gone to anyone who is not signed in as the owner.
 */
export const getBySlugForManager = query({
  args: { slug: v.string(), editToken: v.string() },
  handler: async (ctx, { slug, editToken }) => {
    const site = await liveBySlug(ctx, slug);
    if (!site) return null;
    if (site.editTokenHash !== (await sha256Hex(editToken))) return null;
    return await sitePayload(ctx, site);
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
      .withIndex("by_owner_updated", (q) => q.eq("ownerSubject", user._id))
      .order("desc")
      .take(LIST_MINE_LIMIT);
    return sites.map((s) => ({
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

/**
 * Flip a page between public and private from the manage screen.
 *
 * Only the signed-in owner may do this: a page whose reader set can change has
 * to have someone accountable for it, and the edit token alone is a bearer
 * secret an agent may have logged somewhere.
 */
export const setVisibility = mutation({
  args: { slug: v.string(), visibility: siteVisibility },
  handler: async (ctx, { slug, visibility }) => {
    const site = await liveBySlug(ctx, slug);
    if (!site) throw new Error("Site not found.");
    if (!(await isOwner(ctx, site))) {
      throw new Error("Only the owner can change who can see this page. Claim it first.");
    }
    await ctx.db.patch(site._id, { visibility });
    return { ok: true, visibility };
  },
});

export const claim = mutation({
  args: { slug: v.string(), editToken: v.string() },
  handler: async (ctx, { slug, editToken }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error("You must be signed in to claim a site.");
    const site = await liveBySlug(ctx, slug);
    if (!site) throw new Error("Site not found.");
    if (site.editTokenHash !== (await sha256Hex(editToken))) {
      throw new Error("Invalid edit token for this site.");
    }
    // Edit token proves control of the page, but not the right to steal it from
    // whoever already claimed it. Same owner re-claiming is a no-op success.
    if (site.ownerSubject && site.ownerSubject !== user._id) {
      throw new Error("This site is already claimed by another account.");
    }
    if (site.ownerSubject === user._id) {
      return { ok: true, expiresAt: site.expiresAt };
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

/**
 * Verify a bearer token against a slug. The caller needs to tell a gone site
 * apart from a wrong token, otherwise an agent retries forever against a page
 * that expired.
 */
export const authBySlug = internalQuery({
  args: { slug: v.string(), tokenHash: v.string() },
  handler: async (ctx, { slug, tokenHash }) => {
    const site = await liveBySlug(ctx, slug);
    if (!site) return { ok: false as const, reason: "missing" as const };
    if (site.editTokenHash !== tokenHash) {
      return { ok: false as const, reason: "forbidden" as const };
    }
    return { ok: true as const, siteId: site._id, slug: site.slug, scope: site.scope };
  },
});

export const rawInfoBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await liveBySlug(ctx, slug);
    if (!site) return null;
    return {
      key: site.currentKey,
      kind: site.kind,
      contentType: site.contentType,
      visibility: visibilityOf(site),
      editTokenHash: site.editTokenHash,
    };
  },
});

export const statusBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await liveBySlug(ctx, slug);
    if (!site) return null;
    const status = await timeline.status(ctx, site.scope);
    return {
      slug: site.slug,
      kind: site.kind,
      title: site.title ?? null,
      hasImages: site.hasImages,
      visibility: visibilityOf(site),
      // Only the HTTP layer sees this; it decides whether the caller may know
      // the page exists at all.
      editTokenHash: site.editTokenHash,
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
      .take(LIMITS.maxImagesPerSite + 1);
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
    ownerSubject: v.optional(v.string()),
    visibility: siteVisibility,
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
      ownerSubject: a.ownerSubject,
      visibility: a.visibility,
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
    await trackObject(ctx, siteId, a.key);
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
    visibility: v.optional(siteVisibility),
  },
  handler: async (ctx, a) => {
    const site = await liveBySlug(ctx, a.slug);
    if (!site) throw new Error("not-found");
    const now = Date.now();
    await ctx.db.patch(site._id, {
      kind: a.kind,
      title: a.title ?? site.title,
      currentKey: a.key,
      contentType: a.contentType,
      byteSize: a.byteSize,
      // Omitting visibility on update leaves the page as it was.
      visibility: a.visibility ?? visibilityOf(site),
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
    await trackObject(ctx, site._id, a.key);
    await pruneObjects(ctx, site._id);
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
  const site = await liveBySlug(ctx, slug);
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
    const status = await beginSiteDeletion(ctx, site);
    if (status !== "done") await scheduleDrain(ctx, site._id, status);
    return { ok: true };
  },
});

/** Continue a site drain after user delete or a previous partial cleanup step. */
export const drainSiteById = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const site = await ctx.db.get(siteId);
    if (!site) return { done: true };
    const status = await drainSite(ctx, site);
    if (status !== "done") await scheduleDrain(ctx, siteId, status);
    return { done: status === "done", status };
  },
});

/** Daily cron kickoff (and self-scheduled follow-ups): expire images, then sites. */
export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let saturated = false;
    let needsRetry = false;

    const expiredImages = await ctx.db
      .query("siteImages")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(CLEANUP_IMAGE_BATCH);
    for (const img of expiredImages) {
      // Leave the row alone when R2 fails so a later pass can retry the key.
      if (await tryDeleteR2(ctx, img.key)) await ctx.db.delete(img._id);
      else needsRetry = true;
    }
    if (expiredImages.length === CLEANUP_IMAGE_BATCH) saturated = true;

    const expiredSites = await ctx.db
      .query("sites")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(CLEANUP_SITE_BATCH);
    for (const site of expiredSites) {
      const status = await drainSite(ctx, site);
      if (status !== "done") {
        if (status === "retry") needsRetry = true;
        await scheduleDrain(ctx, site._id, status);
      }
    }
    if (expiredSites.length === CLEANUP_SITE_BATCH) saturated = true;

    // Keep draining immediately while the index still has a full batch. Failed
    // deletes are left to drainSiteById backoff / a delayed cleanup pass.
    if (saturated) {
      await ctx.scheduler.runAfter(0, internal.sites.cleanupExpired, {});
    } else if (needsRetry) {
      await ctx.scheduler.runAfter(60_000, internal.sites.cleanupExpired, {});
    }

    return {
      images: expiredImages.length,
      sites: expiredSites.length,
      saturated,
      needsRetry,
    };
  },
});

// ---------------------------------------------------------------------------
// Account API keys
//
// The HTTP API is otherwise anonymous: an edit token proves you may change one
// page, not who you are. A key is what lets an agent act as an account, which is
// what raises the create limit and makes new pages owned and private.
// ---------------------------------------------------------------------------

/** How stale `lastUsedAt` may get before a request pays to refresh it. */
const KEY_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export const listApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_owner", (q) => q.eq("ownerSubject", user._id))
      .collect();
    return keys
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((k) => ({
        id: k._id,
        name: k.name,
        prefix: k.prefix,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt ?? null,
      }));
  },
});

export const createApiKey = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error("You must be signed in to create a key.");

    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_owner", (q) => q.eq("ownerSubject", user._id))
      .collect();
    if (existing.length >= MAX_KEYS_PER_ACCOUNT) {
      throw new Error(`You can have at most ${MAX_KEYS_PER_ACCOUNT} keys. Revoke one first.`);
    }

    const key = `adk_${generateEditToken()}`;
    await ctx.db.insert("apiKeys", {
      ownerSubject: user._id,
      name: name.trim().slice(0, 60) || "Untitled key",
      keyHash: await sha256Hex(key),
      prefix: key.slice(0, 12),
      createdAt: Date.now(),
    });
    // The only time the raw key exists outside the caller's machine.
    return { key };
  },
});

export const revokeApiKey = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, { id }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error("You must be signed in.");
    const row = await ctx.db.get(id);
    if (!row || row.ownerSubject !== user._id) throw new Error("Key not found.");
    await ctx.db.delete(id);
    return { ok: true };
  },
});

/** Resolve a presented key to its account. Returns null for anything unknown. */
export const resolveApiKey = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, { keyHash }) => {
    const row = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
      .unique();
    if (!row) return null;
    return { id: row._id, ownerSubject: row.ownerSubject, lastUsedAt: row.lastUsedAt ?? 0 };
  },
});

/** Refresh `lastUsedAt`, at most once an hour, so the list is useful without
 * writing on every single request. */
export const touchApiKey = internalMutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) return;
    const now = Date.now();
    if (now - (row.lastUsedAt ?? 0) < KEY_TOUCH_INTERVAL_MS) return;
    await ctx.db.patch(id, { lastUsedAt: now });
  },
});
