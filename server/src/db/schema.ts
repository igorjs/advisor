import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const prompts = sqliteTable("prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // UUIDs exposed via API instead of sequential IDs to prevent enumeration attacks
  publicId: text("public_id")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  // Nullable: populated when auth is added, enables per-tenant data isolation
  userId: text("user_id"),
  text: text("text").notNull(),
  // Tracks conversation state: 'chatting' while LLM is asking follow-ups,
  // 'complete' when structured records have been produced
  status: text("status").notNull().default("chatting"),
  // Soft delete over hard delete: preserves audit trail for future SaaS compliance
  deletedAt: text("deleted_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const records = sqliteTable("records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  // FK cascade: when a prompt is deleted, its records go with it
  promptId: integer("prompt_id")
    .notNull()
    .references(() => prompts.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Conversation history for multi-turn agentic interactions.
// The LLM sees the full message history on each turn to maintain context.
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  promptId: integer("prompt_id")
    .notNull()
    .references(() => prompts.id, { onDelete: "cascade" }),
  // 'user' = human input, 'assistant' = LLM response, 'tool' = search results
  role: text("role").notNull(),
  content: text("content").notNull(),
  // JSON array of tool calls when the LLM requests tool execution
  toolCalls: text("tool_calls"),
  // References the specific tool_call this message responds to
  toolCallId: text("tool_call_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const idempotencyKeys = sqliteTable("idempotency_keys", {
  key: text("key").primaryKey(),
  endpoint: text("endpoint").notNull(),
  response: text("response").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
