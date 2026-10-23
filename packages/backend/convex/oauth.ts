// OAuth 2.1 for the MCP endpoint.
//
// An MCP client cannot be handed a secret out of band, so the protocol expects
// the server to advertise an authorization server and let the client register
// itself, run a browser flow, and come back with an access token. We play both
// roles: this deployment is the authorization server, and `/mcp` is the
// protected resource.
//
// Public clients only, so PKCE is mandatory rather than a client secret. Codes
// and tokens are stored as SHA-256 hashes, exactly like site edit tokens: a leak
// of the table must not hand anyone a working credential.
//
// Spec: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { generateEditToken, sha256Hex } from "./lib";

const CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const SCOPE = "sites:write";

/** base64url of a SHA-256 digest, the `S256` PKCE challenge format. */
export async function s256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * A redirect URI must match one the client registered, exactly. Anything looser
 * turns the authorization endpoint into an open redirector that leaks codes.
 */
export function redirectAllowed(registered: readonly string[], candidate: string): boolean {
  return registered.includes(candidate);
}

/** Loopback redirects are how local MCP clients receive the code. */
export function isAllowedRedirectShape(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:")
      return url.hostname === "127.0.0.1" || url.hostname === "localhost";
    // Custom schemes are how desktop apps get called back.
    return /^[a-z][a-z0-9+.-]*:$/i.test(url.protocol);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Client registration
// ---------------------------------------------------------------------------

export const registerClient = internalMutation({
  args: {
    clientName: v.string(),
    redirectUris: v.array(v.string()),
  },
  handler: async (ctx, { clientName, redirectUris }) => {
    const clientId = `adc_${generateEditToken().slice(0, 32)}`;
    await ctx.db.insert("oauthClients", {
      clientId,
      clientName: clientName.slice(0, 120) || "MCP client",
      redirectUris,
      createdAt: Date.now(),
    });
    return { clientId };
  },
});

export const getClient = internalQuery({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    const client = await ctx.db
      .query("oauthClients")
      .withIndex("by_client_id", (q) => q.eq("clientId", clientId))
      .unique();
    if (!client) return null;
    return {
      clientId: client.clientId,
      clientName: client.clientName,
      redirectUris: client.redirectUris,
    };
  },
});

// ---------------------------------------------------------------------------
// Authorization codes
// ---------------------------------------------------------------------------

export const issueCode = internalMutation({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    subject: v.string(),
    anonymous: v.boolean(),
    resource: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const code = generateEditToken();
    await ctx.db.insert("oauthCodes", {
      codeHash: await sha256Hex(code),
      clientId: a.clientId,
      redirectUri: a.redirectUri,
      codeChallenge: a.codeChallenge,
      subject: a.subject,
      anonymous: a.anonymous,
      resource: a.resource,
      expiresAt: Date.now() + CODE_TTL_MS,
    });
    return { code };
  },
});

/** Redeem a code exactly once, returning the identity it was issued for. */
export const redeemCode = internalMutation({
  args: { codeHash: v.string(), clientId: v.string(), redirectUri: v.string() },
  handler: async (ctx, { codeHash, clientId, redirectUri }) => {
    const row = await ctx.db
      .query("oauthCodes")
      .withIndex("by_hash", (q) => q.eq("codeHash", codeHash))
      .unique();
    if (!row) return { error: "invalid_grant" as const };

    // Burn it first: a replay must fail even if a later check throws.
    await ctx.db.delete(row._id);

    if (row.expiresAt <= Date.now()) return { error: "invalid_grant" as const };
    if (row.clientId !== clientId) return { error: "invalid_grant" as const };
    if (row.redirectUri !== redirectUri) return { error: "invalid_grant" as const };

    return {
      codeChallenge: row.codeChallenge,
      subject: row.subject,
      anonymous: row.anonymous,
      resource: row.resource,
    };
  },
});

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export const issueTokens = internalMutation({
  args: {
    clientId: v.string(),
    subject: v.string(),
    anonymous: v.boolean(),
    audience: v.string(),
  },
  handler: async (ctx, a) => {
    const accessToken = `adt_${generateEditToken()}`;
    const refreshToken = `adr_${generateEditToken()}`;
    const now = Date.now();

    await ctx.db.insert("oauthTokens", {
      tokenHash: await sha256Hex(accessToken),
      kind: "access",
      clientId: a.clientId,
      subject: a.subject,
      anonymous: a.anonymous,
      audience: a.audience,
      expiresAt: now + ACCESS_TTL_MS,
    });
    await ctx.db.insert("oauthTokens", {
      tokenHash: await sha256Hex(refreshToken),
      kind: "refresh",
      clientId: a.clientId,
      subject: a.subject,
      anonymous: a.anonymous,
      audience: a.audience,
      expiresAt: now + REFRESH_TTL_MS,
    });

    return { accessToken, refreshToken, expiresIn: Math.floor(ACCESS_TTL_MS / 1000) };
  },
});

