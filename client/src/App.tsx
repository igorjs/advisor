// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { Activity, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ChatMessage, MessageResponse } from "./types/api.js";

function isValidRole(role: string): role is ChatMessage["role"] {
  return role === "user" || role === "assistant" || role === "tool";
}

function toChatMessage(m: MessageResponse): ChatMessage {
  return { role: isValidRole(m.role) ? m.role : "assistant", content: m.content };
}
import { ChatInput } from "./components/ChatInput.js";
import { ChatThread } from "./components/ChatThread.js";
import { ErrorBanner } from "./components/ErrorBanner.js";
import { PromptForm } from "./components/PromptForm.js";
import { RecordList } from "./components/RecordList.js";
import { RecordSkeleton } from "./components/RecordSkeleton.js";
import { useChatStream } from "./hooks/useChatStream.js";
import { useConversationId } from "./hooks/useConversationId.js";
import { useConversation, useCreateConversation } from "./hooks/useConversations.js";

export function App() {
  const { t } = useTranslation();
  const [activeConversationId, setActiveConversationId] = useConversationId();

  const { data, isLoading, error, refetch } = useConversation(activeConversationId);
  const createMutation = useCreateConversation();
  const chat = useChatStream();

  // Derived
  const records = data?.data.records ?? [];
  const serverMessages = data?.data.messages ?? [];
  const hasRecords = activeConversationId !== null && !isLoading && !error && records.length > 0;

  // Display messages: prefer live stream (active session), fall back to
  // server data (page refresh). Pure derivation, no setState during render.
  const displayMessages: ChatMessage[] = useMemo(() => {
    if (chat.messages.length > 0) return chat.messages;
    return serverMessages.map(toChatMessage);
  }, [chat.messages, serverMessages]);

  function handleNewChat() {
    chat.reset();
    setActiveConversationId(null);
  }

  function handleSubmit(text: string) {
    if (activeConversationId) {
      // After page refresh, local stream is empty. Hydrate from server
      // history before appending the new message so context is preserved.
      if (chat.messages.length === 0 && serverMessages.length > 0) {
        chat.hydrate(serverMessages);
      }
      chat.sendMessage(activeConversationId, text);
    } else {
      // Starting a new conversation: clear any stale messages first
      chat.reset();
      createMutation.mutate(text, {
        onSuccess: (res) => {
          setActiveConversationId(res.data.publicId);
          chat.sendMessage(res.data.publicId, text);
        },
      });
    }
  }

  // Landing: centred prompt form, no conversation yet.
  // Once submitting, skip to conversation view so the user sees the
  // chat layout immediately instead of a stale empty form.
  if (!activeConversationId && !createMutation.isPending) {
    return (
      <div className="flex min-h-screen animate-fade-in flex-col items-center justify-center px-4">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {t("app.title")}
          </h1>
          <p className="mt-2 text-sm text-gray-500">{t("app.subtitle")}</p>
        </header>
        <div className="w-full max-w-2xl">
          <PromptForm
            isReQuery={false}
            isSubmitting={false}
            conversationTitle={null}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    );
  }

  // Safe ID for components (empty string during the brief pending->created window)
  const conversationId = activeConversationId ?? "";

  // Conversation layout: chat on left, records panel on right when available
  return (
    <div className="flex h-screen animate-fade-in flex-col">
      {/* Header with New Chat button */}
      <header className="flex shrink-0 items-center border-b border-gray-100 px-4 py-2.5">
        <button
          onClick={handleNewChat}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t("chat.newChat")}
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-lg font-semibold text-gray-900">
            {t("app.title")}
          </h1>
          <p className="text-xs text-gray-400">{t("app.subtitle")}</p>
        </div>
        {/* Spacer to balance the button on the left */}
        <div className="w-[100px]" />
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
              messages={displayMessages}
              isStreaming={chat.isStreaming}
              onEditMessage={(index, newContent) =>
                chat.editMessage(conversationId, index, newContent)
              }
            />
          </div>

          {/* Chat input pinned at bottom */}
          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <ChatInput
              onSend={handleSubmit}
              disabled={chat.isStreaming}
            />
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
              conversationPublicId={conversationId}
              records={records}
              disabled={chat.isStreaming}
            />
          </div>
        </Activity>
      </div>
    </div>
  );
}
