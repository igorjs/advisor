import { Hono } from "hono";
import type { AppDatabase } from "./db/index.js";
import { contextMiddleware } from "./middleware/context.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createIdempotencyMiddleware } from "./middleware/idempotency.js";
import { loggerMiddleware } from "./middleware/logger.js";
import { createRateLimiter } from "./middleware/rate-limiter.js";
import { securityMiddleware } from "./middleware/security.js";
import { health } from "./routes/health.js";
import { createPromptRoutes } from "./routes/prompts.js";
import { createRecordRoutes } from "./routes/records.js";
import type { LlmService } from "./services/llm.service.js";
import { createPromptService } from "./services/prompt.service.js";
import { createRecordService } from "./services/record.service.js";

interface AppDependencies {
  db: AppDatabase;
  llm: LlmService;
  clientOrigin: string;
}

export function createApp({ db, llm, clientOrigin }: AppDependencies) {
  const app = new Hono();

  // Global middleware
  app.use("*", loggerMiddleware);
  app.use("*", securityMiddleware);
  app.use("*", createCorsMiddleware(clientOrigin));
  app.use("*", contextMiddleware);
  app.onError(errorHandler);

  // Services
  const promptService = createPromptService(db, llm);
  const recordService = createRecordService(db);

  // Rate limiter + idempotency on mutations
  const rateLimiter = createRateLimiter(10, 60_000);
  const idempotency = createIdempotencyMiddleware(db);

  // Routes
  app.route("/api/health", health);

  const v1 = new Hono();

  const promptRoutes = createPromptRoutes(promptService);
  const recordRoutes = createRecordRoutes(recordService);

  // Apply rate limiter and idempotency to mutation routes
  v1.use("/prompts", rateLimiter);
  v1.use("/prompts", idempotency);
  v1.use("/prompts/:promptId/records/:recordId", rateLimiter);

  v1.route("/prompts", promptRoutes);
  v1.route("/prompts/:promptId/records", recordRoutes);

  app.route("/api/v1", v1);

  return app;
}
