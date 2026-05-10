// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { toast } from "sonner";
import { ApiRequestError } from "../api/client.js";

const ERROR_CODE_KEYS: Record<string, string> = {
  RATE_LIMITED: "errors.rateLimited",
  VALIDATION_ERROR: "errors.validation",
  LLM_TIMEOUT: "errors.timeout",
};

/**
 * Show a persistent error toast with the correct i18n message.
 * Matches the error code to a specific translation key, falling
 * back to the generic message for unknown errors.
 */
export function showErrorToast(error: unknown, t: (key: string) => string) {
  let key = "errors.generic";

  if (error instanceof ApiRequestError) {
    key = ERROR_CODE_KEYS[error.code] ?? "errors.generic";
  }

  toast.error(t(key), { duration: Infinity });
}

/**
 * Show a persistent error toast for an HTTP status code (used by SSE
 * responses where we don't have a parsed error body).
 */
export function showHttpErrorToast(status: number, t: (key: string) => string) {
  const key = status === 429 ? "errors.rateLimited" : "errors.generic";
  toast.error(t(key), { duration: Infinity });
}
