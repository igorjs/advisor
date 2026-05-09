// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import type { MiddlewareHandler } from "hono";
import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "../config/rate-limit.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory per-IP rate limiter.
 * Resets on server restart. For production, use Redis-backed implementation.
 */
export function createRateLimiter(
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): MiddlewareHandler {
  const store = new Map<string, RateLimitEntry>();

  // Without cleanup, the Map grows unbounded as new IPs hit the server.
  // .unref() lets Node exit even if this timer is still running.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, windowMs).unref();

  return async (c, next) => {
    // First entry in x-forwarded-for is the real client IP when behind a proxy.
    // Falls back to "unknown" so the limiter still works without a proxy.
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const now = Date.now();

    const entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          },
        },
        429,
      );
    }

    await next();
  };
}
