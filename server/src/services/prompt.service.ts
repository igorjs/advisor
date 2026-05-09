import { and, eq, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/index.js";
import { messages, prompts, records } from "../db/schema.js";
import { toPromptResponse, type PromptResponse } from "../dto/prompt.dto.js";
import { toRecordResponse, type RecordResponse } from "../dto/record.dto.js";
import { Err, fromNullable, Ok, type Option, type Result } from "../lib/result.js";
import type { DomainError } from "../lib/types.js";

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
): PromptService {
  // Every query filters by deletedAt IS NULL so soft-deleted rows never
  // leak into API responses. This is the single place to enforce it.
  const findActivePrompt = async (publicId: string) => {
    const row = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.publicId, publicId), isNull(prompts.deletedAt)))
      .get();

    // fromNullable bridges the DB's nullable return into our Option type,
    // so callers use .toResult() instead of null-checking
    return fromNullable(row ?? null);
  };

  const getRecordsForPrompt = async (promptId: number) =>
    db
      .select()
      .from(records)
      .where(and(eq(records.promptId, promptId), isNull(records.deletedAt)))
      .all();

  const buildResponse = (
    promptRow: typeof prompts.$inferSelect,
    recordRows: Array<typeof records.$inferSelect>,
  ): PromptWithRecords => ({
    ...toPromptResponse(promptRow),
    records: recordRows.map(toRecordResponse),
  });

  return {
    async createPrompt(text) {
      // Creates the prompt row only. No LLM call here: the chat endpoint
      // handles all LLM interaction via the agentic loop. Records are
      // produced when the conversation completes.
      const prompt = await db
        .insert(prompts)
        .values({ text, status: "chatting" })
        .returning()
        .get();

      return Ok(buildResponse(prompt!, []));
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

      // Reset prompt: update text, clear old records and messages,
      // set status back to chatting. The chat endpoint handles the new
      // LLM conversation from here.
      await db
        .update(prompts)
        .set({ text, status: "chatting", updatedAt: sql`(datetime('now'))` })
        .where(eq(prompts.id, prompt.id))
        .run();

      await db.delete(records).where(eq(records.promptId, prompt.id)).run();
      await db.delete(messages).where(eq(messages.promptId, prompt.id)).run();

      const updated = await db
        .select()
        .from(prompts)
        .where(eq(prompts.id, prompt.id))
        .get();

      return Ok(buildResponse(updated!, []));
    },

    async findPrompt(publicId) {
      const option = await findActivePrompt(publicId);
      return option.map(toPromptResponse);
    },
  };
}
