// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import type { MiddlewareHandler } from "hono";
import pino from "pino";

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  transport:
    process.env["NODE_ENV"] !== "production"
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
});

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
    logger: pino.Logger;
  }
}

export const loggerMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  const childLogger = logger.child({ requestId });

  c.set("requestId", requestId);
  c.set("logger", childLogger);
  c.header("X-Request-Id", requestId);

  childLogger.info({ method: c.req.method, path: c.req.path }, "request");

  await next();

  const duration = Date.now() - start;
  childLogger.info(
    { method: c.req.method, path: c.req.path, status: c.res.status, duration },
    "response",
  );
};
