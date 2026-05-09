import { api } from "./client.js";
import type { DataResponse, RecordResponse } from "../types/api.js";

// No getRecords: records come embedded in the prompt response.
// Only mutation endpoints are called directly.

export function updateRecord(
  promptPublicId: string,
  recordPublicId: string,
  data: { title?: string; description?: string },
) {
  return api.patch<DataResponse<RecordResponse>>(
    `/api/v1/prompts/${promptPublicId}/records/${recordPublicId}`,
    data,
  );
}

export function deleteRecord(
  promptPublicId: string,
  recordPublicId: string,
) {
  return api.delete<void>(
    `/api/v1/prompts/${promptPublicId}/records/${recordPublicId}`,
  );
}
