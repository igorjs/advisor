import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCreatePrompt, usePrompt, useReQueryPrompt } from "../hooks/usePrompts.js";

interface PromptFormProps {
  activePromptId: string | null;
  onPromptCreated: (publicId: string) => void;
}

export function PromptForm({ activePromptId, onPromptCreated }: PromptFormProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");

  const { data: promptData } = usePrompt(activePromptId);
  const createMutation = useCreatePrompt();
  const reQueryMutation = useReQueryPrompt();

  const isLoading = createMutation.isPending || reQueryMutation.isPending;
  const isReQuery = activePromptId !== null;

  // Sync text with active prompt when it loads
  const promptText = promptData?.data.text;
  const [lastSyncedId, setLastSyncedId] = useState<string | null>(null);
  if (activePromptId && activePromptId !== lastSyncedId && promptText) {
    setText(promptText);
    setLastSyncedId(activePromptId);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    if (isReQuery && activePromptId) {
      reQueryMutation.mutate(
        { publicId: activePromptId, text: trimmed },
        { onSuccess: (data) => onPromptCreated(data.data.publicId) },
      );
    } else {
      createMutation.mutate(trimmed, {
        onSuccess: (data) => onPromptCreated(data.data.publicId),
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="prompt-input" className="block text-sm font-medium text-gray-700">
        {t("prompt.label")}
      </label>
      <textarea
        id="prompt-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("prompt.placeholder")}
        disabled={isLoading}
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
          disabled={isLoading || text.trim().length === 0}
          className="inline-flex items-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
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
          ) : isReQuery ? (
            t("prompt.requery")
          ) : (
            t("prompt.submit")
          )}
        </button>
      </div>
    </form>
  );
}
