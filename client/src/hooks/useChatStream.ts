// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { AgentEvent, ChatMessage } from "../types/api.js";

interface UseChatStreamResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  toolStatus: string | null;
  sendMessage: (conversationPublicId: string, message: string) => void;
  editMessage: (conversationPublicId: string, messageIndex: number, newContent: string) => void;
  reset: () => void;
  hydrate: (serverMessages: Array<{ role: string; content: string }>) => void;
}

/**
 * Connects to the SSE chat endpoint, parses agent events, and
 * accumulates a local message list. When the agent produces records,
 * invalidates the conversation query so RecordList picks them up.
 *
 * No useEffect: the stream is started by sendMessage (event handler),
 * not by a render cycle.
 */
export function useChatStream(): UseChatStreamResult {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (conversationPublicId: string, message: string) => {
      // Add user message to local state immediately
      setMessages((prev) => [...prev, { role: "user", content: message }]);
      setIsStreaming(true);
      setToolStatus(null);

      // Abort any previous stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(
          `/api/v1/conversations/${conversationPublicId}/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
            signal: controller.signal,
          },
        );

        if (!response.ok || !response.body) {
          const errorKey = response.status === 429 ? "errors.rateLimited" : "errors.generic";
          toast.error(t(errorKey));
          setIsStreaming(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              try {
                const event = JSON.parse(data) as AgentEvent;
                handleEvent(event);
              } catch {
                // Skip malformed events
              }
            }
          }
        }

        function handleEvent(event: AgentEvent) {
          switch (event.type) {
            case "assistant_delta":
              assistantContent += event.content;
              break;

            case "assistant_end":
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: event.fullContent },
              ]);
              assistantContent = "";
              break;

            case "tool_start":
              setToolStatus(`Searching: ${event.query}`);
              setMessages((prev) => [
                ...prev,
                { role: "tool", content: event.query, toolStatus: "loading" },
              ]);
              break;

            case "tool_result":
              setToolStatus(null);
              // Mark the last tool message as done
              setMessages((prev) =>
                prev.map((msg, i) => {
                  // Find the last loading tool message
                  const isLastLoadingTool =
                    msg.role === "tool" &&
                    msg.toolStatus === "loading" &&
                    !prev.slice(i + 1).some((m) => m.role === "tool" && m.toolStatus === "loading");
                  return isLastLoadingTool ? { role: msg.role, content: msg.content, toolStatus: "done" as const } : msg;
                }),
              );
              break;

            case "records":
              // Records produced: invalidate conversation query so RecordList updates
              queryClient.invalidateQueries({
                queryKey: ["conversations", conversationPublicId],
              });
              toast.success(t("toast.promptCreated"));
              break;

            case "error":
              toast.error(event.message);
              break;

            case "done":
              break;
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          toast.error(t("errors.generic"));
        }
      } finally {
        setIsStreaming(false);
        setToolStatus(null);
        abortRef.current = null;
      }
    },
    [queryClient, t],
  );

  // Edit a previous message: truncate local state from that point,
  // update the message content, and re-send. The server-side edit
  // endpoint handles truncation and version bumping.
  const editMessage = useCallback(
    (conversationPublicId: string, messageIndex: number, newContent: string) => {
      // Truncate messages before the edit point. sendMessage will
      // append the edited user message and start the SSE stream.
      setMessages((prev) => prev.slice(0, messageIndex));
      sendMessage(conversationPublicId, newContent);
    },
    [sendMessage],
  );

  // Clear all local state for a fresh conversation
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setIsStreaming(false);
    setToolStatus(null);
  }, []);

  // Load persisted messages from the server (e.g. after page refresh).
  // Only hydrates when local state is empty to avoid overwriting an
  // active streaming session.
  const hydrate = useCallback((serverMessages: Array<{ role: string; content: string }>) => {
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return serverMessages.map((m) => {
        const role: ChatMessage["role"] =
          m.role === "user" || m.role === "assistant" || m.role === "tool"
            ? m.role
            : "assistant";
        return { role, content: m.content };
      });
    });
  }, []);

  return { messages, isStreaming, toolStatus, sendMessage, editMessage, reset, hydrate };
}
