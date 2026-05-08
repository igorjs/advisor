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
  findPrompt(publicId: string): Option<PromptResponse>;
}

export function createPromptService(
  db: AppDatabase,
  llm: LlmService,
): PromptService {
  const findActivePrompt = (publicId: string) =>
    fromNullable(
      db
        .select()
        .from(prompts)
        .where(and(eq(prompts.publicId, publicId), isNull(prompts.deletedAt)))
        .get() ?? null,
    );

  const getRecordsForPrompt = (promptId: number) =>
    db
      .select()
      .from(records)
      .where(and(eq(records.promptId, promptId), isNull(records.deletedAt)))
      .all();

  const insertRecords = (promptId: number, llmRecords: Array<{ title: string; description: string }>) =>
    llmRecords.map((record) =>
      db
        .insert(records)
        .values({ promptId, title: record.title, description: record.description })
        .returning()
        .get(),
    );

  const buildResponse = (
    promptRow: typeof prompts.$inferSelect,
    recordRows: Array<typeof records.$inferSelect>,
  ): PromptWithRecords => ({
    ...toPromptResponse(promptRow),
    records: recordRows.map(toRecordResponse),
  });

  return {
    async createPrompt(text) {
      // Arrange: call LLM, then flatMap into DB operations
      const llmResult = await llm.generateRecords(text);

      return llmResult.flatMap((llmRecords) => {
        const prompt = db.insert(prompts).values({ text }).returning().get();
        const inserted = insertRecords(prompt.id, llmRecords);
        return Ok(buildResponse(prompt, inserted));
      });
    },

    async getPrompt(publicId) {
      return findActivePrompt(publicId)
        .toResult<DomainError>({
          code: "NOT_FOUND",
          message: `Prompt with id '${publicId}' not found.`,
        })
        .map((prompt) => buildResponse(prompt, getRecordsForPrompt(prompt.id)));
    },

    async reQueryPrompt(publicId, text) {
      return findActivePrompt(publicId)
        .toResult<DomainError>({
          code: "NOT_FOUND",
          message: `Prompt with id '${publicId}' not found.`,
        })
        .match({
          err: (error) => Promise.resolve(Err(error)),
          ok: async (prompt) => {
            const llmResult = await llm.generateRecords(text);

            return llmResult.flatMap((llmRecords) => {
              // Atomic: update prompt + delete old records + insert new
              const result = db.transaction((tx) => {
                tx.update(prompts)
                  .set({ text, updatedAt: sql`(datetime('now'))` })
                  .where(eq(prompts.id, prompt.id))
                  .run();

                tx.delete(records).where(eq(records.promptId, prompt.id)).run();

                const insertedRecords = llmRecords.map((record) =>
                  tx
                    .insert(records)
                    .values({ promptId: prompt.id, title: record.title, description: record.description })
                    .returning()
                    .get(),
                );

                const updated = tx
                  .select()
                  .from(prompts)
                  .where(eq(prompts.id, prompt.id))
                  .get()!;

                return buildResponse(updated, insertedRecords);
              });

              return Ok(result);
            });
          },
        });
    },

    findPrompt(publicId) {
      return findActivePrompt(publicId).map(toPromptResponse);
    },
  };
}
