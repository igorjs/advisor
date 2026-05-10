// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { useTranslation } from "react-i18next";

export function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 px-6 py-12 text-center">
      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {t("records.empty.title")}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {t("records.empty.description")}
      </p>
    </div>
  );
}
