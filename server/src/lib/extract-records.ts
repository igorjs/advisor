// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { z } from "zod";

export const recordsSchema = z.object({
  records: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    }),
  ),
});

export type ExtractedRecords = z.infer<typeof recordsSchema>;

/**
 * Extract JSON records from LLM output that may contain preamble text,
 * code fences, or other wrapping. Finds the outermost { } and parses.
 */
export function extractRecords(content: string): ExtractedRecords | null {
  // Strip code fences first
  const stripped = content
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  // Try parsing the whole string first (fast path)
  try {
    return recordsSchema.parse(JSON.parse(stripped));
  } catch {
    // Fall through to extraction
  }

  // Find the first { and last } to extract JSON from preamble/postamble
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return recordsSchema.parse(JSON.parse(stripped.slice(start, end + 1)));
  } catch {
    return null;
  }
}
