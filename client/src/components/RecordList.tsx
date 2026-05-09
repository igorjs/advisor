// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { useCallback, useRef, useState } from "react";
import { useDeleteRecord, useUpdateRecord } from "../hooks/useRecords.js";
import { useHotkey } from "../hooks/useHotkey.js";
import type { RecordResponse } from "../types/api.js";
import { EmptyState } from "./EmptyState.js";
import { Kbd } from "./Kbd.js";
import { RecordCard } from "./RecordCard.js";

interface RecordListProps {
  conversationPublicId: string;
  records: RecordResponse[];
  disabled: boolean;
}

// Records come from the conversation query (single source of truth).
// Mutations optimistically update the conversation cache directly.
export function RecordList({ conversationPublicId, records, disabled }: RecordListProps) {
  const updateMutation = useUpdateRecord(conversationPublicId);
  const deleteMutation = useDeleteRecord(conversationPublicId);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isFocused = focusedIndex !== null;

  const moveUp = useCallback(() => {
    setFocusedIndex((prev) => {
      if (prev === null) return records.length - 1;
      return prev > 0 ? prev - 1 : records.length - 1;
    });
  }, [records.length]);

  const moveDown = useCallback(() => {
    setFocusedIndex((prev) => {
      if (prev === null) return 0;
      return prev < records.length - 1 ? prev + 1 : 0;
    });
  }, [records.length]);

  const clearFocus = useCallback(() => setFocusedIndex(null), []);

  // J/K and arrow keys to navigate the list
  useHotkey({ key: "j", onPress: moveDown, enabled: !disabled });
  useHotkey({ key: "k", onPress: moveUp, enabled: !disabled });
  useHotkey({ key: "ArrowDown", onPress: moveDown, enabled: !disabled });
  useHotkey({ key: "ArrowUp", onPress: moveUp, enabled: !disabled });
  useHotkey({ key: "Escape", onPress: clearFocus, enabled: isFocused });

  if (records.length === 0) {
    return <EmptyState />;
  }

  return (
    <div ref={listRef} className="space-y-3">
      <div className="flex items-center justify-end gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          Navigate <Kbd>J</Kbd><Kbd>K</Kbd>
        </span>
      </div>
      {records.map((record, index) => (
        <RecordCard
          key={record.publicId}
          record={record}
          isUpdating={updateMutation.isPending}
          disabled={disabled}
          focused={focusedIndex === index}
          onFocus={() => setFocusedIndex(index)}
          onUpdate={(updateData) =>
            updateMutation.mutate({
              recordPublicId: record.publicId,
              data: updateData,
            })
          }
          onDelete={() => deleteMutation.mutate(record.publicId)}
        />
      ))}
    </div>
  );
}
