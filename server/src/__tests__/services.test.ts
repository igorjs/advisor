import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, createDatabase, type DatabaseConnection } from "../db/index.js";
import { eq } from "drizzle-orm";
import { prompts, records } from "../db/schema.js";
import { createPromptService, type PromptService } from "../services/prompt.service.js";
import { createRecordService, type RecordService } from "../services/record.service.js";

describe("PromptService", () => {
  let conn: DatabaseConnection;
  let promptService: PromptService;

  beforeEach(async () => {
    conn = createDatabase({ url: ":memory:", syncUrl: null, authToken: null });
    await migrate(conn.db, { migrationsFolder: "./drizzle" });
    promptService = createPromptService(conn.db);
  });

  afterEach(() => {
    closeDatabase(conn);
  });

  describe("createPrompt", () => {
    it("creates a prompt with chatting status and empty records", async () => {
      // Act
      const result = await promptService.createPrompt("Give me tax advice");

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.text).toBe("Give me tax advice");
        expect(result.value.publicId).toBeTruthy();
        expect(result.value.records).toHaveLength(0);
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
        expect(result.value.records).toHaveLength(0);
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
    it("resets prompt text and status to chatting", async () => {
      // Arrange
      const created = await promptService.createPrompt("original prompt");
      if (!created.ok) throw new Error("Setup failed");

      // Act
      const result = await promptService.reQueryPrompt(
        created.value.publicId,
        "updated prompt",
      );

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.text).toBe("updated prompt");
        expect(result.value.publicId).toBe(created.value.publicId);
        expect(result.value.records).toHaveLength(0);
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
    promptService = createPromptService(conn.db);
    recordService = createRecordService(conn.db);
  });

  // Seed records directly since createPrompt no longer calls LLM.
  // Returns the prompt publicId and record publicIds for use in tests.
  async function seedPromptWithRecords() {
    const created = await promptService.createPrompt("test");
    if (!created.ok) throw new Error("Setup failed");

    const prompt = await conn.db.select().from(prompts).where(eq(prompts.publicId, created.value.publicId)).get();
    if (!prompt) throw new Error("Prompt not found");

    const r1 = await conn.db.insert(records).values({ promptId: prompt.id, title: "Tip 1", description: "First tip" }).returning().get();
    const r2 = await conn.db.insert(records).values({ promptId: prompt.id, title: "Tip 2", description: "Second tip" }).returning().get();

    return {
      promptPublicId: created.value.publicId,
      recordPublicIds: [r1!.publicId, r2!.publicId],
    };
  }

  afterEach(() => {
    closeDatabase(conn);
  });

  describe("getRecords", () => {
    it("returns records for a prompt", async () => {
      // Arrange
      const { promptPublicId } = await seedPromptWithRecords();

      // Act
      const result = await recordService.getRecords(promptPublicId);

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
      const { promptPublicId, recordPublicIds } = await seedPromptWithRecords();
      const recordId = recordPublicIds[0] ?? "";

      // Act
      const result = await recordService.updateRecord(
        promptPublicId,
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
      const { promptPublicId, recordPublicIds } = await seedPromptWithRecords();
      const recordId = recordPublicIds[0] ?? "";

      // Act
      const result = await recordService.updateRecord(
        promptPublicId,
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
      const { promptPublicId, recordPublicIds } = await seedPromptWithRecords();
      const recordId = recordPublicIds[0] ?? "";

      // Act
      const deleteResult = await recordService.deleteRecord(
        promptPublicId,
        recordId,
      );

      // Assert
      expect(deleteResult.ok).toBe(true);

      const remaining = await recordService.getRecords(promptPublicId);
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
