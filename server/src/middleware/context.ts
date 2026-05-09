// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../lib/types.js";

declare module "hono" {
  interface ContextVariableMap {
    appContext: AppContext;
  }
}

/**
 * Injects AppContext into the request. Currently a stub (userId: null).
 * When auth is added, this middleware will extract the user from the token.
 */
export const contextMiddleware: MiddlewareHandler = async (c, next) => {
  const appContext: AppContext = {
    userId: null,
    requestId: c.get("requestId") ?? crypto.randomUUID(),
  };

  c.set("appContext", appContext);
  await next();
};
