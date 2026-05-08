import { and, eq, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/index.js";
import { prompts, records } from "../db/schema.js";
import { toRecordResponse, type RecordResponse } from "../dto/record.dto.js";
import { fromNullable, Ok, type Result } from "../lib/result.js";
import type { DomainError } from "../lib/types.js";

export interface RecordService {
  getRecords(promptPublicId: string): Result<RecordResponse[], DomainError>;
  updateRecord(
    promptPublicId: string,
    recordPublicId: string,
    data: { title?: string; description?: string },
  ): Result<RecordResponse, DomainError>;
  deleteRecord(
    promptPublicId: string,
    recordPublicId: string,
  ): Result<null, DomainError>;
}

export function createRecordService(db: AppDatabase): RecordService {
  const resolvePromptId = (publicId: string): Result<number, DomainError> =>
    fromNullable(
      db
        .select({ id: prompts.id })
        .from(prompts)
        .where(and(eq(prompts.publicId, publicId), isNull(prompts.deletedAt)))
        .get() ?? null,
    )
      .map((row) => row.id)
      .toResult({ code: "NOT_FOUND", message: `Prompt with id '${publicId}' not found.` });

  const resolveRecord = (promptId: number, recordPublicId: string) =>
    fromNullable(
      db
        .select()
        .from(records)
        .where(
          and(
            eq(records.promptId, promptId),
            eq(records.publicId, recordPublicId),
            isNull(records.deletedAt),
          ),
        )
        .get() ?? null,
    ).toResult<DomainError>({
      code: "NOT_FOUND",
      message: `Record with id '${recordPublicId}' not found.`,
    });

  return {
    getRecords(promptPublicId) {
      return resolvePromptId(promptPublicId).map((promptId) =>
        db
          .select()
          .from(records)
          .where(and(eq(records.promptId, promptId), isNull(records.deletedAt)))
          .all()
          .map(toRecordResponse),
      );
    },

    updateRecord(promptPublicId, recordPublicId, data) {
      return resolvePromptId(promptPublicId).flatMap((promptId) =>
        resolveRecord(promptId, recordPublicId).map((record) =>
          toRecordResponse(
            db
              .update(records)
              .set({
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                updatedAt: sql`(datetime('now'))`,
              })
              .where(eq(records.id, record.id))
              .returning()
              .get(),
          ),
        ),
      );
    },

    deleteRecord(promptPublicId, recordPublicId) {
      return resolvePromptId(promptPublicId).flatMap((promptId) =>
        resolveRecord(promptId, recordPublicId).flatMap((record) => {
          db.update(records)
            .set({ deletedAt: sql`(datetime('now'))` })
            .where(eq(records.id, record.id))
            .run();
          return Ok(null);
        }),
      );
    },
  };
}
