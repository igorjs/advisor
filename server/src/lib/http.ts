/**
 * HTTP response helpers that bridge Result<T, DomainError> to Hono responses.
 * Routes stay thin: validate input, call service, pass Result to matchResult().
 * No try/catch in route handlers because services never throw.
 */

import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { DomainError, ErrorCode } from "./types.js";
import type { Result } from "./result.js";

const STATUS_MAP: Record<ErrorCode, ContentfulStatusCode> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  LLM_TIMEOUT: 504,
  LLM_PARSE_ERROR: 502,
  LLM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

/** Map a DomainError to its HTTP status code. */
export function errorStatus(code: ErrorCode): ContentfulStatusCode {
  return STATUS_MAP[code];
}

/** Return a JSON error response from a DomainError. */
export function jsonError(c: Context, error: DomainError): Response {
  return c.json({ error }, errorStatus(error.code));
}

/**
 * Map a Result<T, DomainError> to an HTTP response using match.
 * Ok -> { data: T } with successStatus
 * Err -> { error } with mapped status code
 */
export function matchResult<T>(
  c: Context,
  result: Result<T, DomainError>,
  successStatus: ContentfulStatusCode = 200,
): Response {
  return result.match<Response>({
    ok: (value) => c.json({ data: value }, successStatus),
    err: (error) => c.json({ error }, errorStatus(error.code)),
  });
}

/** Return a structured validation error response. */
export function validationError(c: Context, issues: ReadonlyArray<{ message: string }>): Response {
  return c.json(
    {
      error: {
        code: "VALIDATION_ERROR" satisfies ErrorCode,
        message: "Invalid request body.",
        details: issues,
      },
    },
    400,
  );
}
