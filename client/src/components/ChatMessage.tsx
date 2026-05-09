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
          <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-relaxed text-gray-800 shadow-sm ring-1 ring-gray-100">
            {message.content}
          </div>
        </div>
      );

    case "tool":
      return (
        <div className="flex items-start gap-2.5 pl-9">
          <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] text-gray-400">
            <svg
              className="h-3 w-3 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            {message.content}
          </div>
        </div>
      );
  }
}
