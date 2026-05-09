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
  status: string;
  createdAt: string;
  updatedAt: string;
  records: RecordResponse[];
}

export interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolStatus?: "loading" | "done";
}

export type AgentEvent =
  | { type: "assistant_delta"; content: string }
  | { type: "assistant_end"; fullContent: string }
  | { type: "tool_start"; name: string; query: string }
  | { type: "tool_result"; results: number }
  | { type: "records"; records: RecordResponse[] }
  | { type: "error"; code: string; message: string }
  | { type: "done" };

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
