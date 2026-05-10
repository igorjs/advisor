// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { Hono } from "hono";
import type { AppDatabase } from "./db/index.js";
import { contextMiddleware } from "./middleware/context.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createIdempotencyMiddleware } from "./middleware/idempotency.js";
import { loggerMiddleware } from "./middleware/logger.js";
import { createRateLimiter } from "./middleware/rate-limiter.js";
import { securityMiddleware } from "./middleware/security.js";
import { createChatRoutes } from "./routes/chat.js";
import { createConversationRoutes } from "./routes/conversations.js";
import { health } from "./routes/health.js";
import { createRecordRoutes } from "./routes/records.js";
import { createAgentService } from "./services/agent.service.js";
import { createConversationService } from "./services/conversation.service.js";
import type { LlmServiceConfig } from "./services/llm.service.js";
import { createRecordService } from "./services/record.service.js";
import type { SearchService } from "./services/search.service.js";

interface AppDependencies {
  db: AppDatabase;
  llmConfig: LlmServiceConfig;
  search: SearchService;
  clientOrigin: string;
}

/**
 * Dependencies are injected rather than imported globally so the app
 * can be instantiated with test doubles (mock LLM, in-memory DB).
 */
export function createApp({ db, llmConfig, search, clientOrigin }: AppDependencies) {
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

  const conversationService = createConversationService(db);
  const recordService = createRecordService(db);
  const agentService = createAgentService(db, llmConfig, search);

  // Rate limiter and idempotency only on mutations, not reads.
  // LLM calls cost money per request, so rate limiting protects the budget.
  // Idempotency prevents duplicate LLM calls on network retries.
  const rateLimiter = createRateLimiter();
  const idempotency = createIdempotencyMiddleware(db);

  app.route("/api/health", health);

  // Versioned API: /api/v1/ prefix so future breaking changes don't
  // require migrating existing clients
  const v1 = new Hono();

  const conversationRoutes = createConversationRoutes(conversationService);
  const recordRoutes = createRecordRoutes(recordService);
  const chatRoutes = createChatRoutes(agentService);

  v1.use("/conversations", rateLimiter);
  v1.use("/conversations", idempotency);
  v1.use("/conversations/:conversationId/records/:recordId", rateLimiter);

  v1.route("/conversations", conversationRoutes);
  // Nested under conversations: records are owned by a conversation, the URL reflects this
  v1.route("/conversations/:conversationId/records", recordRoutes);
  // Chat endpoint uses SSE streaming, rate limited but no idempotency
  // (each message is a new turn, not a retry)
  v1.use("/conversations/:conversationId/chat", rateLimiter);
  v1.route("/conversations", chatRoutes);

  app.route("/api/v1", v1);

  return app;
}
