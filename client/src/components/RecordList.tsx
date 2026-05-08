import { useDeleteRecord, useRecords, useUpdateRecord } from "../hooks/useRecords.js";
import { EmptyState } from "./EmptyState.js";
import { ErrorBanner } from "./ErrorBanner.js";
import { RecordCard } from "./RecordCard.js";
import { RecordSkeleton } from "./RecordSkeleton.js";

interface RecordListProps {
  promptPublicId: string;
}

export function RecordList({ promptPublicId }: RecordListProps) {
  const { data, isLoading, error, refetch } = useRecords(promptPublicId);
  const updateMutation = useUpdateRecord(promptPublicId);
  const deleteMutation = useDeleteRecord(promptPublicId);

  if (isLoading) {
    return <RecordSkeleton />;
  }

  if (error) {
    return <ErrorBanner error={error} onRetry={() => refetch()} />;
  }

  const records = data?.data ?? [];

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
