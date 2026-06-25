# AgentDrop

> Give your agents a simple way to host static sites.

AgentDrop turns a single HTTP call into a live, shareable URL — Markdown or HTML —
that is **versioned, undoable, real-time, and requires no account**. It's built for
AI coding agents: install one skill, and your agent can publish and update sites on
its own.

Built on a Turborepo monorepo with TanStack Start, Convex, and COSS UI. Site content
lives in **Cloudflare R2** (via the `@convex-dev/r2` component), version history /
undo is handled by `convex-timeline`, and abuse protection by `@convex-dev/rate-limiter`.

## Quickstart (for your agent)

```bash
curl -X POST https://<your-convex-site>/api/v1/sites \
  -H "Content-Type: application/json" \
  -d '{"kind":"markdown","title":"Hello","content":"# Hi from my agent"}'
# → { "url": "...", "manageUrl": "...", "editToken": "..." }
```

Save the `editToken` to update/undo/delete later. Point your agent at the hosted
skill (`<your-convex-site>/agentdrop-skill.md`) and it handles the rest.

## How it works

```
agent ── POST /api/v1/sites ──▶ Convex httpAction
                                  ├─ store content blob in R2  (@convex-dev/r2)
                                  ├─ push a version snapshot   (convex-timeline)
                                  └─ upsert `sites` row (currentKey, editTokenHash, expiresAt)
viewer ── useQuery(getBySlug) ──▶ reactive metadata + content URL
                                  └─ re-renders instantly on any deploy / update / undo
```

- **No site storage in Convex.** Convex holds only metadata + R2 keys; blobs + images live in R2.
- **No account by default.** Deploy returns a secret `editToken` (stored only as a SHA-256 hash) that authorizes updates/undo/delete.
- **Retention.** Anonymous sites: 30 days. Signed-in (claimed) sites: 90 days. Images: 7 days. A daily cron purges expired R2 objects + rows + timeline scopes.
- **Security.** Content is scanned for obvious credentials; untrusted HTML is served from the Convex `.site` origin with a `sandbox` CSP and rendered inside a `sandbox="allow-scripts"` iframe.

## The API

| Method & path                             | Auth   | Purpose                                               |
| ----------------------------------------- | ------ | ----------------------------------------------------- |
| `POST /api/v1/sites`                      | —      | Deploy a site → `{ slug, url, manageUrl, editToken }` |
| `PUT /api/v1/sites/:slug`                 | Bearer | Replace content (keeps history)                       |
| `POST /api/v1/sites/:slug/undo` · `/redo` | Bearer | Step through history                                  |
| `GET /api/v1/sites/:slug`                 | —      | Status (`canUndo`/`canRedo`/version)                  |
| `GET /api/v1/sites/:slug/raw`             | —      | Raw content                                           |
| `POST /api/v1/sites/:slug/images`         | Bearer | Upload an image (≤5 MB, ≤10/site)                     |
| `DELETE /api/v1/sites/:slug`              | Bearer | Delete the site                                       |
| `GET /agentdrop-skill.md`                 | —      | The distributable agent skill                         |

The agent-facing reference is served live at `<convex-site>/agentdrop-skill.md`.

## Project structure

```
agent-drop/
├── apps/
│   ├── web/         # TanStack Start front end (landing, viewer, manage, auth)
│   └── fumadocs/    # Docs app (unchanged)
├── packages/
│   ├── ui/          # COSS UI primitives (Base UI) + shared styles
│   └── backend/     # Convex: schema, sites functions, HTTP API, R2/timeline/rate-limiter, crons
```

## Setup

```bash
bun install
```

### 1. Convex

```bash
bun run dev:setup   # log in, create the "agent-drop" project, codegen
```

### 2. Cloudflare R2

```bash
wrangler r2 bucket create agent-drop
```

Create an R2 API token (dashboard → R2 → Manage R2 API Tokens → Object Read & Write),
then set the Convex environment variables:

```bash
cd packages/backend
bunx convex env set R2_BUCKET agent-drop
bunx convex env set R2_ENDPOINT https://<ACCOUNT_ID>.r2.cloudflarestorage.com
bunx convex env set R2_ACCESS_KEY_ID <ACCESS_KEY_ID>
bunx convex env set R2_SECRET_ACCESS_KEY <SECRET_ACCESS_KEY>
bunx convex env set R2_TOKEN <TOKEN_VALUE>
bunx convex env set SITE_URL http://localhost:3001
bunx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
```

Copy `VITE_CONVEX_URL` / `VITE_CONVEX_SITE_URL` from `packages/backend/.env.local` into `apps/web/.env`.

### 3. Run

```bash
bun run dev          # web on http://localhost:3001 + convex dev
```

## Scripts

- `bun run dev` — all apps in dev
- `bun run dev:web` / `bun run dev:server` — web / Convex only
- `bun run check-types` — typecheck all packages
- `bun run check` — Oxlint + Oxfmt
