// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { createConversation, getConversation } from "../api/conversations.js";

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
    },
    onError: () => {
      toast.error(t("errors.generic"));
    },
  });
}
