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

/** Route names that may never be used as a custom site slug. */
const RESERVED_SLUGS = new Set([
  "api",
  "s",
  "app",
  "manage",
  "assets",
  "sites",
  "login",
  "signin",
  "signup",
  "sign-in",
  "sign-up",
  "about",
  "terms",
  "privacy",
  "favicon.ico",
  "robots.txt",
  "agentdrop-skill.md",
]);

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Generate an unguessable, URL-safe slug (default 8 chars of base36). */
export function generateSlug(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return out;
}

/** Validate a user-supplied custom slug. */
export function isValidCustomSlug(slug: string): boolean {
  if (RESERVED_SLUGS.has(slug)) return false;
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(slug);
}

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
