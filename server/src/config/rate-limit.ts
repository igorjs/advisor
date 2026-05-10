// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

// Per-IP rate limiting on mutation endpoints.
// Protects LLM API budget: each prompt creation costs real money.
// In-memory store resets on restart. For production SaaS, swap to Redis.
// High default for dev/e2e; tighten in production via env vars.
export const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX ?? 100);
export const RATE_LIMIT_WINDOW_MS = 60_000;
