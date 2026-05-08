import type { ErrorResponse } from "../types/api.js";

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown[];

  constructor(status: number, error: ErrorResponse["error"]) {
    super(error.message);
    this.name = "ApiRequestError";
    this.code = error.code;
    this.status = status;
    this.details = error.details;
  }
}

async function request<T>(
  path: string,
  options?: RequestInit & { idempotent?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.body ? { "Content-Type": "application/json" } : {}),
  };

  if (options?.idempotent) {
    headers["Idempotency-Key"] = crypto.randomUUID();
  }

  const res = await fetch(path, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json();

  if (!res.ok) {
    const errorBody = json as ErrorResponse;
    throw new ApiRequestError(res.status, errorBody.error);
  }

  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};
