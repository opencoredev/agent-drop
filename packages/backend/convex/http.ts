import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import {
  LIMITS,
  RETENTION,
  generateEditToken,
  scanForSecrets,
  sha256Hex,
  verifyViewToken,
} from "./lib";
import { r2 } from "./r2";
import { rateLimiter } from "./rateLimiter";
import { type ToolResult, type ToolRunner, handleMcpMessage, readMcpHeaders } from "./mcp";
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

// MCP mirrors body fields into headers, so browser-based clients need them on
// the allow list, and need to read the ones we echo back.
const MCP_CORS: Record<string, string> = {
  ...CORS,
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Last-Event-ID",
  "Access-Control-Expose-Headers": "MCP-Protocol-Version",
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

/**
 * Best available caller identity for rate limiting.
 *
 * `x-forwarded-for` is a list the client can seed: anything a caller sends ends
 * up at the front, and each proxy appends. Reading the first entry therefore
 * hands the caller a fresh limiter bucket per request. The last entry is the one
 * written by the proxy in front of us, so that is the only value here we did not
 * let the caller choose.
 */
function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const hops = fwd
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const nearest = hops[hops.length - 1];
    if (nearest) return nearest;
  }
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
      visibility: "public" | "private" | undefined;
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

  // Absent means "leave it alone" on update, and "public" on deploy. The skill
  // tells agents to send it explicitly rather than rely on either default.
  const rawVisibility = b.visibility;
  if (rawVisibility !== undefined && rawVisibility !== "public" && rawVisibility !== "private") {
    return { error: "`visibility` must be 'public' or 'private'.", status: 400 };
  }
  return { kind, title, bytes, contentType, visibility: rawVisibility };
}

const VERSION_CACHE = "public, max-age=31536000, immutable";

function versionKey(slug: string, kind: "markdown" | "html"): string {
  return `sites/${slug}/${crypto.randomUUID()}.${kind === "html" ? "html" : "md"}`;
}

async function uniqueSlug(ctx: ActionCtx): Promise<string> {
  // Every site gets an unguessable random UUID. Collisions are astronomically
  // unlikely, but the existence check is cheap insurance.
  for (let i = 0; i < 6; i++) {
    const slug = crypto.randomUUID();
    if (!(await ctx.runQuery(internal.sites.slugExists, { slug }))) return slug;
  }
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Site operations
//
// The REST routes and the MCP tools are two front doors onto the same work, so
// each operation lives here once and returns plain data or `{ error, status }`.
// ---------------------------------------------------------------------------

type OpError = { error: string; status: number };

function isOpError(value: unknown): value is OpError {
  return typeof value === "object" && value !== null && "error" in value;
}

const GONE = { error: "Site not found. It may have expired or been deleted.", status: 404 };
const BAD_TOKEN = { error: "Invalid edit token for this site.", status: 403 };

type SiteAuth = { siteId: Id<"sites">; slug: string; scope: string };
type AuthGate = { error: OpError; auth?: undefined } | { auth: SiteAuth; error?: undefined };

/** Resolve a bearer token to a site, or the error to return for it. */
async function authorize(ctx: ActionCtx, slug: string, token: string | null): Promise<AuthGate> {
  if (!token) return { error: BAD_TOKEN };
  const result = await ctx.runQuery(internal.sites.authBySlug, {
    slug,
    tokenHash: await sha256Hex(token),
  });
  if (!result.ok) return { error: result.reason === "missing" ? GONE : BAD_TOKEN };
  return { auth: result };
}

/**
 * Identify the caller of a deploy.
 *
 * An account key means there is a person behind the request, so the limit is
 * keyed to that account instead of an address, and the page it creates is owned:
 * private by default and kept for the longer window.
 */
async function identify(ctx: ActionCtx, request: Request) {
  const presented = bearerToken(request);
  if (!presented) return null;
  const key = await ctx.runQuery(internal.sites.resolveApiKey, {
    keyHash: await sha256Hex(presented),
  });
  if (!key) return null;
  await ctx.runMutation(internal.sites.touchApiKey, { id: key.id });
  return { ownerSubject: key.ownerSubject };
}

async function opDeploy(
  ctx: ActionCtx,
  rateKey: string,
  body: unknown,
  owner: { ownerSubject: string } | null,
) {
  const limit = owner
    ? await rateLimiter.limit(ctx, "createSiteAuthed", { key: owner.ownerSubject })
    : await rateLimiter.limit(ctx, "createSite", { key: rateKey });
  if (!limit.ok) {
    return {
      error: owner
        ? "Rate limit exceeded for this account. Try again later."
        : "Rate limit exceeded. Sign in and use an account key for a much higher limit.",
      status: 429,
      retry: limit.retryAfter,
    };
  }

  const parsed = parseContent(body);
  if ("error" in parsed) return parsed;

  const slug = await uniqueSlug(ctx);
  const editToken = generateEditToken();
  const editTokenHash = await sha256Hex(editToken);
  const key = versionKey(slug, parsed.kind);
  await r2.store(ctx, parsed.bytes, { key, type: parsed.contentType, cacheControl: VERSION_CACHE });

  const now = Date.now();
  const expiresAt = now + (owner ? RETENTION.ownedMs : RETENTION.anonMs);
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
      ownerSubject: owner?.ownerSubject,
      // A page made with an account key is the caller's own work by default.
      visibility: parsed.visibility ?? (owner ? "private" : "public"),
      now,
      expiresAt,
    });
  } catch {
    return { error: "Slug just became unavailable — please retry.", status: 409 };
  }

  const app = appBase();
  return {
    slug,
    url: `${app}/${slug}`,
    manageUrl: `${app}/manage/${slug}?t=${editToken}`,
    editToken,
    kind: parsed.kind,
    visibility: parsed.visibility ?? (owner ? "private" : "public"),
    owned: owner !== null,
    expiresAt,
    retentionDays: owner ? 90 : 30,
  };
}

