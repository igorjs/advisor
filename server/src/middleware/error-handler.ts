import type { ErrorHandler } from "hono";
import { DomainException } from "../lib/errors.js";
import { errorStatus } from "../lib/http.js";

/**
 * Global error handler. Catches unhandled exceptions and returns
 * structured error responses. Domain errors in the route layer
 * are handled explicitly via Result; this is the safety net for
 * errors thrown from middleware or unexpected failures.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const logger = c.get("logger");

  if (err instanceof DomainException) {
    logger?.error({ code: err.code, message: err.message }, "domain error");
    return c.json({ error: err.toDomainError() }, errorStatus(err.code));
  }

  logger?.error(
    { err: err instanceof Error ? err.message : String(err) },
    "unhandled error",
  );

  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    },
    500,
  );
};
