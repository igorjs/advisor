import type { InferSelectModel } from "drizzle-orm";
import type { conversations } from "../db/schema.js";

type ConversationRow = InferSelectModel<typeof conversations>;

export interface ConversationResponse {
  publicId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export function toConversationResponse(row: ConversationRow): ConversationResponse {
  return {
    publicId: row.publicId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
