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

/**
 * Dependencies are injected rather than imported globally so the app
 * can be instantiated with test doubles (mock LLM, in-memory DB).
 */
export function createApp({ db, llm, clientOrigin }: AppDependencies) {
  const app = new Hono();

  // Middleware order matters: logger first (to capture timing), security
  // headers early (before any response), CORS before routes, context last
  // (depends on requestId from logger)
  app.use("*", loggerMiddleware);
  app.use("*", securityMiddleware);
  app.use("*", createCorsMiddleware(clientOrigin));
  app.use("*", contextMiddleware);
  // Safety net for unhandled errors; services use Result so this rarely fires
  app.onError(errorHandler);

  const promptService = createPromptService(db, llm);
  const recordService = createRecordService(db);

  // Rate limiter and idempotency only on mutations, not reads.
  // LLM calls cost money per request, so rate limiting protects the budget.
  // Idempotency prevents duplicate LLM calls on network retries.
  const rateLimiter = createRateLimiter();
  const idempotency = createIdempotencyMiddleware(db);

  app.route("/api/health", health);

  // Versioned API: /api/v1/ prefix so future breaking changes don't
  // require migrating existing clients
  const v1 = new Hono();

  const promptRoutes = createPromptRoutes(promptService);
  const recordRoutes = createRecordRoutes(recordService);

  v1.use("/prompts", rateLimiter);
  v1.use("/prompts", idempotency);
  v1.use("/prompts/:promptId/records/:recordId", rateLimiter);

  v1.route("/prompts", promptRoutes);
  // Nested under prompts: records are owned by a prompt, the URL reflects this
  v1.route("/prompts/:promptId/records", recordRoutes);

  app.route("/api/v1", v1);

  return app;
}
