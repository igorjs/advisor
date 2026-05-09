import { useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ChatMessage as ChatMessageType } from "../types/api.js";
import { ChatMessage } from "./ChatMessage.js";

interface ChatThreadProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  onEditMessage?: (index: number, newContent: string) => void;
}

export function ChatThread({ messages, isStreaming, onEditMessage }: ChatThreadProps) {
  const { t } = useTranslation();
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Derived: scroll after render if messages changed
  const lastLength = useRef(0);
  if (messages.length !== lastLength.current) {
    lastLength.current = messages.length;
    queueMicrotask(scrollToBottom);
  }

  return (
    <div className="space-y-4">
      <ChatMessage message={{ role: "assistant", content: t("chat.greeting") }} />

      {messages.map((msg, i) => (
        <ChatMessage
          key={i}
          message={msg}
          onEdit={
            // Only user messages can be edited, and not while streaming
            msg.role === "user" && onEditMessage && !isStreaming
              ? (newContent) => onEditMessage(i, newContent)
              : undefined
          }
        />
      ))}

      {isStreaming && (
        <div className="flex items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
            AI
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3">
            <span className="flex gap-1 text-gray-400">
              <span className="animate-bounce text-lg leading-none">.</span>
              <span className="animate-bounce text-lg leading-none" style={{ animationDelay: "0.15s" }}>.</span>
              <span className="animate-bounce text-lg leading-none" style={{ animationDelay: "0.3s" }}>.</span>
            </span>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
