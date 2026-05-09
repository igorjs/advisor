import { Hono } from "hono";
import { z } from "zod";
import { matchResult, validationError } from "../lib/http.js";
import type { PromptService } from "../services/prompt.service.js";

const promptTextSchema = z.object({
  text: z.string().min(1, "Prompt text is required").max(5000, "Prompt too long"),
});

export function createPromptRoutes(promptService: PromptService) {
  const prompts = new Hono();

  prompts.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = promptTextSchema.safeParse(body);

    if (!parsed.success) return validationError(c, parsed.error.issues);

    const result = await promptService.createPrompt(parsed.data.text);
    return matchResult(c, result, 201);
  });

  prompts.get("/:publicId", async (c) => {
    const result = await promptService.getPrompt(c.req.param("publicId"));
    return matchResult(c, result);
  });

  // PATCH is a pragmatic choice here, not a perfect one. This operation
  // does more than update a field: it triggers an LLM call and replaces
  // all child records. Semantically it's closer to POST .../requery
  // (a command, not a partial update).
  // TODO: refactor to POST /prompts/:publicId/requery when adding
  // a genuine PATCH for metadata-only updates (rename, tags, etc.)
  prompts.patch("/:publicId", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = promptTextSchema.safeParse(body);

    if (!parsed.success) return validationError(c, parsed.error.issues);

    const result = await promptService.reQueryPrompt(
      c.req.param("publicId"),
      parsed.data.text,
    );
    return matchResult(c, result);
  });

  return prompts;
}
