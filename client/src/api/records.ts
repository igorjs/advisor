import { api } from "./client.js";
import type { DataResponse, RecordResponse } from "../types/api.js";

// No getRecords: records come embedded in the conversation response.
// Only mutation endpoints are called directly.

export function updateRecord(
  conversationPublicId: string,
  recordPublicId: string,
  data: { title?: string; description?: string },
) {
  return api.patch<DataResponse<RecordResponse>>(
    `/api/v1/conversations/${conversationPublicId}/records/${recordPublicId}`,
    data,
  );
}

export function deleteRecord(
  conversationPublicId: string,
  recordPublicId: string,
) {
  return api.delete<void>(
    `/api/v1/conversations/${conversationPublicId}/records/${recordPublicId}`,
  );
}
