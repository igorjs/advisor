import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { deleteRecord, updateRecord } from "../api/records.js";
import type { ConversationResponse, DataResponse } from "../types/api.js";

// No useRecords query hook: records come from the conversation query
// (GET /conversations/:id returns records embedded). Mutations here
// optimistically update the conversation cache and invalidate on settle.

export function useUpdateRecord(conversationPublicId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["conversations", conversationPublicId];

  return useMutation({
    mutationFn: ({
      recordPublicId,
      data,
    }: {
      recordPublicId: string;
      data: { title?: string; description?: string };
    }) => updateRecord(conversationPublicId, recordPublicId, data),

    // Optimistic update on the conversation cache
    onMutate: async ({ recordPublicId, data }) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<DataResponse<ConversationResponse>>(queryKey);

      if (previous) {
        queryClient.setQueryData<DataResponse<ConversationResponse>>(queryKey, {
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

export function useDeleteRecord(conversationPublicId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["conversations", conversationPublicId];

  return useMutation({
    mutationFn: (recordPublicId: string) =>
      deleteRecord(conversationPublicId, recordPublicId),

    // Optimistic delete on the conversation cache
    onMutate: async (recordPublicId) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<DataResponse<ConversationResponse>>(queryKey);

      if (previous) {
        queryClient.setQueryData<DataResponse<ConversationResponse>>(queryKey, {
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
