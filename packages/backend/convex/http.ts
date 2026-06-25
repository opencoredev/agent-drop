import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import {
  LIMITS,
  RETENTION,
  generateEditToken,
  generateSlug,
  isValidCustomSlug,
  scanForSecrets,
  sha256Hex,
} from "./lib";
import { r2 } from "./r2";
import { rateLimiter } from "./rateLimiter";
import { skillMarkdown } from "./skill";

const http = httpRouter();

// Better Auth (sign in / sign up / session) routes.
authComponent.registerRoutes(http, createAuth);

// ---------------------------------------------------------------------------
// Response + request helpers
// ---------------------------------------------------------------------------

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extra },
  });
}

function fail(status: number, message: string, extra: Record<string, string> = {}): Response {
  return json({ error: message }, status, extra);
}

function appBase(): string {
  return process.env.SITE_URL ?? "http://localhost:3001";
}

function siteBase(): string {
  return process.env.CONVEX_SITE_URL ?? "";
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return (match ? match[1]! : header).trim() || null;
}

function retryHeader(retryAfterMs: number | undefined): Record<string, string> {
  return { "Retry-After": String(Math.ceil((retryAfterMs ?? 1000) / 1000)) };
}

/** Parse `/<prefix>/<slug>/<sub>` style paths matched by a pathPrefix route. */
function parsePath(request: Request, prefix: string): { slug: string | null; sub: string | null } {
  const pathname = new URL(request.url).pathname;
  const parts = pathname.slice(prefix.length).split("/").filter(Boolean);
  return {
    slug: parts[0] ? decodeURIComponent(parts[0]) : null,
    sub: parts[1] ? decodeURIComponent(parts[1]) : null,
  };
}

type ParsedContent =
  | { error: string; status: number }
  | {
      kind: "markdown" | "html";
      title: string | undefined;
      bytes: Uint8Array;
      contentType: string;
    };

function parseContent(body: unknown): ParsedContent {
  const b = (body ?? {}) as Record<string, unknown>;
  const kind = b.kind === "html" ? "html" : b.kind === "markdown" ? "markdown" : null;
  if (!kind) return { error: "`kind` must be 'markdown' or 'html'.", status: 400 };
  if (typeof b.content !== "string")
    return { error: "`content` (string) is required.", status: 400 };

  const bytes = new TextEncoder().encode(b.content);
  if (bytes.byteLength === 0) return { error: "`content` is empty.", status: 400 };
  if (bytes.byteLength > LIMITS.maxContentBytes) {
    return { error: `Content exceeds the ${LIMITS.maxContentBytes}-byte limit.`, status: 413 };
  }
  const secret = scanForSecrets(b.content);
  if (secret) {
    return {
      error: `Content looks like it contains a ${secret}. Remove all secrets/credentials and try again.`,
      status: 422,
    };
  }
  const title =
    typeof b.title === "string" ? b.title.slice(0, LIMITS.maxTitleLength) || undefined : undefined;
  const contentType = kind === "html" ? "text/html; charset=utf-8" : "text/markdown; charset=utf-8";
  return { kind, title, bytes, contentType };
}

const VERSION_CACHE = "public, max-age=31536000, immutable";

function versionKey(slug: string, kind: "markdown" | "html"): string {
  return `sites/${slug}/${crypto.randomUUID()}.${kind === "html" ? "html" : "md"}`;
}

async function uniqueSlug(ctx: ActionCtx): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const slug = generateSlug();
    if (!(await ctx.runQuery(internal.sites.slugExists, { slug }))) return slug;
  }
  return generateSlug(10);
}

// ---------------------------------------------------------------------------
// POST /api/v1/sites — deploy a new site
// ---------------------------------------------------------------------------

const createSite = httpAction(async (ctx, request) => {
  const limit = await rateLimiter.limit(ctx, "createSite", { key: clientIp(request) });
  if (!limit.ok) {
    return fail(429, "Rate limit exceeded. Try again later.", retryHeader(limit.retryAfter));
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Request body must be valid JSON.");
  }

  const parsed = parseContent(body);
  if ("error" in parsed) return fail(parsed.status, parsed.error);

  const requested = (body as Record<string, unknown>).slug;
  let slug: string;
  if (typeof requested === "string" && requested.length > 0) {
    const candidate = requested.toLowerCase();
    if (!isValidCustomSlug(candidate)) {
      return fail(400, "Invalid slug. Use 2–40 chars: lowercase letters, digits, and hyphens.");
    }
    if (await ctx.runQuery(internal.sites.slugExists, { slug: candidate })) {
      return fail(409, "That slug is already taken.");
    }
    slug = candidate;
  } else {
    slug = await uniqueSlug(ctx);
  }

  const editToken = generateEditToken();
  const editTokenHash = await sha256Hex(editToken);
  const key = versionKey(slug, parsed.kind);
  await r2.store(ctx, parsed.bytes, { key, type: parsed.contentType, cacheControl: VERSION_CACHE });

  const now = Date.now();
  const expiresAt = now + RETENTION.anonMs;
  try {
    await ctx.runMutation(internal.sites.recordDeploy, {
      slug,
      scope: `site:${slug}`,
      kind: parsed.kind,
      title: parsed.title,
      key,
      contentType: parsed.contentType,
      byteSize: parsed.bytes.byteLength,
      editTokenHash,
      now,
      expiresAt,
    });
  } catch {
    return fail(409, "Slug just became unavailable — please retry.");
  }

  const app = appBase();
  return json(
    {
      slug,
      url: `${app}/${slug}`,
      manageUrl: `${app}/manage/${slug}?t=${editToken}`,
      editToken,
      kind: parsed.kind,
      expiresAt,
      retentionDays: 30,
    },
    201,
  );
});

