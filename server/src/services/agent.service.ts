// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import OpenAI from "openai";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/index.js";
import { conversations, messages, records } from "../db/schema.js";
import { toRecordResponse, type RecordResponse } from "../dto/record.dto.js";
import { LLM_TIMEOUT_MS } from "../config/llm.js";
import { buildSystemPrompt } from "../config/prompts.js";
import { extractRecords } from "../lib/extract-records.js";
import type { SearchService } from "./search.service.js";
import type { LlmServiceConfig } from "./llm.service.js";

// Tool definition exposed to the LLM
const WEB_SEARCH_TOOL: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current information. Use for tax rates, legislation, thresholds, government websites. Optionally scope to a specific domain.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        site: {
          type: "string",
          description:
            "Optional domain to scope the search (e.g. 'ato.gov.au'). Omit for general web search.",
        },
      },
      required: ["query"],
    },
  },
};

// Max tool-call loops to prevent infinite cycles
const MAX_TOOL_ROUNDS = 5;

/** Events emitted during the agentic loop, streamed to the client via SSE. */
export type AgentEvent =
  | { type: "assistant_delta"; content: string }
  | { type: "assistant_end"; fullContent: string }
  | { type: "tool_start"; name: string; query: string }
  | { type: "tool_result"; results: number }
  | { type: "records"; records: RecordResponse[] }
  | { type: "error"; code: string; message: string }
  | { type: "done" };

export interface AgentService {
  /**
   * Process a user message in a conversation. The agentic loop:
   * 1. Calls the LLM with full history + tools
   * 2. If LLM requests tools: execute, append results, loop
   * 3. If LLM returns text: check for JSON records or follow-up question
   * Yields AgentEvents as the loop progresses.
   */
  processMessage(
    conversationPublicId: string,
    userMessage: string,
  ): AsyncGenerator<AgentEvent>;

  /**
   * Edit a previous user message. Truncates all messages after the edited
   * message, bumps the conversation version, and re-runs the agentic loop
   * from the edited message. Existing records become stale (older version).
   */
  editMessage(
    conversationPublicId: string,
    messagePublicId: string,
    newContent: string,
  ): AsyncGenerator<AgentEvent>;
}

