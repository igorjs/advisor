// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { useTranslation } from "react-i18next";
import type { ApiRequestError } from "../api/client.js";

interface ErrorBannerProps {
  error: Error;
  onRetry?: () => void;
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  const { t } = useTranslation();

  const message = "code" in error
    ? getErrorMessage(error as ApiRequestError, t)
    : t("errors.generic");

  return (
    <div className="rounded-md bg-red-50 dark:bg-red-950 p-4">
      <div className="flex items-start">
        <div className="flex-1">
          <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-4 rounded-md bg-red-100 dark:bg-red-900 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 transition-colors hover:bg-red-200 dark:hover:bg-red-800"
          >
            {t("errors.retry")}
          </button>
        )}
      </div>
    </div>
  );
}

function getErrorMessage(
  error: ApiRequestError,
  t: (key: string) => string,
): string {
  switch (error.code) {
    case "LLM_TIMEOUT":
      return t("errors.timeout");
    case "RATE_LIMITED":
      return t("errors.rateLimited");
    case "VALIDATION_ERROR":
      return t("errors.validation");
    default:
      return error.message;
  }
}
