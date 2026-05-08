import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, createDatabase, type DatabaseConnection } from "../db/index.js";
import { Err, Ok } from "../lib/result.js";
import type { LlmService } from "../services/llm.service.js";
import { createPromptService, type PromptService } from "../services/prompt.service.js";
import { createRecordService, type RecordService } from "../services/record.service.js";

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

describe("PromptService", () => {
  let conn: DatabaseConnection;
  let promptService: PromptService;

  beforeEach(async () => {
    conn = createDatabase({ url: ":memory:", syncUrl: null, authToken: null });
    await migrate(conn.db, { migrationsFolder: "./drizzle" });
    promptService = createPromptService(conn.db, createMockLlm());
  });

  afterEach(() => {
    closeDatabase(conn);
  });

  describe("createPrompt", () => {
    it("creates a prompt and returns it with records", async () => {
      // Act
      const result = await promptService.createPrompt("Give me tax advice");

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.text).toBe("Give me tax advice");
        expect(result.value.publicId).toBeTruthy();
        expect(result.value.records).toHaveLength(2);
        expect(result.value.records[0]?.title).toBe("Tip 1");
      }
    });

    it("returns Err when LLM fails", async () => {
      // Arrange
      const service = createPromptService(
        conn.db,
        createMockLlm({
          generateRecords: () =>
            Promise.resolve(Err({ code: "LLM_TIMEOUT", message: "Timed out" })),
        }),
      );

      // Act
      const result = await service.createPrompt("test");

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LLM_TIMEOUT");
      }
    });
  });

  describe("getPrompt", () => {
    it("returns the prompt with its records", async () => {
      // Arrange
      const created = await promptService.createPrompt("test prompt");
      if (!created.ok) throw new Error("Setup failed");

      // Act
      const result = await promptService.getPrompt(created.value.publicId);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.publicId).toBe(created.value.publicId);
        expect(result.value.records).toHaveLength(2);
      }
    });

    it("returns NOT_FOUND for unknown publicId", async () => {
      // Act
      const result = await promptService.getPrompt("nonexistent");

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("reQueryPrompt", () => {
    it("updates prompt text and replaces records", async () => {
      // Arrange
      const created = await promptService.createPrompt("original prompt");
      if (!created.ok) throw new Error("Setup failed");

      const service = createPromptService(
        conn.db,
        createMockLlm({
          generateRecords: () =>
            Promise.resolve(
              Ok([{ title: "New Tip", description: "New description" }]),
            ),
        }),
      );

      // Act
      const result = await service.reQueryPrompt(
        created.value.publicId,
        "updated prompt",
      );

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.text).toBe("updated prompt");
        expect(result.value.publicId).toBe(created.value.publicId);
        expect(result.value.records).toHaveLength(1);
        expect(result.value.records[0]?.title).toBe("New Tip");
      }
    });

    it("returns NOT_FOUND for unknown publicId", async () => {
      // Act
      const result = await promptService.reQueryPrompt("nope", "text");

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("returns LLM error without modifying existing data", async () => {
      // Arrange
      const created = await promptService.createPrompt("original");
      if (!created.ok) throw new Error("Setup failed");

      const service = createPromptService(
        conn.db,
        createMockLlm({
          generateRecords: () =>
            Promise.resolve(Err({ code: "LLM_ERROR", message: "API down" })),
        }),
      );

      // Act
      const result = await service.reQueryPrompt(
        created.value.publicId,
        "new text",
      );

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LLM_ERROR");
      }

      // Verify original data is unchanged
      const original = await promptService.getPrompt(created.value.publicId);
      expect(original.ok).toBe(true);
      if (original.ok) {
        expect(original.value.text).toBe("original");
        expect(original.value.records).toHaveLength(2);
      }
    });
  });

  describe("findPrompt", () => {
    it("returns Some when prompt exists", async () => {
      // Arrange
      const created = await promptService.createPrompt("test");
      if (!created.ok) throw new Error("Setup failed");

      // Act
      const option = await promptService.findPrompt(created.value.publicId);

      // Assert
      expect(option.some).toBe(true);
      if (option.some) {
        expect(option.value.publicId).toBe(created.value.publicId);
      }
    });

    it("returns None when prompt does not exist", async () => {
      // Act
      const option = await promptService.findPrompt("nonexistent");

      // Assert
      expect(option.some).toBe(false);
    });
  });
});

describe("RecordService", () => {
  let conn: DatabaseConnection;
  let promptService: PromptService;
  let recordService: RecordService;

  beforeEach(async () => {
    conn = createDatabase({ url: ":memory:", syncUrl: null, authToken: null });
    await migrate(conn.db, { migrationsFolder: "./drizzle" });
    promptService = createPromptService(conn.db, createMockLlm());
    recordService = createRecordService(conn.db);
  });

  afterEach(() => {
    closeDatabase(conn);
  });

  describe("getRecords", () => {
    it("returns records for a prompt", async () => {
      // Arrange
      const created = await promptService.createPrompt("test");
      if (!created.ok) throw new Error("Setup failed");

      // Act
      const result = await recordService.getRecords(created.value.publicId);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }
    });

    it("returns NOT_FOUND for unknown prompt", async () => {
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
      const created = await promptService.createPrompt("test");
      if (!created.ok) throw new Error("Setup failed");
      const recordId = created.value.records[0]?.publicId ?? "";

      // Act
      const result = await recordService.updateRecord(
        created.value.publicId,
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
      const created = await promptService.createPrompt("test");
      if (!created.ok) throw new Error("Setup failed");
      const recordId = created.value.records[0]?.publicId ?? "";

      // Act
      const result = await recordService.updateRecord(
        created.value.publicId,
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
      const created = await promptService.createPrompt("test");
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
      const created = await promptService.createPrompt("test");
      if (!created.ok) throw new Error("Setup failed");
      const recordId = created.value.records[0]?.publicId ?? "";

      // Act
      const deleteResult = await recordService.deleteRecord(
        created.value.publicId,
        recordId,
      );

      // Assert
      expect(deleteResult.ok).toBe(true);

      const remaining = await recordService.getRecords(created.value.publicId);
      expect(remaining.ok).toBe(true);
      if (remaining.ok) {
        expect(remaining.value).toHaveLength(1);
      }
    });

    it("returns NOT_FOUND for unknown record", async () => {
      // Arrange
      const created = await promptService.createPrompt("test");
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
