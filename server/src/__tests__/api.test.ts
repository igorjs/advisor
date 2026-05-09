import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { closeDatabase, createDatabase, type DatabaseConnection } from "../db/index.js";
import { Err, Ok } from "../lib/result.js";
import type { LlmService } from "../services/llm.service.js";
import { jsonBody, patchJson, postJson } from "./helpers.js";

interface PromptData {
  data: {
    publicId: string;
    text: string;
    records: Array<{ publicId: string; title: string; description: string }>;
  };
}

interface RecordsData {
  data: Array<{ publicId: string; title: string; description: string }>;
  meta: { total: number; page: number; pageSize: number };
}

interface RecordData {
  data: { publicId: string; title: string; description: string };
}

interface ErrorData {
  error: { code: string; message: string };
}

function createMockLlm(overrides?: Partial<LlmService>): LlmService {
  return {
    generateRecords: overrides?.generateRecords ??
      (() =>
        Promise.resolve(
          Ok([
            { title: "Tip 1", description: "First tip" },
            { title: "Tip 2", description: "Second tip" },
          ]),
        )),
  };
}

describe("API Integration", () => {
  let conn: DatabaseConnection;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    conn = createDatabase({ url: ":memory:", syncUrl: null, authToken: null });
    await migrate(conn.db, { migrationsFolder: "./drizzle" });
    app = createApp({
      db: conn.db,
      llm: createMockLlm(),
      clientOrigin: "http://localhost:5173",
    });
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
    it("creates a prompt and returns it with records", async () => {
      // Act
      const res = await app.request("/api/v1/prompts", postJson({ text: "Give me tax advice" }));

      // Assert
      expect(res.status).toBe(201);
      const body = await jsonBody<PromptData>(res);
      expect(body.data.text).toBe("Give me tax advice");
      expect(body.data.publicId).toBeTruthy();
      expect(body.data.records).toHaveLength(2);
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

    it("returns LLM error status when LLM fails", async () => {
      // Arrange
      const failApp = createApp({
        db: conn.db,
        llm: createMockLlm({
          generateRecords: () =>
            Promise.resolve(Err({ code: "LLM_TIMEOUT", message: "Timed out" })),
        }),
        clientOrigin: "http://localhost:5173",
      });

      // Act
      const res = await failApp.request("/api/v1/prompts", postJson({ text: "test" }));

      // Assert
      expect(res.status).toBe(504);
      const body = await jsonBody<ErrorData>(res);
      expect(body.error.code).toBe("LLM_TIMEOUT");
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
      expect(body.data.records).toHaveLength(2);
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
    it("re-queries and replaces records", async () => {
      // Arrange
      const createRes = await app.request("/api/v1/prompts", postJson({ text: "original" }));
      const created = await jsonBody<PromptData>(createRes);

      const reQueryApp = createApp({
        db: conn.db,
        llm: createMockLlm({
          generateRecords: () =>
            Promise.resolve(Ok([{ title: "New Tip", description: "New desc" }])),
        }),
        clientOrigin: "http://localhost:5173",
      });

      // Act
      const res = await reQueryApp.request(
        `/api/v1/prompts/${created.data.publicId}`,
        patchJson({ text: "updated prompt" }),
      );

      // Assert
      expect(res.status).toBe(200);
      const body = await jsonBody<PromptData>(res);
      expect(body.data.text).toBe("updated prompt");
      expect(body.data.publicId).toBe(created.data.publicId);
      expect(body.data.records).toHaveLength(1);
      expect(body.data.records[0]?.title).toBe("New Tip");
    });
  });

  describe("GET /api/v1/prompts/:promptId/records", () => {
    it("returns records with pagination meta", async () => {
      // Arrange
      const createRes = await app.request("/api/v1/prompts", postJson({ text: "test" }));
      const created = await jsonBody<PromptData>(createRes);

      // Act
      const res = await app.request(`/api/v1/prompts/${created.data.publicId}/records`);

      // Assert
      expect(res.status).toBe(200);
      const body = await jsonBody<RecordsData>(res);
      expect(body.data).toHaveLength(2);
      expect(body.meta.total).toBe(2);
    });
  });

  describe("PATCH /api/v1/prompts/:promptId/records/:recordId", () => {
    it("updates a record's title", async () => {
      // Arrange
      const createRes = await app.request("/api/v1/prompts", postJson({ text: "test" }));
      const created = await jsonBody<PromptData>(createRes);
      const promptId = created.data.publicId;
      const recordId = created.data.records[0]?.publicId ?? "";

      // Act
      const res = await app.request(
        `/api/v1/prompts/${promptId}/records/${recordId}`,
        patchJson({ title: "Updated Title" }),
      );

      // Assert
      expect(res.status).toBe(200);
      const body = await jsonBody<RecordData>(res);
      expect(body.data.title).toBe("Updated Title");
    });

    it("returns 400 when no fields provided", async () => {
      // Arrange
      const createRes = await app.request("/api/v1/prompts", postJson({ text: "test" }));
      const created = await jsonBody<PromptData>(createRes);
      const promptId = created.data.publicId;
      const recordId = created.data.records[0]?.publicId ?? "";

      // Act
      const res = await app.request(
        `/api/v1/prompts/${promptId}/records/${recordId}`,
        patchJson({}),
      );

      // Assert
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/v1/prompts/:promptId/records/:recordId", () => {
    it("soft-deletes a record and returns 204", async () => {
      // Arrange
      const createRes = await app.request("/api/v1/prompts", postJson({ text: "test" }));
      const created = await jsonBody<PromptData>(createRes);
      const promptId = created.data.publicId;
      const recordId = created.data.records[0]?.publicId ?? "";

      // Act
      const res = await app.request(
        `/api/v1/prompts/${promptId}/records/${recordId}`,
        { method: "DELETE" },
      );

      // Assert
      expect(res.status).toBe(204);

      // Verify record is gone from list
      const listRes = await app.request(`/api/v1/prompts/${promptId}/records`);
      const listBody = await jsonBody<RecordsData>(listRes);
      expect(listBody.data).toHaveLength(1);
    });

    it("returns 404 for unknown record", async () => {
      // Arrange
      const createRes = await app.request("/api/v1/prompts", postJson({ text: "test" }));
      const created = await jsonBody<PromptData>(createRes);

      // Act
      const res = await app.request(
        `/api/v1/prompts/${created.data.publicId}/records/nonexistent`,
        { method: "DELETE" },
      );

      // Assert
      expect(res.status).toBe(404);
    });
  });
});
