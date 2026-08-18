# Self-host AgentDrop

This page covers a local or self-hosted copy. The hosted product is [agent-drop.co](https://www.agent-drop.co).

```bash
bun install
```

## 1. Convex

```bash
bun run dev:setup   # log in, create the "agent-drop" project, codegen
```

## 2. Cloudflare R2

```bash
wrangler r2 bucket create agent-drop
```

Create an R2 API token (dashboard → R2 → Manage R2 API Tokens → Object Read & Write), then set the Convex environment variables:

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

Convex holds metadata and R2 keys. Blobs and images live in R2. A daily cron deletes expired objects, rows, and timeline scopes.

## 3. Email (Sequenzy)

Sharing a page or inviting a teammate sends one transactional message through Sequenzy, via `@opencoredev/email-sdk`. Without a key the app still writes the share and the link still works. Only the notification is skipped.

```bash
bunx convex env set SEQUENZY_API_KEY seq_live_...
bunx convex env set EMAIL_FROM "Agent-drop <hello@agent-drop.sequenzymail.com>"
bunx convex env set EMAIL_REPLY_TO you@your-domain.com   # optional
```

Use a company-scoped key with the `transactional_sender` preset, not a personal full-access key. The `EMAIL_FROM` address must belong to a sending domain that is verified in Sequenzy, otherwise every send is rejected.

Bodies are built in `convex/emailTemplates.ts` and sent as finished HTML. Do not use Sequenzy saved templates: a page title comes from whoever published the page, and interpolating it provider-side would put an untrusted string back into markup. Sequenzy's transactional endpoint takes no custom headers, so the opt-out is the visible footer link rather than a `List-Unsubscribe` header.

## 4. Run

```bash
bun run dev          # web on http://localhost:3001 + convex dev
bun run test         # backend unit tests
```

After you change `packages/backend/convex/skill.ts`, or when you point at a new deployment:

```bash
bun run skill:sync                                        # uses CONVEX_SITE_URL
AGENTDROP_API_BASE=https://prod.convex.site bun run skill:sync
```

## Deploy

```bash
bun run deploy          # Convex first, then the web app
```

Deploy the backend before the frontend. Use this script rather than deploying from the Vercel dashboard alone. `apps/web/vercel.json` sets its own `buildCommand`, which overrides the project's dashboard build command, so a web deploy does not push Convex. Deploying only the web app leaves the API on the previous release. (`vercel.json` rejects unknown keys, including comment keys, so that warning lives here.)

## Scripts

- `bun run dev` — all apps in dev
- `bun run dev:web` / `bun run dev:server` — web / Convex only
- `bun run check-types` — typecheck all packages
- `bun run check` — Oxlint + Oxfmt
- `bun run deploy` — Convex, then the web app

## Layout

```
agent-drop/
├── apps/
│   └── web/         # TanStack Start front end (landing, viewer, manage, auth)
├── packages/
│   ├── ui/          # COSS UI primitives (Base UI) + shared styles
│   └── backend/     # Convex: schema, sites functions, HTTP API, R2/timeline/rate-limiter, crons
```