export function createAgentService(
  db: AppDatabase,
  llmConfig: LlmServiceConfig,
  search: SearchService,
): AgentService {
  const client = new OpenAI({
    apiKey: llmConfig.apiKey,
    baseURL: llmConfig.baseUrl,
    timeout: LLM_TIMEOUT_MS,
  });

  return {
    async *processMessage(conversationPublicId, userMessage) {
      // Resolve conversation
      const conversation = await db
        .select()
        .from(conversations)
        .where(
          and(eq(conversations.publicId, conversationPublicId), isNull(conversations.deletedAt)),
        )
        .get();

      if (!conversation) {
        yield { type: "error", code: "NOT_FOUND", message: "Conversation not found." };
        yield { type: "done" };
        return;
      }

      // Save user message
      await db
        .insert(messages)
        .values({ conversationId: conversation.id, role: "user", content: userMessage })
        .run();

      // Load full conversation history for LLM context
      const history = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .all();

      const llmMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: buildSystemPrompt() },
        ...history.map((msg) => {
          if (msg.role === "tool") {
            return {
              role: "tool" as const,
              content: msg.content,
              tool_call_id: msg.toolCallId ?? "",
            };
          }
          if (msg.role === "assistant" && msg.toolCalls) {
            return {
              role: "assistant" as const,
              content: msg.content,
              tool_calls: JSON.parse(msg.toolCalls),
            };
          }
          return {
            role: msg.role as "user" | "assistant",
            content: msg.content,
          };
        }),
      ];

      // Agentic loop: call LLM, handle tool calls, repeat until text response
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        let completion: OpenAI.ChatCompletion;

        try {
          completion = await client.chat.completions.create({
            model: llmConfig.model,
            messages: llmMessages,
            tools: [WEB_SEARCH_TOOL],
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "LLM call failed.";
          yield { type: "error", code: "LLM_ERROR", message };
          yield { type: "done" };
          return;
        }

        const choice = completion.choices[0];
        if (!choice) {
          yield { type: "error", code: "LLM_ERROR", message: "Empty LLM response." };
          yield { type: "done" };
          return;
        }

        const assistantMessage = choice.message;

        // If the LLM wants to call tools, execute them and loop
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          // Save assistant message with tool calls
          await db
            .insert(messages)
            .values({
              conversationId: conversation.id,
              role: "assistant",
              content: assistantMessage.content ?? "",
              toolCalls: JSON.stringify(assistantMessage.tool_calls),
            })
            .run();

          llmMessages.push({
            role: "assistant",
            content: assistantMessage.content ?? "",
            tool_calls: assistantMessage.tool_calls,
          });

          // Execute each tool call
          for (const toolCall of assistantMessage.tool_calls) {
            // Narrow to function tool calls (vs custom tool calls)
            if (toolCall.type !== "function") continue;
            if (toolCall.function.name !== "web_search") continue;

            const args = JSON.parse(toolCall.function.arguments) as {
              query: string;
              site?: string;
            };

            yield {
              type: "tool_start",
              name: "web_search",
              query: args.site ? `${args.query} (${args.site})` : args.query,
            };

            const searchResult = await search.search(
              args.query,
              args.site ?? null,
            );

            const resultContent = searchResult.ok
              ? JSON.stringify(searchResult.value)
              : JSON.stringify({ error: searchResult.error.message });

            const resultCount = searchResult.ok
              ? searchResult.value.length
              : 0;

            yield { type: "tool_result", results: resultCount };

            // Save tool result
            await db
              .insert(messages)
              .values({
                conversationId: conversation.id,
                role: "tool",
                content: resultContent,
                toolCallId: toolCall.id,
              })
              .run();

            llmMessages.push({
              role: "tool",
              content: resultContent,
              tool_call_id: toolCall.id,
            });
          }

          // Continue the loop: LLM will see the tool results
          continue;
        }

        // No tool calls: LLM returned a text response
        const content = assistantMessage.content ?? "";

        // Try to extract structured records from the response.
        // Models don't always return pure JSON: they may include preamble
        // text or wrap in code fences. We find the first { and last } to
        // extract the JSON object regardless of surrounding text.
        const parsed = extractRecords(content);

        if (parsed) {
          // Save assistant message
          await db
            .insert(messages)
            .values({ conversationId: conversation.id, role: "assistant", content })
            .run();

          // Delete old records and insert new ones
          await db
            .delete(records)
            .where(eq(records.conversationId, conversation.id))
            .run();

          const insertedRecords: RecordResponse[] = [];
          for (const record of parsed.records) {
            const row = await db
              .insert(records)
              .values({
                conversationId: conversation.id,
                title: record.title,
                description: record.description,
              })
              .returning()
              .get();
            if (row) insertedRecords.push(toRecordResponse(row));
          }

          // Mark conversation as updated
          await db
            .update(conversations)
            .set({ updatedAt: sql`(datetime('now'))` })
            .where(eq(conversations.id, conversation.id))
            .run();

          yield { type: "records", records: insertedRecords };
          yield { type: "done" };
          return;
        }

        // It's a follow-up question: save and return to client
        await db
          .insert(messages)
          .values({ conversationId: conversation.id, role: "assistant", content })
          .run();

        yield { type: "assistant_delta", content };
        yield { type: "assistant_end", fullContent: content };
        yield { type: "done" };
        return;
      }

      // Exhausted tool rounds without a final response
      yield {
        type: "error",
        code: "LLM_ERROR",
        message: "Too many tool calls without a final response.",
      };
      yield { type: "done" };
    },

    async *editMessage(conversationPublicId, messagePublicId, newContent) {
      // Resolve conversation
      const conversation = await db
        .select()
        .from(conversations)
        .where(
          and(eq(conversations.publicId, conversationPublicId), isNull(conversations.deletedAt)),
        )
        .get();

      if (!conversation) {
        yield { type: "error", code: "NOT_FOUND", message: "Conversation not found." };
        yield { type: "done" };
        return;
      }

      // Find the message being edited
      const targetMessage = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversation.id),
            eq(messages.publicId, messagePublicId),
          ),
        )
        .get();

      if (!targetMessage) {
        yield { type: "error", code: "NOT_FOUND", message: "Message not found." };
        yield { type: "done" };
        return;
      }

      // Truncate: delete all messages after the edited message
      await db
        .delete(messages)
        .where(
          and(
            eq(messages.conversationId, conversation.id),
            gt(messages.id, targetMessage.id),
          ),
        )
        .run();

      // Update the edited message content
      await db
        .update(messages)
        .set({ content: newContent })
        .where(eq(messages.id, targetMessage.id))
        .run();

      // Bump version on conversation so new records are distinguishable
      const currentVersion = targetMessage.version;
      const newVersion = currentVersion + 1;
      await db
        .update(conversations)
        .set({ updatedAt: sql`(datetime('now'))` })
        .where(eq(conversations.id, conversation.id))
        .run();

      // Load truncated history and run the agentic loop from here.
      // Reuse processMessage logic by yielding from it, but without
      // re-inserting the user message (it's already edited in place).
      const history = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .all();

      const llmMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: buildSystemPrompt() },
        ...history.map((msg) => {
          if (msg.role === "tool") {
            return {
              role: "tool" as const,
              content: msg.content,
              tool_call_id: msg.toolCallId ?? "",
            };
          }
          if (msg.role === "assistant" && msg.toolCalls) {
            return {
              role: "assistant" as const,
              content: msg.content,
              tool_calls: JSON.parse(msg.toolCalls),
            };
          }
          return {
            role: msg.role as "user" | "assistant",
            content: msg.content,
          };
        }),
      ];

      // Run the same agentic loop
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        let completion: OpenAI.ChatCompletion;

        try {
          completion = await client.chat.completions.create({
            model: llmConfig.model,
            messages: llmMessages,
            tools: [WEB_SEARCH_TOOL],
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "LLM call failed.";
          yield { type: "error", code: "LLM_ERROR", message };
          yield { type: "done" };
          return;
        }

        const choice = completion.choices[0];
        if (!choice) {
          yield { type: "error", code: "LLM_ERROR", message: "Empty LLM response." };
          yield { type: "done" };
          return;
        }

        const assistantMessage = choice.message;

        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          await db
            .insert(messages)
            .values({
              conversationId: conversation.id,
              role: "assistant",
              content: assistantMessage.content ?? "",
              toolCalls: JSON.stringify(assistantMessage.tool_calls),
              version: newVersion,
            })
            .run();

          llmMessages.push({
            role: "assistant",
            content: assistantMessage.content ?? "",
            tool_calls: assistantMessage.tool_calls,
          });

          for (const toolCall of assistantMessage.tool_calls) {
            if (toolCall.type !== "function") continue;
            if (toolCall.function.name !== "web_search") continue;

            const args = JSON.parse(toolCall.function.arguments) as {
              query: string;
              site?: string;
            };

            yield {
              type: "tool_start",
              name: "web_search",
              query: args.site ? `${args.query} (${args.site})` : args.query,
            };

            const searchResult = await search.search(args.query, args.site ?? null);

            const resultContent = searchResult.ok
              ? JSON.stringify(searchResult.value)
              : JSON.stringify({ error: searchResult.error.message });

            yield { type: "tool_result", results: searchResult.ok ? searchResult.value.length : 0 };

            await db
              .insert(messages)
              .values({
                conversationId: conversation.id,
                role: "tool",
                content: resultContent,
                toolCallId: toolCall.id,
                version: newVersion,
              })
              .run();

            llmMessages.push({
              role: "tool",
              content: resultContent,
              tool_call_id: toolCall.id,
            });
          }
          continue;
        }

        const content = assistantMessage.content ?? "";
        const parsed = extractRecords(content);

        if (parsed) {
          await db
            .insert(messages)
            .values({ conversationId: conversation.id, role: "assistant", content, version: newVersion })
            .run();

          // Insert new records with bumped version (old records stay as stale)
          const insertedRecords: RecordResponse[] = [];
          for (const record of parsed.records) {
            const row = await db
              .insert(records)
              .values({
                conversationId: conversation.id,
                title: record.title,
                description: record.description,
                version: newVersion,
              })
              .returning()
              .get();
            if (row) insertedRecords.push(toRecordResponse(row));
          }

          await db
            .update(conversations)
            .set({ updatedAt: sql`(datetime('now'))` })
            .where(eq(conversations.id, conversation.id))
            .run();

          yield { type: "records", records: insertedRecords };
          yield { type: "done" };
          return;
        }

        await db
          .insert(messages)
          .values({ conversationId: conversation.id, role: "assistant", content, version: newVersion })
          .run();

        yield { type: "assistant_delta", content };
        yield { type: "assistant_end", fullContent: content };
        yield { type: "done" };
        return;
      }

      yield {
        type: "error",
        code: "LLM_ERROR",
        message: "Too many tool calls without a final response.",
      };
      yield { type: "done" };
    },
  };
}

