import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { validationError } from "../lib/http.js";
import type { AgentService } from "../services/agent.service.js";

const chatMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000, "Message too long"),
});

export function createChatRoutes(agentService: AgentService) {
  const chat = new Hono();

  // SSE endpoint: streams agent events as the agentic loop progresses.
  // The client receives real-time updates for tool execution, follow-up
  // questions, and final record generation.
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

  return chat;
}
