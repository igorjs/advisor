import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { closeDatabase, createDatabase, type DatabaseConnection } from "../db/index.js";
import { Ok } from "../lib/result.js";
import type { SearchService } from "../services/search.service.js";
import { jsonBody, patchJson, postJson } from "./helpers.js";

interface ConversationData {
  data: {
    publicId: string;
    title: string;
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

  describe("POST /api/v1/conversations", () => {
    it("creates a conversation with no records", async () => {
      // Act
      const res = await app.request("/api/v1/conversations", postJson({ title: "Give me tax advice" }));

      // Assert
      expect(res.status).toBe(201);
      const body = await jsonBody<ConversationData>(res);
      expect(body.data.title).toBe("Give me tax advice");
      expect(body.data.publicId).toBeTruthy();
      expect(body.data.records).toHaveLength(0);
    });

    it("returns 400 for missing title", async () => {
      // Act
      const res = await app.request("/api/v1/conversations", postJson({}));

      // Assert
      expect(res.status).toBe(400);
      const body = await jsonBody<ErrorData>(res);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for empty title", async () => {
      // Act
      const res = await app.request("/api/v1/conversations", postJson({ title: "" }));

      // Assert
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/conversations/:publicId", () => {
    it("returns a conversation with its records", async () => {
      // Arrange
      const createRes = await app.request("/api/v1/conversations", postJson({ title: "test" }));
      const created = await jsonBody<ConversationData>(createRes);

      // Act
      const res = await app.request(`/api/v1/conversations/${created.data.publicId}`);

      // Assert
      expect(res.status).toBe(200);
      const body = await jsonBody<ConversationData>(res);
      expect(body.data.publicId).toBe(created.data.publicId);
      expect(body.data.records).toHaveLength(0);
    });

    it("returns 404 for unknown publicId", async () => {
      // Act
      const res = await app.request("/api/v1/conversations/nonexistent");

      // Assert
      expect(res.status).toBe(404);
      const body = await jsonBody<ErrorData>(res);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PATCH /api/v1/conversations/:publicId", () => {
    it("resets conversation title", async () => {
      // Arrange
      const createRes = await app.request("/api/v1/conversations", postJson({ title: "original" }));
      const created = await jsonBody<ConversationData>(createRes);

      // Act
      const res = await app.request(
        `/api/v1/conversations/${created.data.publicId}`,
        patchJson({ title: "updated conversation" }),
      );

      // Assert
      expect(res.status).toBe(200);
      const body = await jsonBody<ConversationData>(res);
      expect(body.data.title).toBe("updated conversation");
      expect(body.data.publicId).toBe(created.data.publicId);
      expect(body.data.records).toHaveLength(0);
    });
  });

  // Record CRUD (PATCH/DELETE) is tested at the service level in services.test.ts.
  // API-level record tests require records seeded via the agent, which is tested
  // through Playwright e2e instead.
});