// ---------------------------------------------------------------------------
// /api/v1/sites/:slug[/...] — read + mutate an existing site
// ---------------------------------------------------------------------------

const SITES_PREFIX = "/api/v1/sites/";

async function requireSite(
  ctx: ActionCtx,
  request: Request,
  slug: string,
): Promise<{ error: Response } | { auth: { siteId: Id<"sites">; slug: string; scope: string } }> {
  const token = bearerToken(request);
  if (!token) {
    return { error: fail(401, "Missing 'Authorization: Bearer <editToken>' header.") };
  }
  const auth = await ctx.runQuery(internal.sites.authBySlug, {
    slug,
    tokenHash: await sha256Hex(token),
  });
  if (!auth) return { error: fail(403, "Invalid edit token for this site.") };
  return { auth };
}

const sitesGet = httpAction(async (ctx, request) => {
  const { slug, sub } = parsePath(request, SITES_PREFIX);
  if (!slug) return fail(404, "Not found.");

  if (sub === "raw") {
    const info = await ctx.runQuery(internal.sites.rawInfoBySlug, { slug });
    if (!info) return fail(404, "Site not found.");
    const upstream = await fetch(await r2.getUrl(info.key, { expiresIn: 600 }));
    if (!upstream.ok || !upstream.body) return fail(502, "Failed to load content.");
    const headers: Record<string, string> = {
      ...CORS,
      "Content-Type": info.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=30",
    };
    if (info.kind === "html") {
      // Defense-in-depth in case the raw URL is opened directly: the response
      // sandboxes itself. The viewer additionally renders it in a sandboxed
      // <iframe> on a separate origin.
      headers["Content-Security-Policy"] =
        "sandbox allow-scripts allow-popups allow-forms allow-modals; base-uri 'none';";
    }
    return new Response(upstream.body, { status: 200, headers });
  }

  if (!sub) {
    const status = await ctx.runQuery(internal.sites.statusBySlug, { slug });
    if (!status) return fail(404, "Site not found.");
    return json(status);
  }

  return fail(404, "Not found.");
});

const sitesPut = httpAction(async (ctx, request) => {
  const { slug, sub } = parsePath(request, SITES_PREFIX);
  if (!slug || sub) return fail(404, "Not found.");

  const gate = await requireSite(ctx, request, slug);
  if ("error" in gate) return gate.error;

  const limit = await rateLimiter.limit(ctx, "updateSite", { key: gate.auth.scope });
  if (!limit.ok) {
    return fail(429, "Rate limit exceeded. Try again later.", retryHeader(limit.retryAfter));
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Request body must be valid JSON.");
  }
  const parsed = parseContent(body);
  if ("error" in parsed) return fail(parsed.status, parsed.error);

  const key = versionKey(slug, parsed.kind);
  await r2.store(ctx, parsed.bytes, { key, type: parsed.contentType, cacheControl: VERSION_CACHE });
  await ctx.runMutation(internal.sites.recordUpdate, {
    slug,
    kind: parsed.kind,
    title: parsed.title,
    key,
    contentType: parsed.contentType,
    byteSize: parsed.bytes.byteLength,
  });
  const status = await ctx.runQuery(internal.sites.statusBySlug, { slug });
  return json({ ok: true, ...status });
});

