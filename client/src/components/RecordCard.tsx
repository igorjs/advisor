// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHotkey } from "../hooks/useHotkey.js";
import type { RecordResponse } from "../types/api.js";
import { Kbd, modKey } from "./Kbd.js";

interface RecordCardProps {
  record: RecordResponse;
  onUpdate: (data: { title?: string; description?: string }) => void;
  onDelete: () => void;
  onFocus: () => void;
  isUpdating: boolean;
  disabled: boolean;
  focused: boolean;
}

export function RecordCard({
  record,
  onUpdate,
  onDelete,
  onFocus,
  isUpdating,
  disabled,
  focused,
}: RecordCardProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(record.title);
  const [editDescription, setEditDescription] = useState(record.description);
  const cardRef = useRef<HTMLDivElement>(null);
  // Scroll focused card into view (legitimate useEffect: DOM scroll position)
  useEffect(() => {
    if (focused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focused]);

  // E to edit, D to delete when this card is focused
  useHotkey({
    key: "e",
    onPress: () => setIsEditing(true),
    enabled: focused && !isEditing && !disabled,
  });

  useHotkey({
    key: "d",
    onPress: handleDelete,
    enabled: focused && !isEditing && !isConfirmingDelete && !disabled,
  });

  // During confirm: Y confirms, N/Enter/Escape cancels (N is the safe default)
  useHotkey({
    key: "y",
    onPress: () => {
      onDelete();
      setIsConfirmingDelete(false);
    },
    enabled: isConfirmingDelete,
  });
  useHotkey({
    key: "n",
    onPress: cancelDelete,
    enabled: isConfirmingDelete,
  });
  useHotkey({
    key: "Enter",
    onPress: cancelDelete,
    enabled: isConfirmingDelete,
  });
  useHotkey({
    key: "Escape",
    onPress: cancelDelete,
    enabled: isConfirmingDelete,
  });

  function handleSave() {
    const changes: { title?: string; description?: string } = {};
    if (editTitle !== record.title) changes.title = editTitle;
    if (editDescription !== record.description) {
      changes.description = editDescription;
    }

    if (Object.keys(changes).length > 0) {
      onUpdate(changes);
    }
    setIsEditing(false);
  }

  function handleCancel() {
    setEditTitle(record.title);
    setEditDescription(record.description);
    setIsEditing(false);
  }

  function cancelDelete() {
    setIsConfirmingDelete(false);
  }

  function handleDelete() {
    if (isConfirmingDelete) {
      onDelete();
      setIsConfirmingDelete(false);
    } else {
      setIsConfirmingDelete(true);
    }
  }

  // Keyboard handler for edit mode: Ctrl+Enter saves, Escape cancels
  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  const focusRing = focused ? "ring-2 ring-primary-500 ring-offset-1" : "";

  return (
    <div
      ref={cardRef}
      onClick={onFocus}
      className={`animate-fade-in rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm transition-shadow hover:shadow-md ${focusRing} ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      {isEditing
        ? (
          <div className="space-y-3" onKeyDown={handleEditKeyDown}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              aria-label={t("records.editTitle")}
              disabled={disabled}
              autoFocus
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-semibold focus:border-primary-500 dark:focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:focus:ring-primary-400 disabled:opacity-50"
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              aria-label={t("records.editDescription")}
              rows={3}
              disabled={disabled}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:border-primary-500 dark:focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:focus:ring-primary-400 disabled:opacity-50"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isUpdating || disabled}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                {t("records.save")}
                <Kbd>{`${modKey}+↵`}</Kbd>
              </button>
              <button
                onClick={handleCancel}
                disabled={disabled}
                className="rounded-md bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-200 disabled:opacity-50"
              >
                {t("records.cancel")}
                <Kbd>Esc</Kbd>
              </button>
            </div>
          </div>
        )
        : (
          <>
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {record.title}
              </h3>
              <div className="ml-4 flex min-w-[140px] shrink-0 justify-end gap-1">
                <button
                  onClick={() => setIsEditing(true)}
                  disabled={disabled}
                  className="rounded px-2 py-1 text-xs text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
                >
                  {t("records.edit")}
                  {focused && <Kbd>E</Kbd>}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={disabled}
                  className={`rounded px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
                    isConfirmingDelete
                      ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                      : "text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-800 hover:text-red-600"
                  }`}
                >
                  {isConfirmingDelete
                    ? (
                      <>
                        {t("records.confirmDelete")}
                        <Kbd>Y</Kbd>
                        <Kbd>N</Kbd>
                      </>
                    )
                    : (
                      <>
                        {t("records.delete")}
                        {focused && <Kbd>D</Kbd>}
                      </>
                    )}
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{record.description}</p>
          </>
        )}
    </div>
  );
}
