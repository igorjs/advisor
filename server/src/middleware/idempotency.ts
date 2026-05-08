import { eq, lt } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { IDEMPOTENCY_TTL_MS } from "../config/idempotency.js";
import type { AppDatabase } from "../db/index.js";
import { idempotencyKeys } from "../db/schema.js";

/**
 * Idempotency middleware for mutation endpoints.
 * If the Idempotency-Key header is present and was seen before,
 * returns the cached response. Otherwise, captures and stores
 * the response for future deduplication.
 */
export function createIdempotencyMiddleware(
  db: AppDatabase,
): MiddlewareHandler {
  return async (c, next) => {
    const key = c.req.header("Idempotency-Key");

    if (!key) {
      await next();
      return;
    }

    // Purge expired keys on-request
    const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS).toISOString();
    await db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, cutoff)).run();

    // Check for existing key
    const existing = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key))
      .get();

    if (existing) {
      const cached = JSON.parse(existing.response);
      return new Response(JSON.stringify(cached.body), {
        status: cached.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Execute the handler
    await next();

    // Cache the response
    if (c.res.status < 400) {
      const cloned = c.res.clone();
      const body = await cloned.text();
      await db.insert(idempotencyKeys)
        .values({
          key,
          endpoint: `${c.req.method} ${c.req.path}`,
          response: JSON.stringify({ status: c.res.status, body: JSON.parse(body) }),
        })
        .run();
    }
  };
}
