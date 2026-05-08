import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createApp } from "./app.js";
import { createDatabase } from "./db/index.js";
import { env } from "./env.js";
import { logger } from "./middleware/logger.js";
import { createLlmService } from "./services/llm.service.js";

// Ensure database directory exists
mkdirSync(dirname(env.DATABASE_URL), { recursive: true });

// Initialize database
const db = createDatabase(env.DATABASE_URL);
migrate(db, { migrationsFolder: "./drizzle" });

// Initialize services
const llm = createLlmService(env.OPENAI_API_KEY);

// Create app
const app = createApp({
  db,
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
    db.$client.close();
    logger.info("Server closed.");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
