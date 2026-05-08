import { api } from "./client.js";
import type {
  DataResponse,
  PaginatedResponse,
  RecordResponse,
} from "../types/api.js";

export function getRecords(promptPublicId: string) {
  return api.get<PaginatedResponse<RecordResponse>>(
    `/api/v1/prompts/${promptPublicId}/records`,
  );
}

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
