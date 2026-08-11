import { env } from "@agent-drop/env/web";

/** Base URL of the AgentDrop HTTP API (the Convex `.site` domain). */
export const API_BASE = env.VITE_CONVEX_SITE_URL;

/** Canonical URL of the distributable agent skill (served by the backend). */
export const SKILL_URL = `${API_BASE}/agentdrop-skill.md`;

/** The repo that skills.sh installs from. */
export const SKILL_REPO = "opencoredev/agent-drop";

/** Source, since the whole thing is open source. */
export const REPO_URL = `https://github.com/${SKILL_REPO}`;

/** How long a page lives. Stated in one place so the site never contradicts the
 * API about when something gets deleted. */
export const RETENTION = {
  anonymousDays: 30,
  claimedDays: 90,
  imageDays: 7,
} as const;

/** One-line install, handled by the skills CLI (skills.sh). */
export const INSTALL_COMMAND = `npx skills add ${SKILL_REPO}`;

/** Stateless MCP endpoint (Streamable HTTP). Paste into any MCP client. */
export const MCP_URL = `${API_BASE}/mcp`;

/** What most MCP clients want pasted into their config file. */
export function buildMcpConfig(): string {
  return JSON.stringify({ mcpServers: { agentdrop: { url: MCP_URL } } }, null, 2);
}

export type McpTarget = {
  id: string;
  name: string;
  /** Brand mark under /logos. `dark` is the light-ink version for dark mode. */
  logo: { light: string; dark?: string };
  /** A one-line command, or the config file to edit when the tool has no CLI. */
  install: { kind: "command"; value: string } | { kind: "config"; path: string; value: string };
};

/** How to point each agent at the MCP endpoint. Commands are taken from each
 * tool's own CLI help or docs, not guessed. */
export const MCP_TARGETS: McpTarget[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    logo: { light: "/logos/claude.svg" },
    install: { kind: "command", value: `claude mcp add --transport http agentdrop ${MCP_URL}` },
  },
  {
    id: "codex",
    name: "Codex",
    logo: { light: "/logos/openai-light.svg", dark: "/logos/openai-dark.svg" },
    install: { kind: "command", value: `codex mcp add agentdrop --url ${MCP_URL}` },
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    logo: { light: "/logos/gemini.svg" },
    install: { kind: "command", value: `gemini mcp add --transport http agentdrop ${MCP_URL}` },
  },
  {
    id: "copilot",
    name: "VS Code",
    logo: { light: "/logos/vscode.svg" },
    install: {
      kind: "command",
      value: `code --add-mcp '{"name":"agentdrop","type":"http","url":"${MCP_URL}"}'`,
    },
  },
  {
    id: "cursor",
    name: "Cursor",
    logo: { light: "/logos/cursor-light.svg", dark: "/logos/cursor-dark.svg" },
    install: {
      kind: "config",
      path: "~/.cursor/mcp.json",
      value: JSON.stringify({ mcpServers: { agentdrop: { url: MCP_URL } } }, null, 2),
    },
  },
  {
    id: "opencode",
    name: "opencode",
    logo: { light: "/logos/opencode-light.svg", dark: "/logos/opencode-dark.svg" },
    install: {
      kind: "config",
      path: "opencode.json",
      value: JSON.stringify(
        { mcp: { agentdrop: { type: "remote", url: MCP_URL, enabled: true } } },
        null,
        2,
      ),
    },
  },
];

/** A prompt that proves the whole thing works in one go: install, publish a
 * real page, hand back the link. */
export function buildDemoPrompt(): string {
  return `Install agentdrop and show me it works.

1. Run: ${INSTALL_COMMAND}
2. Build a single-page HTML summary of what this project does, with real content, not lorem ipsum.
3. Publish it with agentdrop and give me the URL and the manage link.
4. Keep the editToken so you can update the page when I ask.`;
}

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

/** Fallback for anyone who cannot run the skills CLI: paste this into the agent
 * and it fetches the same skill by hand. */
export function buildAgentPrompt(): string {
  return `Install the agentdrop skill for yourself.

Run: ${INSTALL_COMMAND}

If that command is not available, save ${SKILL_URL} into your skills directory as agentdrop/SKILL.md instead.

Then publish a test page with it and give me the URL.`;
}

/** The one call the whole product is built around, shown on the landing page. */
export function buildCurlExample(): string {
  return `curl -X POST ${API_BASE}/api/v1/sites \\
  -H "Content-Type: application/json" \\
  -d '{ "kind": "markdown", "content": "# Hello" }'`;
}
