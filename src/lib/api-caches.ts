import { TtlCache } from "./ttl-cache";

// Cached Firestore query results shared between route handlers so writes can invalidate them.
export const reportsListCache = new TtlCache<any>(30_000, 40);
export const systemLogsCache = new TtlCache<any[]>(20_000, 10);
