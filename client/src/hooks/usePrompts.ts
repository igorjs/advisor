import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { createPrompt, getPrompt, reQueryPrompt } from "../api/prompts.js";

export function usePrompt(publicId: string | null) {
  return useQuery({
    queryKey: ["prompts", publicId],
    queryFn: () => getPrompt(publicId!),
    enabled: publicId !== null,
  });
}

export function useCreatePrompt() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => createPrompt(text),
    onSuccess: (data) => {
      queryClient.setQueryData(["prompts", data.data.publicId], data);
      toast.success(t("toast.promptCreated"));
    },
    onError: () => {
      toast.error(t("errors.generic"));
    },
  });
}

export function useReQueryPrompt() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ publicId, text }: { publicId: string; text: string }) =>
      reQueryPrompt(publicId, text),
    onSuccess: (data) => {
      queryClient.setQueryData(["prompts", data.data.publicId], data);
      toast.success(t("toast.promptRequeried"));
    },
    onError: () => {
      toast.error(t("errors.generic"));
    },
  });
}
