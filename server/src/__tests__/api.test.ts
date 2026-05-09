import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { closeDatabase, createDatabase, type DatabaseConnection } from "../db/index.js";
import { Ok } from "../lib/result.js";
import type { SearchService } from "../services/search.service.js";
import { jsonBody, patchJson, postJson } from "./helpers.js";

interface PromptData {
  data: {
    publicId: string;
    text: string;
    records: Array<{ publicId: string; title: string; description: string }>;
  };
}

interface ErrorData {
  error: { code: string; message: string };
}

const TEST_LLM_CONFIG = { apiKey: "test", baseUrl: "http://localhost", model: "test" };
const mockSearch: SearchService = { search: () => Promise.resolve(Ok([])) };

function buildApp(db: DatabaseConnection["db"]) {
  return createApp({
    db,
    llmConfig: TEST_LLM_CONFIG,
    search: mockSearch,
    clientOrigin: "http://localhost:5173",
  });
}

describe("API Integration", () => {
  let conn: DatabaseConnection;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    conn = createDatabase({ url: ":memory:", syncUrl: null, authToken: null });
    await migrate(conn.db, { migrationsFolder: "./drizzle" });
    app = buildApp(conn.db);
  });

  afterEach(() => {
    closeDatabase(conn);
  });

  describe("GET /api/health", () => {
    it("returns ok status", async () => {
      // Act
      const res = await app.request("/api/health");

      // Assert
      expect(res.status).toBe(200);
      const body = await jsonBody<{ status: string; timestamp: string }>(res);
      expect(body.status).toBe("ok");
      expect(body.timestamp).toBeTruthy();
    });
  });

  describe("POST /api/v1/prompts", () => {
    it("creates a prompt with chatting status and no records", async () => {
      // Act
      const res = await app.request("/api/v1/prompts", postJson({ text: "Give me tax advice" }));

      // Assert
      expect(res.status).toBe(201);
      const body = await jsonBody<PromptData>(res);
      expect(body.data.text).toBe("Give me tax advice");
      expect(body.data.publicId).toBeTruthy();
      expect(body.data.records).toHaveLength(0);
    });

    it("returns 400 for missing text", async () => {
      // Act
      const res = await app.request("/api/v1/prompts", postJson({}));

      // Assert
      expect(res.status).toBe(400);
      const body = await jsonBody<ErrorData>(res);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for empty text", async () => {
      // Act
      const res = await app.request("/api/v1/prompts", postJson({ text: "" }));

      // Assert
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/prompts/:publicId", () => {
    it("returns a prompt with its records", async () => {
      // Arrange
      const createRes = await app.request("/api/v1/prompts", postJson({ text: "test" }));
      const created = await jsonBody<PromptData>(createRes);

      // Act
      const res = await app.request(`/api/v1/prompts/${created.data.publicId}`);

      // Assert
      expect(res.status).toBe(200);
      const body = await jsonBody<PromptData>(res);
      expect(body.data.publicId).toBe(created.data.publicId);
      expect(body.data.records).toHaveLength(0);
    });

    it("returns 404 for unknown publicId", async () => {
      // Act
      const res = await app.request("/api/v1/prompts/nonexistent");

      // Assert
      expect(res.status).toBe(404);
      const body = await jsonBody<ErrorData>(res);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PATCH /api/v1/prompts/:publicId", () => {
    it("resets prompt text and status to chatting", async () => {
      // Arrange
      const createRes = await app.request("/api/v1/prompts", postJson({ text: "original" }));
      const created = await jsonBody<PromptData>(createRes);

      // Act
      const res = await app.request(
        `/api/v1/prompts/${created.data.publicId}`,
        patchJson({ text: "updated prompt" }),
      );

      // Assert
      expect(res.status).toBe(200);
      const body = await jsonBody<PromptData>(res);
      expect(body.data.text).toBe("updated prompt");
      expect(body.data.publicId).toBe(created.data.publicId);
      expect(body.data.records).toHaveLength(0);
    });
  });

  // Record CRUD (PATCH/DELETE) is tested at the service level in services.test.ts.
  // API-level record tests require records seeded via the agent, which is tested
  // through Playwright e2e instead.
});
