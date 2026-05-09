// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

export interface RecordResponse {
  publicId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageResponse {
  publicId: string;
  role: string;
  content: string;
}

export interface ConversationResponse {
  publicId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  records: RecordResponse[];
  messages: MessageResponse[];
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
