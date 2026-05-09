import type { ChatMessage as ChatMessageType } from "../types/api.js";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  switch (message.role) {
    case "user":
      return (
        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary-600 px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
            {message.content}
          </div>
        </div>
      );

    case "assistant":
      return (
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
            AI
          </div>
          <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 text-sm leading-relaxed text-gray-800">
            {message.content}
          </div>
        </div>
      );

    case "tool":
      return (
        <div className="flex items-center gap-2 pl-9">
          {message.toolStatus === "loading" ? (
            <svg
              className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500"
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
          ) : (
            <svg
              className="h-3.5 w-3.5 shrink-0 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span className="text-[11px] text-gray-400">{message.content}</span>
        </div>
      );
  }
}
