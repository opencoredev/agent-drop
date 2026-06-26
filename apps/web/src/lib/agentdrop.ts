import { env } from "@agent-drop/env/web";

/** Base URL of the AgentDrop HTTP API (the Convex `.site` domain). */
export const API_BASE = env.VITE_CONVEX_SITE_URL;

/** Canonical URL of the distributable agent skill (served by the backend). */
export const SKILL_URL = `${API_BASE}/agentdrop-skill.md`;

/** Origin of the web app, used to build viewer/manage links shown to humans. */
export function appOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export type SiteActionResult = {
  ok?: boolean;
  changed?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  version?: number | null;
  versions?: number;
};

async function tokenRequest(
  path: string,
  token: string,
  method: string,
): Promise<SiteActionResult> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json().catch(() => ({}))) as SiteActionResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export const undoSite = (slug: string, token: string) =>
  tokenRequest(`/api/v1/sites/${encodeURIComponent(slug)}/undo`, token, "POST");

export const redoSite = (slug: string, token: string) =>
  tokenRequest(`/api/v1/sites/${encodeURIComponent(slug)}/redo`, token, "POST");

export const deleteSite = (slug: string, token: string) =>
  tokenRequest(`/api/v1/sites/${encodeURIComponent(slug)}`, token, "DELETE");

/** The copy-paste prompt a user hands to their coding agent to get set up. The
 * agent first asks which tool(s) to install into, then installs there. */
export function buildAgentPrompt(): string {
  return `Set up AgentDrop so you can publish static sites for me.

1. Ask me which coding tool to set this up for — Codex, Claude Code, Cursor, Windsurf, or another agent (I can pick more than one).
2. For each tool I choose, save the skill from ${SKILL_URL} into its skills directory as SKILL.md:
   - Codex: ~/.codex/skills/agentdrop/SKILL.md
   - Claude Code: ~/.claude/skills/agentdrop/SKILL.md
   - Cursor: ~/.cursor/skills/agentdrop/SKILL.md
   - Anything else: that tool's skills folder (or wherever it loads skills from)
3. Add this line to that tool's global config (AGENTS.md / CLAUDE.md / etc.):
   "To publish or update a static site (Markdown or HTML), use the AgentDrop skill. Never put secrets, API keys, tokens, or environment variables in site content."

Once it's installed, deploy a live, shareable site with a single API call to ${API_BASE}/api/v1/sites and give me back the URL.`;
}

/** A minimal curl example shown on the landing page + Get started dialog. */
export function buildCurlExample(): string {
  return `curl -X POST ${API_BASE}/api/v1/sites \\
  -H "Content-Type: application/json" \\
  -d '{
    "kind": "markdown",
    "title": "Release notes",
    "content": "# Hello from my agent\\n\\nDeployed with one API call."
  }'
# → { "url": "...", "manageUrl": "...", "editToken": "..." }`;
}
