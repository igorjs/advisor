import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Root entity: a conversation between the user and the AI advisor.
// Previously called "prompts", renamed because a conversation is multi-turn,
// not a single prompt. The first user message serves as the title.
export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // UUIDs exposed via API instead of sequential IDs to prevent enumeration attacks
  publicId: text("public_id")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  // Nullable: populated when auth is added, enables per-tenant data isolation
  userId: text("user_id"),
  // First user message, used as the conversation title
  title: text("title").notNull(),
  // Soft delete over hard delete: preserves audit trail for future SaaS compliance
  deletedAt: text("deleted_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Conversation messages. Each turn in the multi-turn conversation.
// The LLM sees the full history on each call to maintain context.
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  // 'user' = human input, 'assistant' = LLM response, 'tool' = search results
  role: text("role").notNull(),
  content: text("content").notNull(),
  // Incremented when a user edits a previous message and the conversation
  // forks from that point. Records tied to older versions become stale.
  version: integer("version").notNull().default(1),
  // JSON array of tool calls when the LLM requests tool execution
  toolCalls: text("tool_calls"),
  // References the specific tool_call this message responds to
  toolCallId: text("tool_call_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Structured advisory records produced by the agent.
// Each set belongs to a specific conversation version: when the user edits
// a message and re-runs, new records get a higher version. Older records
// stay in the DB but are marked stale in the UI.
export const records = sqliteTable("records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  // FK cascade: when a conversation is deleted, its records go with it
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  // Ties records to the conversation version that produced them
  version: integer("version").notNull().default(1),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
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
