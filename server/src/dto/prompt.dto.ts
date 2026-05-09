import type { InferSelectModel } from "drizzle-orm";
import type { prompts } from "../db/schema.js";

type PromptRow = InferSelectModel<typeof prompts>;

export interface PromptResponse {
  publicId: string;
  text: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function toPromptResponse(row: PromptRow): PromptResponse {
  return {
    publicId: row.publicId,
    text: row.text,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
