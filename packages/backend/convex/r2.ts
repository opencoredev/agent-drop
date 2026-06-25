import { R2 } from "@convex-dev/r2";

import { components } from "./_generated/api";

// Reads bucket/endpoint/credentials from the R2_* Convex environment variables.
export const r2 = new R2(components.r2);
