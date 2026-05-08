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

export function createRecordRoutes(recordService: RecordService) {
  const records = new Hono();

  records.get("/", (c) => {
    const promptId = c.req.param("promptId") ?? "";

    return matchResult(
      c,
      recordService.getRecords(promptId).map((recs) => ({
        records: recs,
        meta: { total: recs.length, page: 1, pageSize: recs.length },
      })),
    );
  });

  records.patch("/:recordId", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = updateRecordSchema.safeParse(body);

    if (!parsed.success) return validationError(c, parsed.error.issues);

    const result = recordService.updateRecord(
      c.req.param("promptId") ?? "",
      c.req.param("recordId"),
      parsed.data,
    );
    return matchResult(c, result);
  });

  records.delete("/:recordId", (c) => {
    const result = recordService.deleteRecord(
      c.req.param("promptId") ?? "",
      c.req.param("recordId"),
    );

    return result.match<Response>({
      ok: () => c.body(null, 204),
      err: (error) => jsonError(c, error),
    });
  });

  return records;
}
