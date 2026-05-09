import { Activity } from "react";
import { useTranslation } from "react-i18next";
import { ChatInput } from "./components/ChatInput.js";
import { ChatThread } from "./components/ChatThread.js";
import { ErrorBanner } from "./components/ErrorBanner.js";
import { PromptForm } from "./components/PromptForm.js";
import { RecordList } from "./components/RecordList.js";
import { RecordSkeleton } from "./components/RecordSkeleton.js";
import { useChatStream } from "./hooks/useChatStream.js";
import { usePromptId } from "./hooks/usePromptId.js";
import { useCreatePrompt, usePrompt, useReQueryPrompt } from "./hooks/usePrompts.js";

export function App() {
  const { t } = useTranslation();
  const [activePromptId, setActivePromptId] = usePromptId();

  const { data, isLoading, error, refetch } = usePrompt(activePromptId);
  const createMutation = useCreatePrompt();
  const reQueryMutation = useReQueryPrompt();
  const chat = useChatStream();

  // Derived
  const isSubmitting = createMutation.isPending || reQueryMutation.isPending;
  const records = data?.data.records ?? [];
  const promptText = data?.data.text ?? null;
  const promptStatus = data?.data.status ?? null;
  const hasRecords = activePromptId !== null && !isLoading && !error && records.length > 0;
  const isChatting = activePromptId !== null && promptStatus === "chatting";

  function handleSubmit(text: string) {
    if (activePromptId) {
      if (isChatting) {
        chat.sendMessage(activePromptId, text);
        return;
      }
      reQueryMutation.mutate(
        { publicId: activePromptId, text },
        { onSuccess: (res) => setActivePromptId(res.data.publicId) },
      );
    } else {
      createMutation.mutate(text, {
        onSuccess: (res) => {
          setActivePromptId(res.data.publicId);
          chat.sendMessage(res.data.publicId, text);
        },
      });
    }
  }

  // Landing: centred prompt form, no conversation yet
  if (!activePromptId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {t("app.title")}
          </h1>
          <p className="mt-2 text-sm text-gray-500">{t("app.subtitle")}</p>
        </header>
        <div className="w-full max-w-2xl">
          <PromptForm
            isReQuery={false}
            isSubmitting={isSubmitting}
            promptText={null}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    );
  }

  // Conversation layout: chat on left, records panel on right when available
  return (
    <div className="flex h-screen flex-col">
      {/* Compact header */}
      <header className="shrink-0 border-b border-gray-100 px-4 py-2.5">
        <h1 className="text-center text-lg font-semibold text-gray-900">
          {t("app.title")}
        </h1>
        <p className="text-center text-xs text-gray-400">{t("app.subtitle")}</p>
      </header>

      {isLoading && (
        <div className="p-6">
          <RecordSkeleton />
        </div>
      )}
      {error && (
        <div className="p-6">
          <ErrorBanner error={error} onRetry={() => refetch()} />
        </div>
      )}

      {/* Main content: two-column when records exist */}
      <div className={`flex min-h-0 flex-1 ${hasRecords ? "divide-x divide-gray-100" : ""}`}>
        {/* Chat column: always visible during conversation */}
        <div className={`flex flex-col ${hasRecords ? "w-1/2" : "mx-auto w-full max-w-2xl"}`}>
          {/* Scrollable chat thread */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <ChatThread
              messages={chat.messages}
              isStreaming={chat.isStreaming}
            />
          </div>

          {/* Chat input pinned to bottom of chat column */}
          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            {isChatting ? (
              <ChatInput
                onSend={(msg) => chat.sendMessage(activePromptId, msg)}
                disabled={chat.isStreaming}
              />
            ) : promptStatus === "complete" ? (
              <PromptForm
                isReQuery={true}
                isSubmitting={isSubmitting}
                promptText={promptText}
                onSubmit={handleSubmit}
              />
            ) : null}
          </div>
        </div>

        {/* Records panel: slides in from the right when strategies are ready */}
        <Activity mode={hasRecords ? "visible" : "hidden"}>
          <div className="flex w-1/2 flex-col overflow-y-auto bg-gray-50/50 px-6 py-4">
            <div className="mb-4 flex items-center gap-3 text-xs text-gray-400">
              <div className="h-px flex-1 bg-gray-200" />
              <span>{records.length} strategies</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <RecordList
              promptPublicId={activePromptId}
              records={records}
              disabled={isSubmitting || chat.isStreaming}
            />
          </div>
        </Activity>
      </div>
    </div>
  );
}
