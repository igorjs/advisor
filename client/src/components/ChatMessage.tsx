// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatMessage as ChatMessageType } from "../types/api.js";

// Deterministic sentinel from the server: [records:N]
const RECORDS_SENTINEL = /^\[records:(\d+)]$/;

interface ChatMessageProps {
  message: ChatMessageType;
  onEdit?: (newContent: string) => void;
}

export function ChatMessage({ message, onEdit }: ChatMessageProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  function handleSave() {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.content && onEdit) {
      onEdit(trimmed);
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setEditText(message.content);
      setIsEditing(false);
    }
  }

  switch (message.role) {
    case "user":
      if (isEditing) {
        return (
          <div className="flex justify-end">
            <div className="w-[75%] space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                autoFocus
                className="w-full rounded-2xl border border-primary-300 bg-white px-4 py-3 text-sm leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setEditText(message.content); setIsEditing(false); }}
                  className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                >
                  Save & Resubmit
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="group flex items-start justify-end gap-1.5">
          {onEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="mt-2 rounded p-1 text-gray-300 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-500 group-hover:opacity-100"
              aria-label="Edit message"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
            </button>
          )}
          <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary-600 px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
            {message.content}
          </div>
        </div>
      );

    case "assistant": {
      const sentinelMatch = RECORDS_SENTINEL.exec(message.content);
      const displayContent = sentinelMatch
        ? t("chat.recordsGenerated", { count: Number(sentinelMatch[1]) })
        : message.content;

      return (
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
            AI
          </div>
          <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 text-sm leading-relaxed text-gray-800">
            {displayContent}
          </div>
        </div>
      );
    }

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
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
