import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { RecordResponse } from "../types/api.js";

interface RecordCardProps {
  record: RecordResponse;
  onUpdate: (data: { title?: string; description?: string }) => void;
  onDelete: () => void;
  isUpdating: boolean;
}

export function RecordCard({
  record,
  onUpdate,
  onDelete,
  isUpdating,
}: RecordCardProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(record.title);
  const [editDescription, setEditDescription] = useState(record.description);

  function handleSave() {
    const changes: { title?: string; description?: string } = {};
    if (editTitle !== record.title) changes.title = editTitle;
    if (editDescription !== record.description)
      changes.description = editDescription;

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

  function handleDelete() {
    if (isConfirmingDelete) {
      onDelete();
      setIsConfirmingDelete(false);
    } else {
      setIsConfirmingDelete(true);
      setTimeout(() => setIsConfirmingDelete(false), 3000);
    }
  }

  return (
    <div className="animate-fade-in rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {isEditing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            aria-label={t("records.editTitle")}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            aria-label={t("records.editDescription")}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isUpdating}
              className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {t("records.save")}
            </button>
            <button
              onClick={handleCancel}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
            >
              {t("records.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {record.title}
            </h3>
            <div className="ml-4 flex shrink-0 gap-1">
              <button
                onClick={() => setIsEditing(true)}
                className="rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                {t("records.edit")}
              </button>
              <button
                onClick={handleDelete}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  isConfirmingDelete
                    ? "bg-red-100 text-red-700"
                    : "text-gray-500 hover:bg-red-50 hover:text-red-600"
                }`}
              >
                {isConfirmingDelete
                  ? t("records.confirmDelete")
                  : t("records.delete")}
              </button>
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-600">{record.description}</p>
        </>
      )}
    </div>
  );
}
