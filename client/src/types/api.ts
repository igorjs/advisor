export interface RecordResponse {
  publicId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptResponse {
  publicId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  records: RecordResponse[];
}

export interface DataResponse<T> {
  data: T;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown[];
}

export interface ErrorResponse {
  error: ApiError;
}
