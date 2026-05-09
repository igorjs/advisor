// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
});
