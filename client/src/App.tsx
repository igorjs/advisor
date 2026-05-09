import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "./components/ErrorBanner.js";
import { PromptForm } from "./components/PromptForm.js";
import { RecordList } from "./components/RecordList.js";
import { RecordSkeleton } from "./components/RecordSkeleton.js";
import { usePrompt } from "./hooks/usePrompts.js";

export function App() {
  const { t } = useTranslation();
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = usePrompt(activePromptId);

  const records = data?.data.records ?? [];

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {t("app.title")}
        </h1>
        <p className="mt-2 text-sm text-gray-500">{t("app.subtitle")}</p>
      </header>

      <main className="space-y-8">
        <PromptForm
          activePromptId={activePromptId}
          onPromptCreated={setActivePromptId}
        />

        {isLoading && <RecordSkeleton />}
        {error && <ErrorBanner error={error} onRetry={() => refetch()} />}
        {activePromptId && !isLoading && !error && (
          <RecordList promptPublicId={activePromptId} records={records} />
        )}
      </main>
    </div>
  );
}