async function opUpdate(ctx: ActionCtx, slug: string, token: string | null, body: unknown) {
  const gate = await authorize(ctx, slug, token);
  if ("error" in gate) return gate.error;
  const auth = gate.auth;

  const limit = await rateLimiter.limit(ctx, "updateSite", { key: auth.scope });
  if (!limit.ok) {
    return { error: "Rate limit exceeded. Try again later.", status: 429, retry: limit.retryAfter };
  }

  const parsed = parseContent(body);
  if ("error" in parsed) return parsed;

  const key = versionKey(slug, parsed.kind);
  await r2.store(ctx, parsed.bytes, { key, type: parsed.contentType, cacheControl: VERSION_CACHE });
  await ctx.runMutation(internal.sites.recordUpdate, {
    slug,
    kind: parsed.kind,
    title: parsed.title,
    key,
    contentType: parsed.contentType,
    byteSize: parsed.bytes.byteLength,
    visibility: parsed.visibility,
  });
  return { ok: true, ...(await publicStatus(ctx, slug)) };
}

/** Site status with the token hash stripped, safe to return to a caller. */
async function publicStatus(ctx: ActionCtx, slug: string) {
  const status = await ctx.runQuery(internal.sites.statusBySlug, { slug });
  if (!status) return {};
  const { editTokenHash: _hash, ...visible } = status;
  return visible;
}

async function opHistory(
  ctx: ActionCtx,
  slug: string,
  token: string | null,
  direction: "undo" | "redo",
) {
  const gate = await authorize(ctx, slug, token);
  if ("error" in gate) return gate.error;
  const applied =
    direction === "undo"
      ? await ctx.runMutation(internal.sites.applyUndo, { slug })
      : await ctx.runMutation(internal.sites.applyRedo, { slug });
  return { ok: true, ...applied };
}

async function opStatus(ctx: ActionCtx, slug: string, token: string | null) {
  const status = await ctx.runQuery(internal.sites.statusBySlug, { slug });
  if (!status) return GONE;

  const { editTokenHash, ...visible } = status;
  if (visible.visibility === "private") {
    const holdsEditToken = token !== null && (await sha256Hex(token)) === editTokenHash;
    if (!holdsEditToken) return GONE;
  }
  return visible;
}

async function opDelete(ctx: ActionCtx, slug: string, token: string | null) {
  const gate = await authorize(ctx, slug, token);
  if ("error" in gate) return gate.error;
  await ctx.runMutation(internal.sites.purgeBySlug, { slug });
  return { ok: true, deleted: slug };
}

// ---------------------------------------------------------------------------
// POST /api/v1/sites — deploy a new site
// ---------------------------------------------------------------------------

const createSite = httpAction(async (ctx, request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Request body must be valid JSON.");
  }

  const out = await opDeploy(ctx, clientIp(request), body, await identify(ctx, request));
  if (isOpError(out)) {
    const retry = (out as { retry?: number }).retry;
    return fail(out.status, out.error, retry ? retryHeader(retry) : {});
  }
  return json(out, 201);
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
  const gate = await authorize(ctx, slug, token);
  if (gate.error) return { error: fail(gate.error.status, gate.error.error) };
  return { auth: gate.auth };
}

const sitesGet = httpAction(async (ctx, request) => {
  const { slug, sub } = parsePath(request, SITES_PREFIX);
  if (!slug) return fail(404, "Not found.");

  if (sub === "raw") {
    const info = await ctx.runQuery(internal.sites.rawInfoBySlug, { slug });
    if (!info) return fail(404, "Site not found.");

    if (info.visibility === "private") {
      // Either the caller holds the edit token, or the owner's browser is
      // presenting a capability the ownership-checked query minted for it.
      const token = bearerToken(request);
      const holdsEditToken = token !== null && (await sha256Hex(token)) === info.editTokenHash;
      const viewToken = new URL(request.url).searchParams.get("vt");
      const mayView = holdsEditToken || (await verifyViewToken(slug, info.key, viewToken));
      // Same answer as a page that never existed: the URL must not confirm that
      // a private page is there.
      if (!mayView) return fail(404, "Site not found.");
    }
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
    const status = await opStatus(ctx, slug, bearerToken(request));
    if (isOpError(status)) return fail(status.status, status.error);
    return json(status);
  }

  return fail(404, "Not found.");
});

