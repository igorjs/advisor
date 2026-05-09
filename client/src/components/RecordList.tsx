import { useDeleteRecord, useUpdateRecord } from "../hooks/useRecords.js";
import type { RecordResponse } from "../types/api.js";
import { EmptyState } from "./EmptyState.js";
import { RecordCard } from "./RecordCard.js";

interface RecordListProps {
  promptPublicId: string;
  records: RecordResponse[];
}

// Records come from the prompt query (single source of truth).
// Mutations optimistically update the prompt cache directly.
export function RecordList({ promptPublicId, records }: RecordListProps) {
  const updateMutation = useUpdateRecord(promptPublicId);
  const deleteMutation = useDeleteRecord(promptPublicId);

  if (records.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <RecordCard
          key={record.publicId}
          record={record}
          isUpdating={updateMutation.isPending}
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
