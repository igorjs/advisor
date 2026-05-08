/** Parse response JSON for test assertions. Caller narrows the type. */
export async function jsonBody<T>(res: Response): Promise<T> {
  const raw: unknown = await res.json();
  // Runtime type narrowing happens in test assertions (expect().toBe etc.)
  // This is a test-only utility where the caller knows the shape
  return raw as never;
}

export function postJson(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function patchJson(body: unknown): RequestInit {
  return {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
