// Writes the repo copy of the agent skill, so `npx skills add opencoredev/agent-drop`
// installs the same text the API serves at /agentdrop-skill.md.
//
// Run it after changing skill.ts or after pointing at a new deployment:
//   bun run skill:sync
//   AGENTDROP_API_BASE=https://your-prod.convex.site bun run skill:sync

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { skillMarkdown } from "../convex/skill";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const out = join(repoRoot, "skills", "agentdrop", "SKILL.md");

function resolveBase(): string {
  if (process.env.AGENTDROP_API_BASE) return process.env.AGENTDROP_API_BASE;

  // Fall back to the deployment the local Convex CLI is pointed at.
  try {
    const envFile = readFileSync(join(here, "..", ".env.local"), "utf8");
    const match = envFile.match(/^CONVEX_SITE_URL=(.+)$/m);
    if (match?.[1]) return match[1].trim();
  } catch {
    // No local deployment configured yet.
  }

  throw new Error(
    "No API base. Set AGENTDROP_API_BASE, or run `bun run dev:setup` so packages/backend/.env.local has CONVEX_SITE_URL.",
  );
}

const base = resolveBase();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, skillMarkdown(base));
console.log(`Wrote ${out}\nAPI base: ${base}`);
