// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import OpenAI from "openai";
import { z } from "zod";
import { LLM_TIMEOUT_MS } from "../config/llm.js";
import { buildSystemPrompt } from "../config/prompts.js";
import { Err, Ok, type Result } from "../lib/result.js";
import type { DomainError } from "../lib/types.js";

// Validated against every LLM response to guarantee our DB gets clean data,
// regardless of which model or provider is configured
const responseSchema = z.object({
  records: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    }),
  ),
});

export type LlmRecord = z.infer<typeof responseSchema>["records"][number];

export interface LlmServiceConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface LlmService {
  generateRecords(
    prompt: string,
  ): Promise<Result<LlmRecord[], DomainError>>;
}

/**
 * Uses the OpenAI SDK as a universal LLM client. Any provider with an
 * OpenAI-compatible API works (OpenRouter, Google AI Studio, Ollama)
 * by changing baseUrl in the config. Zero code changes to switch providers.
 */
export function createLlmService(config: LlmServiceConfig): LlmService {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    timeout: LLM_TIMEOUT_MS,
  });

  return {
    async generateRecords(
      prompt: string,
    ): Promise<Result<LlmRecord[], DomainError>> {
      try {
        const completion = await client.chat.completions.create({
          model: config.model,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: prompt },
          ],
          // json_object mode works across all OpenAI-compatible providers.
          // OpenAI's stricter json_schema mode (zodResponseFormat) only works
          // with models that support it natively.
          response_format: { type: "json_object" },
        });

        const rawContent = completion.choices[0]?.message.content;

        if (!rawContent) {
          return Err({
            code: "LLM_PARSE_ERROR",
            message: "LLM returned an empty response.",
          });
        }

        // Some models (Gemini) wrap JSON in markdown code fences despite
        // being told not to. Strip them before parsing to stay robust.
        const content = rawContent
          .replace(/^```(?:json)?\s*\n?/i, "")
          .replace(/\n?```\s*$/i, "")
          .trim();

        const parsed = responseSchema.safeParse(JSON.parse(content));

        if (!parsed.success) {
          return Err({
            code: "LLM_PARSE_ERROR",
            message: "LLM response did not match expected schema.",
            details: parsed.error.issues,
          });
        }

        return Ok(parsed.data.records);
      } catch (error) {
        if (error instanceof OpenAI.APIError) {
          if (error.status === 429) {
            return Err({
              code: "RATE_LIMITED",
              message: "LLM rate limit exceeded. Please try again later.",
            });
          }
          return Err({
            code: "LLM_ERROR",
            message: `LLM API error: ${error.message}`,
          });
        }

        if (error instanceof SyntaxError) {
          return Err({
            code: "LLM_PARSE_ERROR",
            message: "LLM returned invalid JSON.",
          });
        }

        if (
          error instanceof Error
          && error.message.includes("timed out")
        ) {
          return Err({
            code: "LLM_TIMEOUT",
            message: "LLM request timed out. Please try again with a shorter prompt.",
          });
        }

        return Err({
          code: "LLM_ERROR",
          message: error instanceof Error ? error.message : "Unknown LLM error occurred.",
        });
      }
    },
  };
}
