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
