import { api } from "./client.js";
import type { DataResponse, PromptResponse } from "../types/api.js";

export function createPrompt(text: string) {
  return api.post<DataResponse<PromptResponse>>("/api/v1/prompts", { text });
}

export function getPrompt(publicId: string) {
  return api.get<DataResponse<PromptResponse>>(
    `/api/v1/prompts/${publicId}`,
  );
}

export function reQueryPrompt(publicId: string, text: string) {
  return api.patch<DataResponse<PromptResponse>>(
    `/api/v1/prompts/${publicId}`,
    { text },
  );
}
