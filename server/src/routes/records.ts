import { Hono } from "hono";
import { z } from "zod";
import { jsonError, matchResult, validationError } from "../lib/http.js";
import type { RecordService } from "../services/record.service.js";

const updateRecordSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().min(1).max(5000).optional(),
  })
  .refine((data) => data.title !== undefined || data.description !== undefined, {
    message: "At least one field (title or description) must be provided.",
  });

// No GET endpoint: records are embedded in the prompt response
// (GET /prompts/:id already returns { data: { ...prompt, records: [...] } }).
// Only mutation endpoints live here.
export function createRecordRoutes(recordService: RecordService) {
  const recordRoutes = new Hono();

  recordRoutes.patch("/:recordId", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = updateRecordSchema.safeParse(body);

    if (!parsed.success) return validationError(c, parsed.error.issues);

    const result = await recordService.updateRecord(
      c.req.param("promptId") ?? "",
      c.req.param("recordId"),
      parsed.data,
    );
    return matchResult(c, result);
  });

  recordRoutes.delete("/:recordId", async (c) => {
    const result = await recordService.deleteRecord(
      c.req.param("promptId") ?? "",
      c.req.param("recordId"),
    );

    return result.match<Response>({
      ok: () => c.body(null, 204),
      err: (error) => jsonError(c, error),
    });
  });

  return recordRoutes;
}
