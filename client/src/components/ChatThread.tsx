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
    <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
      {messages.map((msg, i) => (
        <ChatMessage key={i} message={msg} />
      ))}

      {isStreaming && !toolStatus && (
        <div className="flex items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
            AI
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
            <span className="flex gap-1 text-gray-400">
              <span className="animate-bounce text-lg leading-none">.</span>
              <span className="animate-bounce text-lg leading-none" style={{ animationDelay: "0.15s" }}>.</span>
              <span className="animate-bounce text-lg leading-none" style={{ animationDelay: "0.3s" }}>.</span>
            </span>
          </div>
        </div>
      )}

      {toolStatus && (
        <div className="flex items-start gap-2.5 pl-9">
          <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-600">
            <svg
              className="h-3 w-3 animate-spin"
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
