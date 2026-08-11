// Shared helpers for the AgentDrop backend: limits, retention, slug/token
// generation, and best-effort secret scanning. Pure utilities only — no Convex
// function definitions live here.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Retention windows, measured from a site's last update. */
export const RETENTION = {
  anonMs: 30 * DAY_MS,
  ownedMs: 90 * DAY_MS,
  imageMs: 7 * DAY_MS,
} as const;

/** Hard caps applied at the API boundary. */
export const LIMITS = {
  maxContentBytes: 1024 * 1024, // 1 MB of markdown/HTML
  maxImageBytes: 5 * 1024 * 1024, // 5 MB per image
  maxImagesPerSite: 10,
  maxTitleLength: 200,
} as const;

/** Generate a 32-byte secret edit token as a hex string. */
export function generateEditToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex digest using the Web Crypto API (available in the Convex runtime). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// View capabilities for private pages
//
// A private page is served from the same public raw endpoint as everything else,
// so the owner's browser needs something to present. It has a session with the
// app, not with the Convex `.site` origin, and a signed R2 URL would fail CORS
// on the Markdown fetch. So the query that already proved ownership mints a
// short-lived capability bound to one slug and one content key.
// ---------------------------------------------------------------------------

const VIEW_TOKEN_TTL_MS = 15 * 60 * 1000;

async function viewKey(): Promise<CryptoKey> {
  // Derived rather than reused directly, so this capability cannot be swapped
  // with anything else signed by the auth secret.
  const material = await sha256Hex(`agentdrop/view/${process.env.BETTER_AUTH_SECRET ?? ""}`);
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(material),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function viewSignature(slug: string, key: string, expiresAt: number): Promise<string> {
  const mac = await crypto.subtle.sign(
    "HMAC",
    await viewKey(),
    new TextEncoder().encode(`${slug}\n${key}\n${expiresAt}`),
  );
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Mint `<expiresAt>.<hmac>` authorizing one private page's current content. */
export async function mintViewToken(slug: string, key: string, now: number): Promise<string> {
  const expiresAt = now + VIEW_TOKEN_TTL_MS;
  return `${expiresAt}.${await viewSignature(slug, key, expiresAt)}`;
}

/** Constant-time-ish check of a view token against a slug + content key. */
export async function verifyViewToken(
  slug: string,
  key: string,
  token: string | null,
): Promise<boolean> {
  if (!token) return false;
  const [rawExpiry, provided] = token.split(".");
  const expiresAt = Number(rawExpiry);
  if (!provided || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const expected = await viewSignature(slug, key, expiresAt);
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

// High-confidence credential formats. We only reject on these to avoid blocking
// legitimate content; the agent skill is the primary line of defense.
const SECRET_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: "private key block", re: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
  { label: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "OpenAI API key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { label: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { label: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { label: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { label: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { label: "Stripe secret key", re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/ },
];

/**
 * Best-effort scan for embedded credentials. Returns a short label describing
 * the first match, or `null` if the content looks clean.
 */
export function scanForSecrets(content: string): string | null {
  for (const { label, re } of SECRET_PATTERNS) {
    if (re.test(content)) return label;
  }
  return null;
}

/** Compute a site's `expiresAt` given whether it is owned (claimed) by a user. */
export function siteExpiry(now: number, owned: boolean): number {
  return now + (owned ? RETENTION.ownedMs : RETENTION.anonMs);
}
