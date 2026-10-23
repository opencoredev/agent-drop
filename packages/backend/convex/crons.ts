import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily sweep that deletes expired images (7d) and expired sites (30d anon /
// 90d claimed), including their R2 objects and timeline history. The mutation
// self-schedules while a batch is saturated so a backlog does not wait another
// day; failed R2 deletes are retried without dropping ledger keys.
crons.daily(
  "cleanup expired sites and images",
  { hourUTC: 8, minuteUTC: 17 },
  internal.sites.cleanupExpired,
  {},
);

// Spent authorization codes and expired OAuth tokens, which otherwise pile up
// one row per sign-in forever.
crons.daily(
  "cleanup expired oauth grants",
  { hourUTC: 8, minuteUTC: 32 },
  internal.oauth.cleanupExpiredGrants,
  {},
);

export default crons;
