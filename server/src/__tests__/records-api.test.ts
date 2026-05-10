// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { closeDatabase, createDatabase, type DatabaseConnection } from "../db/index.js";
import { conversations, records } from "../db/schema.js";
import { Ok } from "../lib/result.js";
import type { SearchService } from "../services/search.service.js";
import { jsonBody, patchJson } from "./helpers.js";

interface RecordData {
  data: { publicId: string; title: string; description: string };
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

describe("Records API", () => {
  let conn: DatabaseConnection;
  let app: ReturnType<typeof createApp>;
  let conversationPublicId: string;
  let recordPublicId: string;

  beforeEach(async () => {
    conn = createDatabase({ url: ":memory:", syncUrl: null, authToken: null });
    await migrate(conn.db, { migrationsFolder: "./drizzle" });
    app = buildApp(conn.db);

    // Seed a conversation with a record
    const conversation = await conn.db
      .insert(conversations)
      .values({ title: "Test conversation" })
      .returning()
      .get();

    const conversationRow = await conn.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversation!.id))
      .get();
    conversationPublicId = conversationRow!.publicId;

    const record = await conn.db
      .insert(records)
      .values({
        conversationId: conversation!.id,
        title: "Superannuation",
        description: "Maximise concessional contributions",
      })
      .returning()
      .get();
    recordPublicId = record!.publicId;
  });

  afterEach(() => {
    closeDatabase(conn);
  });

  describe("PATCH /api/v1/conversations/:id/records/:recordId", () => {
    it("updates a record title", async () => {
      // Act
      const res = await app.request(
        `/api/v1/conversations/${conversationPublicId}/records/${recordPublicId}`,
        patchJson({ title: "Updated Title" }),
      );

      // Assert
      expect(res.status).toBe(200);
      const body = await jsonBody<RecordData>(res);
      expect(body.data.title).toBe("Updated Title");
      expect(body.data.description).toBe("Maximise concessional contributions");
    });

    it("updates a record description", async () => {
      // Act
      const res = await app.request(
        `/api/v1/conversations/${conversationPublicId}/records/${recordPublicId}`,
        patchJson({ description: "New description" }),
      );

      // Assert
      expect(res.status).toBe(200);
      const body = await jsonBody<RecordData>(res);
      expect(body.data.title).toBe("Superannuation");
      expect(body.data.description).toBe("New description");
    });

    it("updates both title and description", async () => {
      // Act
      const res = await app.request(
        `/api/v1/conversations/${conversationPublicId}/records/${recordPublicId}`,
        patchJson({ title: "New Title", description: "New Desc" }),
      );

      // Assert
      expect(res.status).toBe(200);
      const body = await jsonBody<RecordData>(res);
      expect(body.data.title).toBe("New Title");
      expect(body.data.description).toBe("New Desc");
    });

    it("returns 400 when no fields provided", async () => {
      // Act
      const res = await app.request(
        `/api/v1/conversations/${conversationPublicId}/records/${recordPublicId}`,
        patchJson({}),
      );

      // Assert
      expect(res.status).toBe(400);
    });

    it("returns 404 for unknown record", async () => {
      // Act
      const res = await app.request(
        `/api/v1/conversations/${conversationPublicId}/records/nonexistent`,
        patchJson({ title: "X" }),
      );

      // Assert
      expect(res.status).toBe(404);
      const body = await jsonBody<ErrorData>(res);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 for unknown conversation", async () => {
      // Act
      const res = await app.request(
        `/api/v1/conversations/nonexistent/records/${recordPublicId}`,
        patchJson({ title: "X" }),
      );

      // Assert
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/conversations/:id/records/:recordId", () => {
    it("soft-deletes a record and returns 204", async () => {
      // Act
      const res = await app.request(
        `/api/v1/conversations/${conversationPublicId}/records/${recordPublicId}`,
        { method: "DELETE" },
      );

      // Assert
      expect(res.status).toBe(204);
    });

    it("record no longer appears in conversation after deletion", async () => {
      // Arrange
      await app.request(
        `/api/v1/conversations/${conversationPublicId}/records/${recordPublicId}`,
        { method: "DELETE" },
      );

      // Act
      const res = await app.request(`/api/v1/conversations/${conversationPublicId}`);

      // Assert
      expect(res.status).toBe(200);
      const body = await jsonBody<{ data: { records: unknown[] } }>(res);
      expect(body.data.records).toHaveLength(0);
    });

    it("returns 404 for unknown record", async () => {
      // Act
      const res = await app.request(
        `/api/v1/conversations/${conversationPublicId}/records/nonexistent`,
        { method: "DELETE" },
      );

      // Assert
      expect(res.status).toBe(404);
    });

    it("returns 404 for unknown conversation", async () => {
      // Act
      const res = await app.request(
        `/api/v1/conversations/nonexistent/records/${recordPublicId}`,
        { method: "DELETE" },
      );

      // Assert
      expect(res.status).toBe(404);
    });
  });
});
