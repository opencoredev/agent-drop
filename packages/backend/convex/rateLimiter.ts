import { DAY, HOUR, RateLimiter } from "@convex-dev/rate-limiter";

import { components } from "./_generated/api";

// Abuse protection for the public agent API.
//
// `createSite` is keyed by client IP and deliberately tight, because an
// anonymous caller is just an address we cannot hold responsible. A caller
// presenting an account API key is keyed by that account instead and gets a much
// larger budget: there is a person attached to it, the pages count against their
// storage, and a key can be revoked. `updateSite` / `uploadImage` are keyed by
// the site's edit-token hash, so they are already per-site rather than per-caller.
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  createSite: { kind: "token bucket", rate: 30, period: DAY, capacity: 8 },
  createSiteAuthed: { kind: "token bucket", rate: 1000, period: DAY, capacity: 100 },
  updateSite: { kind: "token bucket", rate: 120, period: HOUR, capacity: 20 },
  uploadImage: { kind: "token bucket", rate: 40, period: DAY, capacity: 10 },
});
