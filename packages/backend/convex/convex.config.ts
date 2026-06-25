import betterAuth from "@convex-dev/better-auth/convex.config";
import r2 from "@convex-dev/r2/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";
import timeline from "convex-timeline/convex.config";

const app = defineApp();
app.use(betterAuth);
app.use(r2);
app.use(rateLimiter);
app.use(timeline);

export default app;
