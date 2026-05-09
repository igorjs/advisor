// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHotkey } from "../hooks/useHotkey.js";
import { Kbd, modKey } from "./Kbd.js";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useHotkey({
    key: "/",
    onPress: () => inputRef.current?.focus(),
    enabled: !disabled,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.placeholder")}
          disabled={disabled}
          autoFocus
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500"
        />
        {/* Kbd hint: fades out when input has text or is focused */}
        {text.length === 0 && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Kbd>/</Kbd>
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={disabled || text.trim().length === 0}
        className="inline-flex items-center gap-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("chat.send")}
        <Kbd>{`${modKey}+↵`}</Kbd>
      </button>
    </form>
  );
}
