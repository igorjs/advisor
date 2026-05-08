import { and, eq, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/index.js";
import { prompts, records } from "../db/schema.js";
import { toRecordResponse, type RecordResponse } from "../dto/record.dto.js";
import { Err, fromNullable, Ok, type Result } from "../lib/result.js";
import type { DomainError } from "../lib/types.js";

export interface RecordService {
  getRecords(promptPublicId: string): Promise<Result<RecordResponse[], DomainError>>;
  updateRecord(
    promptPublicId: string,
    recordPublicId: string,
    data: { title?: string; description?: string },
  ): Promise<Result<RecordResponse, DomainError>>;
  deleteRecord(
    promptPublicId: string,
    recordPublicId: string,
  ): Promise<Result<null, DomainError>>;
}

export function createRecordService(db: AppDatabase): RecordService {
  const resolvePromptId = async (publicId: string): Promise<Result<number, DomainError>> => {
    const row = await db
      .select({ id: prompts.id })
      .from(prompts)
      .where(and(eq(prompts.publicId, publicId), isNull(prompts.deletedAt)))
      .get();

    return fromNullable(row ?? null)
      .map((r) => r.id)
      .toResult({ code: "NOT_FOUND", message: `Prompt with id '${publicId}' not found.` });
  };

  const resolveRecord = async (promptId: number, recordPublicId: string): Promise<Result<typeof records.$inferSelect, DomainError>> => {
    const row = await db
      .select()
      .from(records)
      .where(
        and(
          eq(records.promptId, promptId),
          eq(records.publicId, recordPublicId),
          isNull(records.deletedAt),
        ),
      )
      .get();

    return fromNullable(row ?? null)
      .toResult<DomainError>({ code: "NOT_FOUND", message: `Record with id '${recordPublicId}' not found.` });
  };

  return {
    async getRecords(promptPublicId) {
      const promptIdResult = await resolvePromptId(promptPublicId);
      if (!promptIdResult.ok) return Err(promptIdResult.error);

      const rows = await db
        .select()
        .from(records)
        .where(and(eq(records.promptId, promptIdResult.value), isNull(records.deletedAt)))
        .all();

      return Ok(rows.map(toRecordResponse));
    },

    async updateRecord(promptPublicId, recordPublicId, data) {
      const promptIdResult = await resolvePromptId(promptPublicId);
      if (!promptIdResult.ok) return Err(promptIdResult.error);

      const recordResult = await resolveRecord(promptIdResult.value, recordPublicId);
      if (!recordResult.ok) return Err(recordResult.error);

      const updated = await db
        .update(records)
        .set({
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(records.id, recordResult.value.id))
        .returning()
        .get();

      return Ok(toRecordResponse(updated!));
    },

    async deleteRecord(promptPublicId, recordPublicId) {
      const promptIdResult = await resolvePromptId(promptPublicId);
      if (!promptIdResult.ok) return Err(promptIdResult.error);

      const recordResult = await resolveRecord(promptIdResult.value, recordPublicId);
      if (!recordResult.ok) return Err(recordResult.error);

      await db
        .update(records)
        .set({ deletedAt: sql`(datetime('now'))` })
        .where(eq(records.id, recordResult.value.id))
        .run();

      return Ok(null);
    },
  };
}
