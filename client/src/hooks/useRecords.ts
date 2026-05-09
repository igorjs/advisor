import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { deleteRecord, updateRecord } from "../api/records.js";
import type { DataResponse, PromptResponse } from "../types/api.js";

// No useRecords query hook: records come from the prompt query
// (GET /prompts/:id returns records embedded). Mutations here
// optimistically update the prompt cache and invalidate on settle.

export function useUpdateRecord(promptPublicId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["prompts", promptPublicId];

  return useMutation({
    mutationFn: ({
      recordPublicId,
      data,
    }: {
      recordPublicId: string;
      data: { title?: string; description?: string };
    }) => updateRecord(promptPublicId, recordPublicId, data),

    // Optimistic update on the prompt cache
    onMutate: async ({ recordPublicId, data }) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<DataResponse<PromptResponse>>(queryKey);

      if (previous) {
        queryClient.setQueryData<DataResponse<PromptResponse>>(queryKey, {
          data: {
            ...previous.data,
            records: previous.data.records.map((record) =>
              record.publicId === recordPublicId
                ? { ...record, ...data }
                : record,
            ),
          },
        });
      }

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error(t("errors.generic"));
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },

    onSuccess: () => {
      toast.success(t("toast.recordUpdated"));
    },
  });
}

export function useDeleteRecord(promptPublicId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["prompts", promptPublicId];

  return useMutation({
    mutationFn: (recordPublicId: string) =>
      deleteRecord(promptPublicId, recordPublicId),

    // Optimistic delete on the prompt cache
    onMutate: async (recordPublicId) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<DataResponse<PromptResponse>>(queryKey);

      if (previous) {
        queryClient.setQueryData<DataResponse<PromptResponse>>(queryKey, {
          data: {
            ...previous.data,
            records: previous.data.records.filter(
              (r) => r.publicId !== recordPublicId,
            ),
          },
        });
      }

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error(t("errors.generic"));
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },

    onSuccess: () => {
      toast.success(t("toast.recordDeleted"));
    },
  });
}
