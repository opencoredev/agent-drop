/**
 * Static + import-level checks for the production-risk fixes.
 * Run: bun run packages/backend/scripts/verify-audit-fixes.ts
 *
 * These do not need a live Convex deployment; they guard against regressions
 * in the shapes and control-flow contracts the audit plan required.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MINUTE, HOUR, DAY } from "@convex-dev/rate-limiter";

import { LIMITS, RETENTION, scanForSecrets, sha256Hex, siteExpiry } from "../convex/lib";
import { rateLimiter } from "../convex/rateLimiter";

const here = dirname(fileURLToPath(import.meta.url));
const convexDir = join(here, "..", "convex");

function read(name: string): string {
  return readFileSync(join(convexDir, name), "utf8");
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const sites = read("sites.ts");
const http = read("http.ts");
const oauth = read("oauth.ts");
const schema = read("schema.ts");
const rate = read("rateLimiter.ts");

// --- Phase 1/2: retry-safe purge ---
assert(sites.includes("tryDeleteR2"), "tryDeleteR2 helper exists");
assert(sites.includes("drainSite"), "drainSite helper exists");
assert(sites.includes("drainSiteById"), "drainSiteById mutation exists");
assert(sites.includes('return "retry"'), "drain distinguishes retry from more");
assert(sites.includes("scheduleDrain"), "scheduleDrain helper exists");
assert(
  !sites.match(/await r2\.deleteObject[\s\S]{0,80}await ctx\.db\.delete/),
  "no deleteObject-then-unconditional-db-delete adjacency left as the old pattern",
);
// Ledger row delete must follow a successful tryDeleteR2.
assert(
  sites.includes("if (await tryDeleteR2(ctx, row.key)) await ctx.db.delete(row._id)"),
  "object ledger rows deleted only after R2 success",
);
assert(
  sites.includes("if (await tryDeleteR2(ctx, img.key)) await ctx.db.delete(img._id)"),
  "image rows deleted only after R2 success",
);

// --- Phase 3: token-aware private access ---
assert(sites.includes("getBySlugForManager"), "getBySlugForManager query exists");
assert(sites.includes("already claimed by another account"), "claim blocks takeover");

// --- Phase 4: write-path compensate ---
assert(http.includes("discardR2Key"), "discardR2Key helper exists");
assert(http.includes("Failed to record the new site"), "deploy no longer maps all errors to 409");
assert(http.includes("slug-taken"), "deploy still maps real slug conflicts to 409");

// --- Phase 5: oauth + bounds ---
assert(rate.includes("oauthRegister"), "oauthRegister limiter configured");
assert(rate.includes("oauthToken"), "oauthToken limiter configured");
assert(schema.includes('by_owner_updated'), "listMine index exists");
assert(sites.includes("LIMITS.maxImagesPerSite + 1"), "imageCount is bounded");
assert(sites.includes("LIST_MINE_LIMIT"), "listMine is bounded");
assert(oauth.includes('withIndex("by_expiresAt"'), "oauth code cleanup uses expiresAt index");
assert(oauth.includes("cleanupExpiredGrants"), "oauth cleanup still exported");
assert(
  /oauthCodes:[\s\S]*?index\("by_expiresAt"/.test(schema),
  "oauthCodes table has by_expiresAt index",
);

// --- Runtime imports ---
assert(MINUTE === 60_000 && HOUR > MINUTE && DAY > HOUR, "rate-limiter time constants import");
assert(typeof rateLimiter.limit === "function", "rateLimiter instance is usable");
assert(LIMITS.maxImagesPerSite === 10, "image cap unchanged");
assert(RETENTION.anonMs < RETENTION.ownedMs, "retention windows ordered");
assert(siteExpiry(1_000, false) - 1_000 === RETENTION.anonMs, "anon expiry helper");
assert(siteExpiry(1_000, true) - 1_000 === RETENTION.ownedMs, "owned expiry helper");
assert(scanForSecrets("hello") === null, "clean content passes secret scan");
assert(
  scanForSecrets("-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----") ===
    "private key block",
  "secret scan hits",
);

const hash = await sha256Hex("token");
assert(/^[a-f0-9]{64}$/.test(hash), "sha256Hex returns 64 hex chars");

console.log("All audit-fix verification checks passed.");
