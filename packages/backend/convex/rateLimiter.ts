import { DAY, HOUR, RateLimiter } from "@convex-dev/rate-limiter";

import { components } from "./_generated/api";

// Abuse protection for the public agent API. `createSite` is keyed by client IP;
// `updateSite` / `uploadImage` are keyed by the site's edit-token hash.
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  createSite: { kind: "token bucket", rate: 30, period: DAY, capacity: 8 },
  updateSite: { kind: "token bucket", rate: 120, period: HOUR, capacity: 20 },
  uploadImage: { kind: "token bucket", rate: 40, period: DAY, capacity: 10 },
});
