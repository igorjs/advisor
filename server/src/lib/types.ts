// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

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
