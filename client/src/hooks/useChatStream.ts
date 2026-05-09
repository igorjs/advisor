import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { AgentEvent, ChatMessage } from "../types/api.js";

interface UseChatStreamResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  toolStatus: string | null;
  sendMessage: (promptPublicId: string, message: string) => void;
}

/**
 * Connects to the SSE chat endpoint, parses agent events, and
 * accumulates a local message list. When the agent produces records,
 * invalidates the prompt query so RecordList picks them up.
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
    async (promptPublicId: string, message: string) => {
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
          `/api/v1/prompts/${promptPublicId}/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
            signal: controller.signal,
          },
        );

        if (!response.ok || !response.body) {
          toast.error(t("errors.generic"));
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
                { role: "tool", content: `Searching: ${event.query}` },
              ]);
              break;

            case "tool_result":
              setToolStatus(null);
              break;

            case "records":
              // Records produced: invalidate prompt query so RecordList updates
              queryClient.invalidateQueries({
                queryKey: ["prompts", promptPublicId],
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

  return { messages, isStreaming, toolStatus, sendMessage };
}
