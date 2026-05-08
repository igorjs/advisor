/**
 * Shared domain types used across the server.
 */

/** Application context passed through middleware. Stub for future auth. */
export interface AppContext {
  readonly userId: string | null;
  readonly requestId: string;
}

/** Structured domain error. Services return these inside Result<T, DomainError>. */
export interface DomainError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: unknown[];
}

/** Known error codes mapped to HTTP status codes in the error handler. */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "LLM_TIMEOUT"
  | "LLM_PARSE_ERROR"
  | "LLM_ERROR"
  | "INTERNAL_ERROR";

/** Maps error codes to HTTP status codes. */
export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  LLM_TIMEOUT: 504,
  LLM_PARSE_ERROR: 502,
  LLM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

/** Paginated API response wrapper. */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
}

/** Single item API response wrapper. */
export interface DataResponse<T> {
  data: T;
}

/** Structured API error response. */
export interface ErrorResponse {
  error: DomainError;
}
