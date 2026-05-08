import { cors } from "hono/cors";

export function createCorsMiddleware(clientOrigin: string) {
  return cors({
    origin: clientOrigin,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Idempotency-Key"],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 3600,
  });
}
