import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { deleteRecord, getRecords, updateRecord } from "../api/records.js";
import type { PaginatedResponse, RecordResponse } from "../types/api.js";

export function useRecords(promptPublicId: string) {
  return useQuery({
    queryKey: ["records", promptPublicId],
    queryFn: () => getRecords(promptPublicId),
  });
}

export function useUpdateRecord(promptPublicId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recordPublicId,
      data,
    }: {
      recordPublicId: string;
      data: { title?: string; description?: string };
    }) => updateRecord(promptPublicId, recordPublicId, data),

    // Optimistic update
    onMutate: async ({ recordPublicId, data }) => {
      await queryClient.cancelQueries({
        queryKey: ["records", promptPublicId],
      });

      const previous = queryClient.getQueryData<PaginatedResponse<RecordResponse>>([
        "records",
        promptPublicId,
      ]);

      if (previous) {
        queryClient.setQueryData<PaginatedResponse<RecordResponse>>(
          ["records", promptPublicId],
          {
            ...previous,
            data: previous.data.map((record) =>
              record.publicId === recordPublicId
                ? { ...record, ...data }
                : record,
            ),
          },
        );
      }

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["records", promptPublicId],
          context.previous,
        );
      }
      toast.error(t("errors.generic"));
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["records", promptPublicId],
      });
    },

    onSuccess: () => {
      toast.success(t("toast.recordUpdated"));
    },
  });
}

export function useDeleteRecord(promptPublicId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordPublicId: string) =>
      deleteRecord(promptPublicId, recordPublicId),

    // Optimistic delete
    onMutate: async (recordPublicId) => {
      await queryClient.cancelQueries({
        queryKey: ["records", promptPublicId],
      });

      const previous = queryClient.getQueryData<PaginatedResponse<RecordResponse>>([
        "records",
        promptPublicId,
      ]);

      if (previous) {
        const filtered = previous.data.filter(
          (r) => r.publicId !== recordPublicId,
        );
        queryClient.setQueryData<PaginatedResponse<RecordResponse>>(
          ["records", promptPublicId],
          {
            data: filtered,
            meta: { ...previous.meta, total: filtered.length },
          },
        );
      }

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["records", promptPublicId],
          context.previous,
        );
      }
      toast.error(t("errors.generic"));
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["records", promptPublicId],
      });
    },

    onSuccess: () => {
      toast.success(t("toast.recordDeleted"));
    },
  });
}
