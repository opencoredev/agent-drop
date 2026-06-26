// The distributable AgentDrop skill, served as Markdown from an HTTP route with
// the live API base URL injected.

export function skillMarkdown(base: string): string {
  return `---
name: agentdrop
description: >-
  Publish and update static sites (Markdown or HTML) by calling the AgentDrop HTTP API.
  Use whenever the user asks to host, publish, share, or deploy a page, doc, report,
  landing page, or HTML/Markdown site and get back a public URL.
---

# AgentDrop

Deploy a static site (Markdown or HTML) with one HTTP call and get back a public,
real-time, undoable URL. No SDK, no API key, no account required.

**API base:** \`${base}\`

## How to deploy — it is just an HTTP call (there is NO CLI)

AgentDrop is **only an HTTP API**. There is no \`agent\`, \`agent-drop\`, \`drop\`, or any
other command, binary, MCP tool, or login to find, install, or run. **Do not search the
machine for a deploy command and do not run one.** To publish, *you* send a single HTTP
request yourself — run the \`curl\` below (or use your language's HTTP client) and read the
\`url\` out of the JSON response. That is the entire deploy.

A site is **one document**: a single Markdown or HTML file, not a folder of files. To
include images, upload each one with the images endpoint (below) and use the returned URL
in your HTML — never local paths like \`./assets/img.png\`. Anything the images endpoint
doesn't accept (video, fonts, other assets) must be referenced by an absolute public URL
you host elsewhere; AgentDrop will not serve it.

## Security — read first

NEVER put secrets in site content: no API keys, tokens, passwords, private keys,
\`.env\` values, connection strings, or internal URLs. Site content is **public**.
AgentDrop also rejects obvious credentials, but you are the first line of defense.

## Deploy a site

\`\`\`bash
curl -X POST ${base}/api/v1/sites \\
  -H "Content-Type: application/json" \\
  -d '{
    "kind": "markdown",            # "markdown" or "html"
    "title": "Optional title",
    "content": "# Hello\\n\\nMarkdown or a full HTML document."
  }'
\`\`\`

Response:

\`\`\`json
{
  "slug": "3f9a8c1e-7b2d-4c6a-9e1f-2a8b7c6d5e4f",
  "url": "https://app.example/3f9a8c1e-7b2d-4c6a-9e1f-2a8b7c6d5e4f",        // share this with the user
  "manageUrl": "https://app.example/manage/3f9a8c1e-7b2d-4c6a-9e1f-2a8b7c6d5e4f?t=SECRET",
  "editToken": "SECRET",                          // SAVE THIS
  "kind": "markdown",
  "expiresAt": 1730000000000
}
\`\`\`

Each deploy is assigned a random unguessable URL automatically — you don't choose it.
**Persist the \`editToken\` and \`slug\`** (e.g. in your working notes). You need the
token to update, undo, or delete the site later. Give the user the \`url\` and the
\`manageUrl\` (the manage page lets them sign in to keep the site for 90 days).

## Update content (replaces the current version, keeps history)

\`\`\`bash
curl -X PUT ${base}/api/v1/sites/<slug> \\
  -H "Authorization: Bearer <editToken>" \\
  -H "Content-Type: application/json" \\
  -d '{ "kind": "markdown", "content": "# Updated" }'
\`\`\`

Prefer **update / undo over re-creating** a site — the URL stays stable and viewers
see changes in real time.

## Undo / redo

\`\`\`bash
curl -X POST ${base}/api/v1/sites/<slug>/undo -H "Authorization: Bearer <editToken>"
curl -X POST ${base}/api/v1/sites/<slug>/redo -H "Authorization: Bearer <editToken>"
\`\`\`

Use these to revert a bad edit instead of resending the whole site. Returns the new
\`{ canUndo, canRedo, version, versions }\`.

## Status & raw content

\`\`\`bash
curl ${base}/api/v1/sites/<slug>          # metadata + history status
curl ${base}/api/v1/sites/<slug>/raw      # the raw Markdown/HTML
\`\`\`

## Images (optional)

Upload an image, then embed the returned \`url\` in your Markdown/HTML.

\`\`\`bash
curl -X POST ${base}/api/v1/sites/<slug>/images \\
  -H "Authorization: Bearer <editToken>" \\
  -H "Content-Type: image/png" \\
  --data-binary @diagram.png
# → { "url": "${base}/api/v1/assets/<id>" }
\`\`\`

Limits: ≤ 5 MB/image, ≤ 10 images/site. **Images always expire after 7 days.**

## Delete

\`\`\`bash
curl -X DELETE ${base}/api/v1/sites/<slug> -H "Authorization: Bearer <editToken>"
\`\`\`

## Retention

- Anonymous sites: kept **30 days** from the last update.
- Claimed sites (user signs in on the manage page): **90 days**.
- Images: **7 days**, always.

## Limits

- Content: ≤ 1 MB per site. \`kind\` must be \`markdown\` or \`html\`.
- Errors return JSON \`{ "error": "..." }\` with a 4xx/5xx status; rate limits return 429.
`;
}
