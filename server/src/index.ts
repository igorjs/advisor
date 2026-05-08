import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createApp } from "./app.js";
import { closeDatabase, createDatabase } from "./db/index.js";
import { env } from "./env.js";
import { logger } from "./middleware/logger.js";
import { createLlmService } from "./services/llm.service.js";

// Ensure database directory exists for file-based databases
if (env.DATABASE_URL.startsWith("file:")) {
  mkdirSync(dirname(env.DATABASE_URL.replace("file:", "")), { recursive: true });
}

// Initialize database (local SQLite or Turso embedded replica)
const conn = createDatabase({
  url: env.DATABASE_URL,
  syncUrl: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

await migrate(conn.db, { migrationsFolder: "./drizzle" });

logger.info(
  env.TURSO_DATABASE_URL
    ? "Database connected (Turso embedded replica)"
    : "Database connected (local SQLite)",
);

// Initialize services
const llm = createLlmService({
  apiKey: env.LLM_API_KEY,
  baseUrl: env.LLM_BASE_URL,
  model: env.LLM_MODEL,
});

// Create app
const app = createApp({
  db: conn.db,
  llm,
  clientOrigin: env.CLIENT_ORIGIN,
});

// Start server
const server = serve(
  { fetch: app.fetch, port: env.PORT },
  (info) => {
    logger.info(`Server running at http://localhost:${info.port}`);
  },
);

// Graceful shutdown
function shutdown() {
  logger.info("Shutting down gracefully...");
  server.close(() => {
    closeDatabase(conn);
    logger.info("Server closed.");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
