import type { InferSelectModel } from "drizzle-orm";
import type { records } from "../db/schema.js";

type RecordRow = InferSelectModel<typeof records>;

export interface RecordResponse {
  publicId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export function toRecordResponse(row: RecordRow): RecordResponse {
  return {
    publicId: row.publicId,
    title: row.title,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
