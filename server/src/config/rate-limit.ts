// Per-IP rate limiting on mutation endpoints.
// Protects LLM API budget: each prompt creation costs real money.
// In-memory store resets on restart. For production SaaS, swap to Redis.
export const RATE_LIMIT_MAX_REQUESTS = 10;
export const RATE_LIMIT_WINDOW_MS = 60_000;
