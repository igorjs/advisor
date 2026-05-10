// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { useCallback, useRef, useState } from "react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus on mount: ref callback fires when the DOM element appears,
  // unlike autoFocus which only works on initial page load
  const mountRef = useCallback((el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
    el?.focus();
  }, []);

  useHotkey({
    key: "/",
    onPress: () => textareaRef.current?.focus(),
    enabled: !disabled,
  });

  function doSubmit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    // Reset height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Cmd/Ctrl+Enter submits; plain Enter adds a newline (default textarea)
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      doSubmit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    // Auto-resize: reset to auto then set to scrollHeight
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); doSubmit(); }} className="flex items-start gap-2">
      <div className="relative flex-1">
        <textarea
          ref={mountRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.placeholder")}
          disabled={disabled}
          rows={1}
          className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm leading-relaxed shadow-sm transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500"
        />
        {text.length === 0 && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Kbd>/</Kbd>
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={disabled || text.trim().length === 0}
        className="inline-flex h-[42px] shrink-0 items-center gap-1 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("chat.send")}
        <Kbd>{`${modKey}+↵`}</Kbd>
      </button>
    </form>
  );
}
