import { Activity, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "./components/ErrorBanner.js";
import { PromptForm } from "./components/PromptForm.js";
import { RecordList } from "./components/RecordList.js";
import { RecordSkeleton } from "./components/RecordSkeleton.js";
import { useCreatePrompt, usePrompt, useReQueryPrompt } from "./hooks/usePrompts.js";

export function App() {
  const { t } = useTranslation();
  const [activePromptId, setActivePromptId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = usePrompt(activePromptId);
  const createMutation = useCreatePrompt();
  const reQueryMutation = useReQueryPrompt();

  // Derived: no useEffect, no synchronised state
  const isSubmitting = createMutation.isPending || reQueryMutation.isPending;
  const records = data?.data.records ?? [];
  const promptText = data?.data.text ?? null;
  const hasRecords = activePromptId !== null && !isLoading && !error;

  function handleSubmit(text: string) {
    if (activePromptId) {
      reQueryMutation.mutate(
        { publicId: activePromptId, text },
        { onSuccess: (res) => setActivePromptId(res.data.publicId) },
      );
    } else {
      createMutation.mutate(text, {
        onSuccess: (res) => setActivePromptId(res.data.publicId),
      });
    }
  }

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
          isReQuery={activePromptId !== null}
          isSubmitting={isSubmitting}
          promptText={promptText}
          onSubmit={handleSubmit}
        />

        {isLoading && <RecordSkeleton />}
        {error && <ErrorBanner error={error} onRetry={() => refetch()} />}

        {/* Activity preserves RecordList state (inline edits, scroll position)
            during background refetches that briefly set isLoading=true */}
        <Activity mode={hasRecords ? "visible" : "hidden"}>
          {activePromptId && (
            <RecordList
              promptPublicId={activePromptId}
              records={records}
              disabled={isSubmitting}
            />
          )}
        </Activity>
      </main>
    </div>
  );
}
