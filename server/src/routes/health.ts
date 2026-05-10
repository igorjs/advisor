// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { Hono } from "hono";

const health = new Hono();

health.get("/", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

export { health };
