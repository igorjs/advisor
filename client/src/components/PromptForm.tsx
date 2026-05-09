import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHotkey } from "../hooks/useHotkey.js";
import { Kbd, modKey } from "./Kbd.js";

interface PromptFormProps {
  isReQuery: boolean;
  isSubmitting: boolean;
  conversationTitle: string | null;
  onSubmit: (text: string) => void;
}

export function PromptForm({ isReQuery, isSubmitting, conversationTitle, onSubmit }: PromptFormProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync text when the prompt loads after creation/re-query.
  // Derived from props during render, no useEffect needed.
  const [lastSyncedText, setLastSyncedText] = useState<string | null>(null);
  if (conversationTitle !== null && conversationTitle !== lastSyncedText) {
    setText(conversationTitle);
    setLastSyncedText(conversationTitle);
  }

  function doSubmit() {
    const trimmed = text.trim();
    if (!trimmed || isSubmitting) return;
    onSubmit(trimmed);
  }

  // Global: "/" focuses the prompt textarea
  useHotkey({
    key: "/",
    onPress: () => textareaRef.current?.focus(),
    enabled: !isSubmitting,
  });

  // Ctrl+Enter submits from anywhere
  useHotkey({
    key: "Enter",
    ctrl: true,
    onPress: doSubmit,
    enabled: !isSubmitting && text.trim().length > 0,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="prompt-input" className="block text-sm font-medium text-gray-700">
        {t("prompt.label")}
        <Kbd>/</Kbd>
      </label>
      <textarea
        ref={textareaRef}
        id="prompt-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("prompt.placeholder")}
        disabled={isSubmitting}
        rows={4}
        maxLength={5000}
        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {text.length} / 5000
        </span>
        <button
          type="submit"
          disabled={isSubmitting || text.trim().length === 0}
          className="inline-flex items-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <svg
                className="-ml-1 mr-2 h-4 w-4 animate-spin"
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
              {t("prompt.loading")}
            </>
          ) : (
            <>
              {isReQuery ? t("prompt.requery") : t("prompt.submit")}
              <Kbd>{`${modKey}+↵`}</Kbd>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
