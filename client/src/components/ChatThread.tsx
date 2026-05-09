import { useRef } from "react";
import type { ChatMessage as ChatMessageType } from "../types/api.js";
import { ChatMessage } from "./ChatMessage.js";

interface ChatThreadProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  toolStatus: string | null;
}

export function ChatThread({ messages, isStreaming, toolStatus }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive.
  // Using a ref callback on the last element instead of useEffect.
  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Derived: scroll after render if messages changed
  const lastLength = useRef(0);
  if (messages.length !== lastLength.current) {
    lastLength.current = messages.length;
    queueMicrotask(scrollToBottom);
  }

  if (messages.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      {messages.map((msg, i) => (
        <ChatMessage key={i} message={msg} />
      ))}

      {isStreaming && !toolStatus && (
        <div className="flex justify-start">
          <div className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm text-gray-400">
            <span className="inline-flex gap-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
            </span>
          </div>
        </div>
      )}

      {toolStatus && (
        <div className="flex justify-start">
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
            <svg
              className="h-3.5 w-3.5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {toolStatus}
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
