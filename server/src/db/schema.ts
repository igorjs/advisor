import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const prompts = sqliteTable("prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("public_id")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id"),
  text: text("text").notNull(),
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

export const idempotencyKeys = sqliteTable("idempotency_keys", {
  key: text("key").primaryKey(),
  endpoint: text("endpoint").notNull(),
  response: text("response").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
