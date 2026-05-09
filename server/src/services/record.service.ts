// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { and, eq, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/index.js";
import { conversations, records } from "../db/schema.js";
import { toRecordResponse, type RecordResponse } from "../dto/record.dto.js";
import { Err, fromNullable, Ok, type Result } from "../lib/result.js";
import type { DomainError } from "../lib/types.js";

export interface RecordService {
  getRecords(conversationPublicId: string): Promise<Result<RecordResponse[], DomainError>>;
  updateRecord(
    conversationPublicId: string,
    recordPublicId: string,
    data: { title?: string; description?: string },
  ): Promise<Result<RecordResponse, DomainError>>;
  deleteRecord(
    conversationPublicId: string,
    recordPublicId: string,
  ): Promise<Result<null, DomainError>>;
}

export function createRecordService(db: AppDatabase): RecordService {
  const resolveConversationId = async (publicId: string): Promise<Result<number, DomainError>> => {
    const row = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.publicId, publicId), isNull(conversations.deletedAt)))
      .get();

    return fromNullable(row ?? null)
      .map((r) => r.id)
      .toResult({ code: "NOT_FOUND", message: `Conversation with id '${publicId}' not found.` });
  };

  const resolveRecord = async (conversationId: number, recordPublicId: string): Promise<Result<typeof records.$inferSelect, DomainError>> => {
    const row = await db
      .select()
      .from(records)
      .where(
        and(
          eq(records.conversationId, conversationId),
          eq(records.publicId, recordPublicId),
          isNull(records.deletedAt),
        ),
      )
      .get();

    return fromNullable(row ?? null)
      .toResult<DomainError>({ code: "NOT_FOUND", message: `Record with id '${recordPublicId}' not found.` });
  };

  return {
    async getRecords(conversationPublicId) {
      const conversationIdResult = await resolveConversationId(conversationPublicId);
      if (!conversationIdResult.ok) return Err(conversationIdResult.error);

      const rows = await db
        .select()
        .from(records)
        .where(and(eq(records.conversationId, conversationIdResult.value), isNull(records.deletedAt)))
        .all();

      return Ok(rows.map(toRecordResponse));
    },

    async updateRecord(conversationPublicId, recordPublicId, data) {
      const conversationIdResult = await resolveConversationId(conversationPublicId);
      if (!conversationIdResult.ok) return Err(conversationIdResult.error);

      const recordResult = await resolveRecord(conversationIdResult.value, recordPublicId);
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

      if (!updated) {
        return Err({ code: "INTERNAL_ERROR", message: "Failed to reload record after update." });
      }

      return Ok(toRecordResponse(updated));
    },

    async deleteRecord(conversationPublicId, recordPublicId) {
      const conversationIdResult = await resolveConversationId(conversationPublicId);
      if (!conversationIdResult.ok) return Err(conversationIdResult.error);

      const recordResult = await resolveRecord(conversationIdResult.value, recordPublicId);
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
