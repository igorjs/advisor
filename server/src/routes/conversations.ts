import { Hono } from "hono";
import { z } from "zod";
import { matchResult, validationError } from "../lib/http.js";
import type { ConversationService } from "../services/conversation.service.js";

const conversationTitleSchema = z.object({
  title: z.string().min(1, "Conversation title is required").max(5000, "Title too long"),
});

export function createConversationRoutes(conversationService: ConversationService) {
  const conversationRoutes = new Hono();

  conversationRoutes.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = conversationTitleSchema.safeParse(body);

    if (!parsed.success) return validationError(c, parsed.error.issues);

    const result = await conversationService.createConversation(parsed.data.title);
    return matchResult(c, result, 201);
  });

  conversationRoutes.get("/:publicId", async (c) => {
    const result = await conversationService.getConversation(c.req.param("publicId"));
    return matchResult(c, result);
  });

  // PATCH is a pragmatic choice here, not a perfect one. This operation
  // does more than update a field: it triggers an LLM call and replaces
  // all child records. Semantically it's closer to POST .../requery
  // (a command, not a partial update).
  // TODO: refactor to POST /conversations/:publicId/requery when adding
  // a genuine PATCH for metadata-only updates (rename, tags, etc.)
  conversationRoutes.patch("/:publicId", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = conversationTitleSchema.safeParse(body);

    if (!parsed.success) return validationError(c, parsed.error.issues);

    const result = await conversationService.reQueryConversation(
      c.req.param("publicId"),
      parsed.data.title,
    );
    return matchResult(c, result);
  });

  return conversationRoutes;
}
