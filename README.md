<p align="center">
  <img alt="AgentDrop" src="./apps/web/public/favicon.svg" width="64" height="64" />
</p>

<h1 align="center">AgentDrop</h1>

<p align="center">
  <a href="https://www.agent-drop.co"><img alt="agent-drop.co" src="https://shieldcn.dev/badge/agent-drop.co.svg?variant=secondary&mode=dark" /></a>
  <a href="https://github.com/opencoredev/agent-drop/stargazers"><img alt="GitHub stars" src="https://shieldcn.dev/github/opencoredev/agent-drop/stars.svg?variant=branded&mode=dark" /></a>
  <a href="https://x.com/leodev"><img alt="Follow @leodev on X" src="https://shieldcn.dev/x/follow/leodev.svg?variant=branded&mode=dark" /></a>
</p>

One HTTP call turns Markdown or HTML into a live, versioned URL. Connect over MCP or install one skill. No account, no API key, no build step.

- One document in, one URL out, with undo and live updates to open viewers
- Private by default with an account. `public`, `unlisted`, `team`, or `private`, plus an optional reader password
- Share by email. Invite a team and every member sees the same pages
- Stateless MCP (`2026-07-28`): no session, no SSE stream, no `initialize` handshake
- OAuth 2.1 on the MCP endpoint. The consent screen still offers a path with no account
- Pages expire on purpose: 30 days anonymous, 90 claimed, images always 7

## Install

```bash
npx skills add opencoredev/agent-drop
```

That writes the AgentDrop skill into the agents you pick. The same file is served live at [`/agentdrop-skill.md`](https://abundant-poodle-82.convex.site/agentdrop-skill.md).

## Usage

```bash
curl -X POST https://abundant-poodle-82.convex.site/api/v1/sites \
  -H "Content-Type: application/json" \
  -d '{"kind":"markdown","title":"Hello","content":"# Hi from my agent"}'
```

The response is a `url`, a `manageUrl`, and an `editToken`. Save the token. You need it to update, undo, or delete the page.

Omit `visibility` unless the user asked. An anonymous page becomes `unlisted` so the link opens. A signed-in page becomes `private`. Send `public` only after they said the page may be world-readable.

## MCP

```bash
claude mcp add --transport http agentdrop https://abundant-poodle-82.convex.site/mcp
codex mcp add agentdrop --url https://abundant-poodle-82.convex.site/mcp
gemini mcp add --transport http agentdrop https://abundant-poodle-82.convex.site/mcp
code --add-mcp '{"name":"agentdrop","type":"http","url":"https://abundant-poodle-82.convex.site/mcp"}'
```

Cursor (`~/.cursor/mcp.json`):

```json
{ "mcpServers": { "agentdrop": { "url": "https://abundant-poodle-82.convex.site/mcp" } } }
```

The endpoint requires authorization. An account is optional: the consent screen offers both, and "continue without an account" still issues a token. Tools: `deploy_site`, `update_site`, `undo_site`, `redo_site`, `get_site`, `delete_site`.

## API

| Method | Purpose |
| --- | --- |
| `POST /api/v1/sites` | Deploy → `{ slug, url, manageUrl, editToken }` |
| `PUT /api/v1/sites/:slug` | Replace content, keep history |
| `POST /api/v1/sites/:slug/undo` · `/redo` | Step through history |
| `GET /api/v1/sites/:slug` | Status |
| `GET /api/v1/sites/:slug/raw` | Raw content |
| `POST /api/v1/sites/:slug/images` | Upload an image (≤5 MB, ≤10/site) |
| `DELETE /api/v1/sites/:slug` | Delete the site |

Bearer auth is the `editToken`. Full field notes live in the [skill](https://abundant-poodle-82.convex.site/agentdrop-skill.md). The product is at **[agent-drop.co](https://www.agent-drop.co)**.

## Self-host

```bash
bun install
bun run dev:setup
bun run dev
```

Convex holds metadata. Page bodies and images live in Cloudflare R2. Deploy with `bun run deploy` so the backend goes out before the web app. Setup, env vars, and the deploy order are in [docs/self-host.md](./docs/self-host.md).

## Star History

<p align="center">
  <a href="https://github.com/opencoredev/agent-drop/stargazers"><img alt="Star history" src="https://shieldcn.dev/chart/github/stars/opencoredev/agent-drop.svg?mode=dark" /></a>
</p>

<p align="center"><sub><a href="./LICENSE">MIT License</a> · Built by <a href="https://x.com/leodev">@leodev</a></sub></p>
