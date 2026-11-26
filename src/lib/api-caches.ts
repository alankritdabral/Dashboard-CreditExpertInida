import { TtlCache } from "./ttl-cache";

// Cached backend query results shared between route handlers so writes can invalidate them.
export const reportsListCache = new TtlCache<any>(30_000, 40);
// Admin Activity tab: employee roster, pull history and per-employee summaries.
export const activityCache = new TtlCache<any>(60_000, 40);
