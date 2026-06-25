import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily sweep that deletes expired images (7d) and expired sites (30d anon /
// 90d claimed), including their R2 objects and timeline history.
crons.daily(
  "cleanup expired sites and images",
  { hourUTC: 8, minuteUTC: 17 },
  internal.sites.cleanupExpired,
  {},
);

export default crons;
