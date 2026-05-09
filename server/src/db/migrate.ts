// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { closeDatabase, createDatabase } from "./index.js";

const databaseUrl = process.env["DATABASE_URL"] ?? "file:data/advisor.db";

// Ensure parent directory exists for file-based databases
if (databaseUrl.startsWith("file:")) {
  mkdirSync(dirname(databaseUrl.replace("file:", "")), { recursive: true });
}

const conn = createDatabase({
  url: databaseUrl,
  syncUrl: process.env["TURSO_DATABASE_URL"] ?? null,
  authToken: process.env["TURSO_AUTH_TOKEN"] ?? null,
});

await migrate(conn.db, { migrationsFolder: "./drizzle" });

console.log("Migrations applied successfully.");

closeDatabase(conn);
