import { eq, lt } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { AppDatabase } from "../db/index.js";
import { idempotencyKeys } from "../db/schema.js";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
    const cutoff = new Date(Date.now() - TTL_MS).toISOString();
    db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, cutoff)).run();

    // Check for existing key
    const existing = db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key))
      .get();

    if (existing) {
      const cached = JSON.parse(existing.response) as {
        status: number;
        body: unknown;
      };
      return c.json(cached.body, cached.status as 200);
    }

    // Execute the handler
    await next();

    // Cache the response
    if (c.res.status < 400) {
      const cloned = c.res.clone();
      const body = await cloned.json();
      db.insert(idempotencyKeys)
        .values({
          key,
          endpoint: `${c.req.method} ${c.req.path}`,
          response: JSON.stringify({ status: c.res.status, body }),
        })
        .run();
    }
  };
}