/** Resolve a presented access token. Audience is checked by the caller. */
export const resolveToken = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const row = await ctx.db
      .query("oauthTokens")
      .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!row || row.expiresAt <= Date.now()) return null;
    return {
      kind: row.kind,
      clientId: row.clientId,
      subject: row.subject,
      anonymous: row.anonymous,
      audience: row.audience,
    };
  },
});

/** Spend a refresh token, which is single use: the new pair replaces it. */
export const consumeRefreshToken = internalMutation({
  args: { tokenHash: v.string(), clientId: v.string() },
  handler: async (ctx, { tokenHash, clientId }) => {
    const row = await ctx.db
      .query("oauthTokens")
      .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!row || row.kind !== "refresh") return { error: "invalid_grant" as const };
    await ctx.db.delete(row._id);
    if (row.expiresAt <= Date.now() || row.clientId !== clientId) {
      return { error: "invalid_grant" as const };
    }
    return { subject: row.subject, anonymous: row.anonymous, audience: row.audience };
  },
});

/** Drop expired codes and tokens. Called by the daily cron; self-schedules
 * while a batch is full so a busy day cannot leave a permanent backlog. */
export const cleanupExpiredGrants = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const TOKEN_BATCH = 200;
    const CODE_BATCH = 200;
    let saturated = false;

    const tokens = await ctx.db
      .query("oauthTokens")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(TOKEN_BATCH);
    for (const row of tokens) await ctx.db.delete(row._id);
    if (tokens.length === TOKEN_BATCH) saturated = true;

    const codes = await ctx.db
      .query("oauthCodes")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(CODE_BATCH);
    for (const row of codes) await ctx.db.delete(row._id);
    if (codes.length === CODE_BATCH) saturated = true;

    if (saturated) {
      await ctx.scheduler.runAfter(0, internal.oauth.cleanupExpiredGrants, {});
    }

    return { tokens: tokens.length, codes: codes.length, saturated };
  },
});

// ---------------------------------------------------------------------------
// Consent, driven by the web app's /oauth/authorize page
// ---------------------------------------------------------------------------

/** What the consent screen needs to render, plus whether the request is sane. */
export const describeAuthorization = query({
  args: { clientId: v.string(), redirectUri: v.string() },
  handler: async (ctx, { clientId, redirectUri }) => {
    const client = await ctx.db
      .query("oauthClients")
      .withIndex("by_client_id", (q) => q.eq("clientId", clientId))
      .unique();
    if (!client) return { ok: false as const, reason: "unknown_client" as const };
    if (!client.redirectUris.includes(redirectUri)) {
      return { ok: false as const, reason: "bad_redirect" as const };
    }
    const user = await authComponent.safeGetAuthUser(ctx);
    return {
      ok: true as const,
      clientName: client.clientName,
      signedInAs: user?.email ?? null,
    };
  },
});

/**
 * Approve a pending authorization and mint the code the client will exchange.
 *
 * `useAccount` decides which of the two offers the person picked: tie this
 * client to their account, or stay anonymous and keep the temporary defaults.
 */
export const approveAuthorization = mutation({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    resource: v.optional(v.string()),
    useAccount: v.boolean(),
  },
  handler: async (ctx, a) => {
    const client = await ctx.db
      .query("oauthClients")
      .withIndex("by_client_id", (q) => q.eq("clientId", a.clientId))
      .unique();
    if (!client) throw new Error("Unknown client.");
    if (!client.redirectUris.includes(a.redirectUri)) throw new Error("Redirect URI mismatch.");
    if (!a.codeChallenge) throw new Error("This client did not send a PKCE challenge.");

    let subject: string;
    let anonymous: boolean;
    if (a.useAccount) {
      const user = await authComponent.safeGetAuthUser(ctx);
      if (!user) throw new Error("Sign in first to connect this to your account.");
      subject = user._id;
      anonymous = false;
    } else {
      // A stable id so this connection can still be metered, with none of an
      // account's privileges attached to it.
      subject = `anon_${generateEditToken().slice(0, 24)}`;
      anonymous = true;
    }

    const code = generateEditToken();
    await ctx.db.insert("oauthCodes", {
      codeHash: await sha256Hex(code),
      clientId: a.clientId,
      redirectUri: a.redirectUri,
      codeChallenge: a.codeChallenge,
      subject,
      anonymous,
      resource: a.resource,
      expiresAt: Date.now() + CODE_TTL_MS,
    });
    return { code };
  },
});
