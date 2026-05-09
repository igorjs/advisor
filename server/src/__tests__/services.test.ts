// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, createDatabase, type DatabaseConnection } from "../db/index.js";
import { eq } from "drizzle-orm";
import { conversations, records } from "../db/schema.js";
import { createConversationService, type ConversationService } from "../services/conversation.service.js";
import { createRecordService, type RecordService } from "../services/record.service.js";

describe("ConversationService", () => {
  let conn: DatabaseConnection;
  let conversationService: ConversationService;

  beforeEach(async () => {
    conn = createDatabase({ url: ":memory:", syncUrl: null, authToken: null });
    await migrate(conn.db, { migrationsFolder: "./drizzle" });
    conversationService = createConversationService(conn.db);
  });

  afterEach(() => {
    closeDatabase(conn);
  });

  describe("createConversation", () => {
    it("creates a conversation with empty records", async () => {
      // Act
      const result = await conversationService.createConversation("Give me tax advice");

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.title).toBe("Give me tax advice");
        expect(result.value.publicId).toBeTruthy();
        expect(result.value.records).toHaveLength(0);
      }
    });
  });

  describe("getConversation", () => {
    it("returns the conversation with its records", async () => {
      // Arrange
      const created = await conversationService.createConversation("test conversation");
      if (!created.ok) throw new Error("Setup failed");

      // Act
      const result = await conversationService.getConversation(created.value.publicId);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.publicId).toBe(created.value.publicId);
        expect(result.value.records).toHaveLength(0);
      }
    });

    it("returns NOT_FOUND for unknown publicId", async () => {
      // Act
      const result = await conversationService.getConversation("nonexistent");

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("reQueryConversation", () => {
    it("resets conversation title", async () => {
      // Arrange
      const created = await conversationService.createConversation("original conversation");
      if (!created.ok) throw new Error("Setup failed");

      // Act
      const result = await conversationService.reQueryConversation(
        created.value.publicId,
        "updated conversation",
      );

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.title).toBe("updated conversation");
        expect(result.value.publicId).toBe(created.value.publicId);
        expect(result.value.records).toHaveLength(0);
      }
    });

    it("returns NOT_FOUND for unknown publicId", async () => {
      // Act
      const result = await conversationService.reQueryConversation("nope", "title");

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("findConversation", () => {
    it("returns Some when conversation exists", async () => {
      // Arrange
      const created = await conversationService.createConversation("test");
      if (!created.ok) throw new Error("Setup failed");

      // Act
      const option = await conversationService.findConversation(created.value.publicId);

      // Assert
      expect(option.some).toBe(true);
      if (option.some) {
        expect(option.value.publicId).toBe(created.value.publicId);
      }
    });

    it("returns None when conversation does not exist", async () => {
      // Act
      const option = await conversationService.findConversation("nonexistent");

      // Assert
      expect(option.some).toBe(false);
    });
  });
});

describe("RecordService", () => {
  let conn: DatabaseConnection;
  let conversationService: ConversationService;
  let recordService: RecordService;

  beforeEach(async () => {
    conn = createDatabase({ url: ":memory:", syncUrl: null, authToken: null });
    await migrate(conn.db, { migrationsFolder: "./drizzle" });
    conversationService = createConversationService(conn.db);
    recordService = createRecordService(conn.db);
  });

  // Seed records directly since createConversation no longer calls LLM.
  // Returns the conversation publicId and record publicIds for use in tests.
  async function seedConversationWithRecords() {
    const created = await conversationService.createConversation("test");
    if (!created.ok) throw new Error("Setup failed");

    const conversation = await conn.db.select().from(conversations).where(eq(conversations.publicId, created.value.publicId)).get();
    if (!conversation) throw new Error("Conversation not found");

    const r1 = await conn.db.insert(records).values({ conversationId: conversation.id, title: "Tip 1", description: "First tip" }).returning().get();
    const r2 = await conn.db.insert(records).values({ conversationId: conversation.id, title: "Tip 2", description: "Second tip" }).returning().get();

    return {
      conversationPublicId: created.value.publicId,
      recordPublicIds: [r1!.publicId, r2!.publicId],
    };
  }

  afterEach(() => {
    closeDatabase(conn);
  });

  describe("getRecords", () => {
    it("returns records for a conversation", async () => {
      // Arrange
      const { conversationPublicId } = await seedConversationWithRecords();

      // Act
      const result = await recordService.getRecords(conversationPublicId);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }
    });

    it("returns NOT_FOUND for unknown conversation", async () => {
      // Act
      const result = await recordService.getRecords("nonexistent");

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("updateRecord", () => {
    it("updates a record's title", async () => {
      // Arrange
      const { conversationPublicId, recordPublicIds } = await seedConversationWithRecords();
      const recordId = recordPublicIds[0] ?? "";

      // Act
      const result = await recordService.updateRecord(
        conversationPublicId,
        recordId,
        { title: "Updated Title" },
      );

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.title).toBe("Updated Title");
        expect(result.value.description).toBe("First tip");
      }
    });

    it("updates a record's description", async () => {
      // Arrange
      const { conversationPublicId, recordPublicIds } = await seedConversationWithRecords();
      const recordId = recordPublicIds[0] ?? "";

      // Act
      const result = await recordService.updateRecord(
        conversationPublicId,
        recordId,
        { description: "Updated desc" },
      );

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.description).toBe("Updated desc");
      }
    });

    it("returns NOT_FOUND for unknown record", async () => {
      // Arrange
      const created = await conversationService.createConversation("test");
      if (!created.ok) throw new Error("Setup failed");

      // Act
      const result = await recordService.updateRecord(
        created.value.publicId,
        "nonexistent",
        { title: "X" },
      );

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("deleteRecord", () => {
    it("soft-deletes a record so it no longer appears in getRecords", async () => {
      // Arrange
      const { conversationPublicId, recordPublicIds } = await seedConversationWithRecords();
      const recordId = recordPublicIds[0] ?? "";

      // Act
      const deleteResult = await recordService.deleteRecord(
        conversationPublicId,
        recordId,
      );

      // Assert
      expect(deleteResult.ok).toBe(true);

      const remaining = await recordService.getRecords(conversationPublicId);
      expect(remaining.ok).toBe(true);
      if (remaining.ok) {
        expect(remaining.value).toHaveLength(1);
      }
    });

    it("returns NOT_FOUND for unknown record", async () => {
      // Arrange
      const created = await conversationService.createConversation("test");
      if (!created.ok) throw new Error("Setup failed");

      // Act
      const result = await recordService.deleteRecord(
        created.value.publicId,
        "nonexistent",
      );

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });
});
