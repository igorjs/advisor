// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { createConversation, getConversation, reQueryConversation } from "../api/conversations.js";

export function useConversation(publicId: string | null) {
  return useQuery({
    queryKey: ["conversations", publicId],
    queryFn: () => getConversation(publicId!),
    enabled: publicId !== null,
  });
}

export function useCreateConversation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => createConversation(text),
    onSuccess: (data) => {
      queryClient.setQueryData(["conversations", data.data.publicId], data);
      toast.success(t("toast.promptCreated"));
    },
    onError: () => {
      toast.error(t("errors.generic"));
    },
  });
}

export function useReQueryConversation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ publicId, text }: { publicId: string; text: string }) =>
      reQueryConversation(publicId, text),
    onSuccess: (data) => {
      queryClient.setQueryData(["conversations", data.data.publicId], data);
      toast.success(t("toast.promptRequeried"));
    },
    onError: () => {
      toast.error(t("errors.generic"));
    },
  });
}
