import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Kbd, modKey } from "./Kbd.js";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");

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
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("chat.placeholder")}
        disabled={disabled}
        autoFocus
        className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500"
      />
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
