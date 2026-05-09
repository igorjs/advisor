// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { and, eq, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/index.js";
import { conversations, messages, records } from "../db/schema.js";
import { toConversationResponse, toVisibleMessages, type ConversationResponse, type MessageResponse } from "../dto/conversation.dto.js";
import { toRecordResponse, type RecordResponse } from "../dto/record.dto.js";
import { Err, fromNullable, Ok, type Option, type Result } from "../lib/result.js";
import type { DomainError } from "../lib/types.js";

export interface ConversationWithRecords extends ConversationResponse {
  records: RecordResponse[];
  messages: MessageResponse[];
}

export interface ConversationService {
  createConversation(title: string): Promise<Result<ConversationWithRecords, DomainError>>;
  getConversation(publicId: string): Promise<Result<ConversationWithRecords, DomainError>>;
  reQueryConversation(publicId: string, title: string): Promise<Result<ConversationWithRecords, DomainError>>;
  findConversation(publicId: string): Promise<Option<ConversationResponse>>;
}

export function createConversationService(
  db: AppDatabase,
): ConversationService {
  // Every query filters by deletedAt IS NULL so soft-deleted rows never
  // leak into API responses. This is the single place to enforce it.
  const findActiveConversation = async (publicId: string) => {
    const row = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.publicId, publicId), isNull(conversations.deletedAt)))
      .get();

    // fromNullable bridges the DB's nullable return into our Option type,
    // so callers use .toResult() instead of null-checking
    return fromNullable(row ?? null);
  };

  const getRecordsForConversation = async (conversationId: number) =>
    db
      .select()
      .from(records)
      .where(and(eq(records.conversationId, conversationId), isNull(records.deletedAt)))
      .all();

  const getMessagesForConversation = async (conversationId: number) =>
    db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .all();

  const buildResponse = (
    conversationRow: typeof conversations.$inferSelect,
    recordRows: Array<typeof records.$inferSelect>,
    messageRows: Array<typeof messages.$inferSelect>,
  ): ConversationWithRecords => ({
    ...toConversationResponse(conversationRow),
    records: recordRows.map(toRecordResponse),
    messages: toVisibleMessages(messageRows),
  });

  return {
    async createConversation(title) {
      // Creates the conversation row only. No LLM call here: the chat
      // endpoint handles all LLM interaction via the agentic loop. Records
      // are produced when the conversation completes.
      const conversation = await db
        .insert(conversations)
        .values({ title })
        .returning()
        .get();

      if (!conversation) {
        return Err({ code: "INTERNAL_ERROR", message: "Failed to create conversation." });
      }

      return Ok(buildResponse(conversation, [], []));
    },

    async getConversation(publicId) {
      const conversationOption = await findActiveConversation(publicId);
      const conversationResult = conversationOption.toResult<DomainError>({
        code: "NOT_FOUND",
        message: `Conversation with id '${publicId}' not found.`,
      });

      if (!conversationResult.ok) return Err(conversationResult.error);

      const conversationRecords = await getRecordsForConversation(conversationResult.value.id);
      const conversationMessages = await getMessagesForConversation(conversationResult.value.id);
      return Ok(buildResponse(conversationResult.value, conversationRecords, conversationMessages));
    },

    async reQueryConversation(publicId, title) {
      const conversationOption = await findActiveConversation(publicId);

      const conversationResult = conversationOption.toResult<DomainError>({
        code: "NOT_FOUND",
        message: `Conversation with id '${publicId}' not found.`,
      });

      if (!conversationResult.ok) return Err(conversationResult.error);

      const conversation = conversationResult.value;

      // Reset conversation: update title, clear old records and messages.
      // The chat endpoint handles the new LLM conversation from here.
      await db
        .update(conversations)
        .set({ title, updatedAt: sql`(datetime('now'))` })
        .where(eq(conversations.id, conversation.id))
        .run();

      await db.delete(records).where(eq(records.conversationId, conversation.id)).run();
      await db.delete(messages).where(eq(messages.conversationId, conversation.id)).run();

      const updated = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversation.id))
        .get();

      if (!updated) {
        return Err({ code: "INTERNAL_ERROR", message: "Failed to reload conversation after update." });
      }

      return Ok(buildResponse(updated, [], []));
    },

    async findConversation(publicId) {
      const option = await findActiveConversation(publicId);
      return option.map(toConversationResponse);
    },
  };
}
