/** Parse response JSON with type inference for test assertions. */
export async function jsonBody<T = Record<string, unknown>>(
  res: Response,
): Promise<T> {
  return res.json() as Promise<T>;
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
