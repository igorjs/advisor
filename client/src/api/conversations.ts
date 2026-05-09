import { api } from "./client.js";
import type { ConversationResponse, DataResponse } from "../types/api.js";

export function createConversation(title: string) {
  return api.post<DataResponse<ConversationResponse>>("/api/v1/conversations", { title });
}

export function getConversation(publicId: string) {
  return api.get<DataResponse<ConversationResponse>>(
    `/api/v1/conversations/${publicId}`,
  );
}

export function reQueryConversation(publicId: string, title: string) {
  return api.patch<DataResponse<ConversationResponse>>(
    `/api/v1/conversations/${publicId}`,
    { title },
  );
}
