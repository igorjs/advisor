// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

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
