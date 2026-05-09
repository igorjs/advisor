import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { validationError } from "../lib/http.js";
import type { AgentService } from "../services/agent.service.js";

const chatMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000, "Message too long"),
});

const editMessageSchema = z.object({
  content: z.string().min(1, "Content is required").max(5000, "Content too long"),
});

export function createChatRoutes(agentService: AgentService) {
  const chat = new Hono();

  // SSE: new message in conversation
  chat.post("/:conversationId/chat", async (c) => {
    const conversationId = c.req.param("conversationId");
    const body = await c.req.json().catch(() => null);
    const parsed = chatMessageSchema.safeParse(body);

    if (!parsed.success) return validationError(c, parsed.error.issues);

    return streamSSE(c, async (stream) => {
      const events = agentService.processMessage(conversationId, parsed.data.message);

      for await (const event of events) {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      }
    });
  });

  // SSE: edit a previous user message, truncate and re-run
  chat.post("/:conversationId/edit/:messageId", async (c) => {
    const conversationId = c.req.param("conversationId");
    const messageId = c.req.param("messageId");
    const body = await c.req.json().catch(() => null);
    const parsed = editMessageSchema.safeParse(body);

    if (!parsed.success) return validationError(c, parsed.error.issues);

    return streamSSE(c, async (stream) => {
      const events = agentService.editMessage(
        conversationId,
        messageId,
        parsed.data.content,
      );

      for await (const event of events) {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      }
    });
  });

  return chat;
}
