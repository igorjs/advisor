import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

export interface DatabaseConfig {
  /** Local file path (e.g. "file:data/advisor.db") or ":memory:" */
  url: string;
  /** Turso remote URL for embedded replica sync. Null = local only. */
  syncUrl: string | null;
  /** Turso auth token. Required when syncUrl is set. */
  authToken: string | null;
}

/**
 * Create a database connection.
 *
 * When syncUrl + authToken are provided, creates an embedded replica
 * that syncs to Turso. Otherwise, runs as a standalone local SQLite file.
 *
 * This design supports future multi-tenancy: each tenant could get
 * their own database file or Turso database, resolved at connection time.
 */
export function createDatabase(config: DatabaseConfig) {
  const client = createClient({
    url: config.url,
    ...(config.syncUrl !== null && config.authToken !== null
      ? { syncUrl: config.syncUrl, authToken: config.authToken }
      : {}),
  });

  const db = drizzle(client, { schema });

  return { db, client };
}

export type DatabaseConnection = ReturnType<typeof createDatabase>;
export type AppDatabase = DatabaseConnection["db"];

/** Close the underlying libsql client connection. */
export function closeDatabase(conn: DatabaseConnection): void {
  conn.client.close();
}
