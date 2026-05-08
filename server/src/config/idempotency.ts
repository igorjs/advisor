// Cached responses are purged after this TTL to prevent unbounded storage growth.
// 24h is long enough to cover retry windows and short enough to not bloat the DB.
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
