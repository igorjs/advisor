import type { DomainError, ErrorCode } from "./types.js";

/**
 * Error class that carries structured domain error info.
 * Use this when throwing from middleware or other non-Result contexts.
 * Routes should use Result<T, DomainError> instead.
 */
export class DomainException extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown[];

  constructor(domainError: DomainError) {
    super(domainError.message);
    this.name = "DomainException";
    this.code = domainError.code;
    this.details = domainError.details;
  }

  toDomainError(): DomainError {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}
