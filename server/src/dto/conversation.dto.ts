// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import type { InferSelectModel } from "drizzle-orm";
import type { conversations, messages } from "../db/schema.js";

type ConversationRow = InferSelectModel<typeof conversations>;
type MessageRow = InferSelectModel<typeof messages>;

export interface ConversationResponse {
  publicId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageResponse {
  publicId: string;
  role: string;
  content: string;
}

export function toConversationResponse(row: ConversationRow): ConversationResponse {
  return {
    publicId: row.publicId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Filters messages to only those relevant for the chat UI:
 * - User messages (the human's input)
 * - Assistant text responses (no tool call requests)
 * Excludes internal tool messages (raw search results JSON) and
 * assistant messages that only contain tool_calls with no text content.
 */
export function toVisibleMessages(rows: MessageRow[]): MessageResponse[] {
  return rows
    .filter((row) => {
      if (row.role === "user") return true;
      // Assistant messages: only show if they have text content and no tool calls
      if (row.role === "assistant") return row.content.length > 0 && row.toolCalls === null;
      return false;
    })
    .map((row) => ({
      publicId: row.publicId,
      role: row.role,
      content: row.content,
    }));
}
