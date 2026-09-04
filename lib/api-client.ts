// Thin browser-side fetch wrapper for the platform's own API. Returns the
// parsed envelope and throws a typed error carrying the server's `code` and
// `message`, so client components can toast the friendly message without
// re-deriving it. Never used for anything but same-origin /api calls.

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type Envelope<T> =
  | { success: true; code: string; data: T }
  | { success: false; code: string; message: string };

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiClientError("INTERNAL_ERROR", "The server returned an unreadable response");
  }

  if (!body.success) {
    throw new ApiClientError(body.code, body.message);
  }
  return body.data;
}
