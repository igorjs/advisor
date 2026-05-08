import OpenAI from "openai";
import { z } from "zod";
import { SYSTEM_PROMPT } from "../config/prompts.js";
import { Err, Ok, type Result } from "../lib/result.js";
import type { DomainError } from "../lib/types.js";

const LLM_TIMEOUT_MS = 30_000;

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
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        });

        const rawContent = completion.choices[0]?.message.content;

        if (!rawContent) {
          return Err({
            code: "LLM_PARSE_ERROR",
            message: "LLM returned an empty response.",
          });
        }

        // Strip markdown code fences if the model wraps JSON in them
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
          error instanceof Error &&
          error.message.includes("timed out")
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
