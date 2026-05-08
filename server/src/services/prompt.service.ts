import { and, eq, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/index.js";
import { prompts, records } from "../db/schema.js";
import { toPromptResponse, type PromptResponse } from "../dto/prompt.dto.js";
import { toRecordResponse, type RecordResponse } from "../dto/record.dto.js";
import { Err, fromNullable, Ok, type Option, type Result } from "../lib/result.js";
import type { DomainError } from "../lib/types.js";
import type { LlmService } from "./llm.service.js";

export interface PromptWithRecords extends PromptResponse {
  records: RecordResponse[];
}

export interface PromptService {
  createPrompt(text: string): Promise<Result<PromptWithRecords, DomainError>>;
  getPrompt(publicId: string): Promise<Result<PromptWithRecords, DomainError>>;
  reQueryPrompt(publicId: string, text: string): Promise<Result<PromptWithRecords, DomainError>>;
  findPrompt(publicId: string): Promise<Option<PromptResponse>>;
}

export function createPromptService(
  db: AppDatabase,
  llm: LlmService,
): PromptService {
  const findActivePrompt = async (publicId: string) => {
    const row = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.publicId, publicId), isNull(prompts.deletedAt)))
      .get();

    return fromNullable(row ?? null);
  };

  const getRecordsForPrompt = async (promptId: number) =>
    db
      .select()
      .from(records)
      .where(and(eq(records.promptId, promptId), isNull(records.deletedAt)))
      .all();

  const insertRecords = async (
    promptId: number,
    llmRecords: Array<{ title: string; description: string }>,
  ) => {
    const results = [];
    for (const record of llmRecords) {
      const row = await db
        .insert(records)
        .values({ promptId, title: record.title, description: record.description })
        .returning()
        .get();
      results.push(row!);
    }
    return results;
  };

  const buildResponse = (
    promptRow: typeof prompts.$inferSelect,
    recordRows: Array<typeof records.$inferSelect>,
  ): PromptWithRecords => ({
    ...toPromptResponse(promptRow),
    records: recordRows.map(toRecordResponse),
  });

  return {
    async createPrompt(text) {
      const llmResult = await llm.generateRecords(text);

      if (!llmResult.ok) return Err(llmResult.error);

      const prompt = await db.insert(prompts).values({ text }).returning().get();
      const inserted = await insertRecords(prompt!.id, llmResult.value);

      return Ok(buildResponse(prompt!, inserted));
    },

    async getPrompt(publicId) {
      const promptOption = await findActivePrompt(publicId);
      const promptResult = promptOption.toResult<DomainError>({
        code: "NOT_FOUND",
        message: `Prompt with id '${publicId}' not found.`,
      });

      if (!promptResult.ok) return Err(promptResult.error);

      const promptRecords = await getRecordsForPrompt(promptResult.value.id);
      return Ok(buildResponse(promptResult.value, promptRecords));
    },

    async reQueryPrompt(publicId, text) {
      const promptOption = await findActivePrompt(publicId);

      const promptResult = promptOption.toResult<DomainError>({
        code: "NOT_FOUND",
        message: `Prompt with id '${publicId}' not found.`,
      });

      if (!promptResult.ok) return Err(promptResult.error);

      const prompt = promptResult.value;
      const llmResult = await llm.generateRecords(text);

      if (!llmResult.ok) return Err(llmResult.error);

      // Atomic: update prompt + delete old records + insert new
      await db
        .update(prompts)
        .set({ text, updatedAt: sql`(datetime('now'))` })
        .where(eq(prompts.id, prompt.id))
        .run();

      await db.delete(records).where(eq(records.promptId, prompt.id)).run();

      const insertedRecords = await insertRecords(prompt.id, llmResult.value);

      const updated = await db
        .select()
        .from(prompts)
        .where(eq(prompts.id, prompt.id))
        .get();

      return Ok(buildResponse(updated!, insertedRecords));
    },

    async findPrompt(publicId) {
      const option = await findActivePrompt(publicId);
      return option.map(toPromptResponse);
    },
  };
}