const sitesPut = httpAction(async (ctx, request) => {
  const { slug, sub } = parsePath(request, SITES_PREFIX);
  if (!slug || sub) return fail(404, "Not found.");

  const token = bearerToken(request);
  if (!token) return fail(401, "Missing 'Authorization: Bearer <editToken>' header.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Request body must be valid JSON.");
  }

  const out = await opUpdate(ctx, slug, token, body);
  if (isOpError(out)) {
    const retry = (out as { retry?: number }).retry;
    return fail(out.status, out.error, retry ? retryHeader(retry) : {});
  }
  return json(out);
});

const sitesPost = httpAction(async (ctx, request) => {
  const { slug, sub } = parsePath(request, SITES_PREFIX);
  if (!slug) return fail(404, "Not found.");

  const gate = await requireSite(ctx, request, slug);
  if ("error" in gate) return gate.error;

  if (sub === "undo" || sub === "redo") {
    const out = await opHistory(ctx, slug, bearerToken(request), sub);
    if (isOpError(out)) return fail(out.status, out.error);
    return json(out);
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
  const token = bearerToken(request);
  if (!token) return fail(401, "Missing 'Authorization: Bearer <editToken>' header.");
  const out = await opDelete(ctx, slug, token);
  if (isOpError(out)) return fail(out.status, out.error);
  return json(out);
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

// ---------------------------------------------------------------------------
// POST /mcp — stateless MCP server (Streamable HTTP)
// ---------------------------------------------------------------------------

function toolText(value: unknown): ToolResult {
  return { text: JSON.stringify(value, null, 2) };
}

function toolFailure(value: OpError): ToolResult {
  return { text: value.error, isError: true };
}

function mcpRunner(
  ctx: ActionCtx,
  request: Request,
  owner: { ownerSubject: string } | null,
): ToolRunner {
  const ip = clientIp(request);

  return async (name, args) => {
    const slug = typeof args.slug === "string" ? args.slug : "";
    const token = typeof args.editToken === "string" ? args.editToken : null;

    switch (name) {
      case "deploy_site": {
        const out = await opDeploy(ctx, ip, args, owner);
        return isOpError(out) ? toolFailure(out) : toolText(out);
      }
      case "update_site": {
        const out = await opUpdate(ctx, slug, token, args);
        return isOpError(out) ? toolFailure(out) : toolText(out);
      }
      case "undo_site":
      case "redo_site": {
        const out = await opHistory(ctx, slug, token, name === "undo_site" ? "undo" : "redo");
        return isOpError(out) ? toolFailure(out) : toolText(out);
      }
      case "get_site": {
        const out = await opStatus(ctx, slug, token);
        return isOpError(out) ? toolFailure(out) : toolText(out);
      }
      case "delete_site": {
        const out = await opDelete(ctx, slug, token);
        return isOpError(out) ? toolFailure(out) : toolText(out);
      }
      default:
        return { text: `Unknown tool: ${name}`, isError: true };
    }
  };
}

const mcpPost = httpAction(async (ctx, request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  // An MCP client can present an account key as a bearer token today; once the
  // OAuth flow lands this is where the access token will resolve instead.
  const owner = await identify(ctx, request);
  const reply = await handleMcpMessage(
    body,
    readMcpHeaders(request),
    mcpRunner(ctx, request, owner),
  );
  if (reply.body === null) return new Response(null, { status: reply.status, headers: MCP_CORS });
  return json(reply.body, reply.status, MCP_CORS);
});

// Sessions and the standalone SSE stream are gone in 2026-07-28, so the only
// verb this endpoint answers is POST.
const mcpGone = httpAction(
  async () =>
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32601, message: "This MCP endpoint is stateless and accepts POST only." },
      }),
      {
        status: 405,
        headers: { "Content-Type": "application/json", Allow: "POST, OPTIONS", ...MCP_CORS },
      },
    ),
);

const preflight = httpAction(async () => new Response(null, { status: 204, headers: CORS }));

const mcpPreflight = httpAction(async () => new Response(null, { status: 204, headers: MCP_CORS }));

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

http.route({ path: "/mcp", method: "POST", handler: mcpPost });
http.route({ path: "/mcp", method: "GET", handler: mcpGone });
http.route({ path: "/mcp", method: "DELETE", handler: mcpGone });
http.route({ path: "/mcp", method: "OPTIONS", handler: mcpPreflight });

export default http;
