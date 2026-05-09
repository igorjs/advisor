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
      // If the conversation is active, send via chat stream
      if (isChatting) {
        chat.sendMessage(activePromptId, text);
        return;
      }
      // Otherwise re-query (replace records)
      reQueryMutation.mutate(
        { publicId: activePromptId, text },
        { onSuccess: (res) => setActivePromptId(res.data.publicId) },
      );
    } else {
      // First message: create prompt, then send to chat
      createMutation.mutate(text, {
        onSuccess: (res) => {
          setActivePromptId(res.data.publicId);
          chat.sendMessage(res.data.publicId, text);
        },
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

      <main className="space-y-6">
        {/* Initial prompt form: shown when no active conversation */}
        {!activePromptId && (
          <PromptForm
            isReQuery={false}
            isSubmitting={isSubmitting}
            promptText={null}
            onSubmit={handleSubmit}
          />
        )}

        {isLoading && <RecordSkeleton />}
        {error && <ErrorBanner error={error} onRetry={() => refetch()} />}

        {/* Chat thread: shows conversation history */}
        {activePromptId && chat.messages.length > 0 && (
          <ChatThread
            messages={chat.messages}
            isStreaming={chat.isStreaming}
            toolStatus={chat.toolStatus}
          />
        )}

        {/* Chat input: shown during active conversation */}
        {isChatting && (
          <ChatInput
            onSend={(msg) => chat.sendMessage(activePromptId, msg)}
            disabled={chat.isStreaming}
          />
        )}

        {/* Records appear when the conversation completes */}
        <Activity mode={hasRecords ? "visible" : "hidden"}>
          {activePromptId && (
            <>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <div className="h-px flex-1 bg-gray-200" />
                <span>{records.length} strategies</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <RecordList
                promptPublicId={activePromptId}
                records={records}
                disabled={isSubmitting || chat.isStreaming}
              />
            </>
          )}
        </Activity>

        {/* Re-query form: shown after records are produced */}
        {activePromptId && promptStatus === "complete" && (
          <PromptForm
            isReQuery={true}
            isSubmitting={isSubmitting}
            promptText={promptText}
            onSubmit={handleSubmit}
          />
        )}
      </main>
    </div>
  );
}