const sitesPost = httpAction(async (ctx, request) => {
  const { slug, sub } = parsePath(request, SITES_PREFIX);
  if (!slug) return fail(404, "Not found.");

  const gate = await requireSite(ctx, request, slug);
  if ("error" in gate) return gate.error;

  if (sub === "undo") {
    const result = await ctx.runMutation(internal.sites.applyUndo, { slug });
    return json({ ok: true, ...result });
  }
  if (sub === "redo") {
    const result = await ctx.runMutation(internal.sites.applyRedo, { slug });
    return json({ ok: true, ...result });
  }
  if (sub === "images") {
    const limit = await rateLimiter.limit(ctx, "uploadImage", { key: gate.auth.scope });
    if (!limit.ok) {
      return fail(429, "Image upload limit exceeded.", retryHeader(limit.retryAfter));
    }
    const count = await ctx.runQuery(internal.sites.imageCount, { siteId: gate.auth.siteId });
    if (count >= LIMITS.maxImagesPerSite) {
      return fail(409, `This site already has the maximum of ${LIMITS.maxImagesPerSite} images.`);
    }

    let bytes: Uint8Array;
    let contentType: string;
    const ct = request.headers.get("content-type") ?? "";
    if (ct.startsWith("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file") ?? form.get("image");
      if (!(file instanceof Blob))
        return fail(400, "Multipart upload must include a 'file' field.");
      bytes = new Uint8Array(await file.arrayBuffer());
      contentType = file.type || "application/octet-stream";
    } else {
      bytes = new Uint8Array(await request.arrayBuffer());
      contentType = (ct.split(";")[0] || "application/octet-stream").trim();
    }

    if (!contentType.startsWith("image/")) return fail(415, "Only image/* uploads are allowed.");
    if (bytes.byteLength === 0) return fail(400, "Empty upload.");
    if (bytes.byteLength > LIMITS.maxImageBytes) {
      return fail(413, `Image exceeds the ${LIMITS.maxImageBytes}-byte limit.`);
    }

    const ext = (contentType.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8);
    const key = `sites/${slug}/img/${crypto.randomUUID()}.${ext}`;
    await r2.store(ctx, bytes, {
      key,
      type: contentType,
      cacheControl: "public, max-age=604800, immutable",
    });
    const now = Date.now();
    const { imageId } = await ctx.runMutation(internal.sites.recordImage, {
      siteId: gate.auth.siteId,
      slug,
      key,
      contentType,
      byteSize: bytes.byteLength,
      now,
      expiresAt: now + RETENTION.imageMs,
    });
    return json(
      {
        ok: true,
        url: `${siteBase()}/api/v1/assets/${imageId}`,
        expiresAt: now + RETENTION.imageMs,
        retentionDays: 7,
      },
      201,
    );
  }

  return fail(404, "Unknown action.");
});

const sitesDelete = httpAction(async (ctx, request) => {
  const { slug, sub } = parsePath(request, SITES_PREFIX);
  if (!slug || sub) return fail(404, "Not found.");
  const gate = await requireSite(ctx, request, slug);
  if ("error" in gate) return gate.error;
  await ctx.runMutation(internal.sites.purgeBySlug, { slug });
  return json({ ok: true, deleted: slug });
});

// ---------------------------------------------------------------------------
// GET /api/v1/assets/:id — serve an uploaded image
// ---------------------------------------------------------------------------

const ASSETS_PREFIX = "/api/v1/assets/";

const assetGet = httpAction(async (ctx, request) => {
  const id = parsePath(request, ASSETS_PREFIX).slug;
  if (!id) return fail(404, "Not found.");
  const info = await ctx.runQuery(internal.sites.assetInfo, { id });
  if (!info) return fail(404, "Image not found or expired.");
  const upstream = await fetch(await r2.getUrl(info.key, { expiresIn: 600 }));
  if (!upstream.ok || !upstream.body) return fail(502, "Failed to load image.");
  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": info.contentType,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

// ---------------------------------------------------------------------------
// GET /s/:slug — short link that redirects to the viewer
// ---------------------------------------------------------------------------

const shortRedirect = httpAction(async (_ctx, request) => {
  const slug = parsePath(request, "/s/").slug;
  if (!slug) return fail(404, "Not found.");
  return new Response(null, { status: 302, headers: { Location: `${appBase()}/${slug}` } });
});

const skill = httpAction(async () => {
  return new Response(skillMarkdown(siteBase()), {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});

const preflight = httpAction(async () => new Response(null, { status: 204, headers: CORS }));

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------

http.route({ path: "/api/v1/sites", method: "POST", handler: createSite });
http.route({ path: "/api/v1/sites", method: "OPTIONS", handler: preflight });

http.route({ pathPrefix: SITES_PREFIX, method: "GET", handler: sitesGet });
http.route({ pathPrefix: SITES_PREFIX, method: "PUT", handler: sitesPut });
http.route({ pathPrefix: SITES_PREFIX, method: "POST", handler: sitesPost });
http.route({ pathPrefix: SITES_PREFIX, method: "DELETE", handler: sitesDelete });
http.route({ pathPrefix: SITES_PREFIX, method: "OPTIONS", handler: preflight });

http.route({ pathPrefix: ASSETS_PREFIX, method: "GET", handler: assetGet });
http.route({ pathPrefix: ASSETS_PREFIX, method: "OPTIONS", handler: preflight });

http.route({ pathPrefix: "/s/", method: "GET", handler: shortRedirect });

http.route({ path: "/agentdrop-skill.md", method: "GET", handler: skill });
http.route({ path: "/agentdrop-skill.md", method: "OPTIONS", handler: preflight });

export default http;
