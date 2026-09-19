"use client";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** JSON fetch that always throws a human-readable message (never a stack trace or raw server text). */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init || {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers || {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0);
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/admin/login")) window.location.href = "/admin/login";
    const msg = data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string" ? (data as { error: string }).error : "Something went wrong. Please try again.";
    throw new ApiError(msg, res.status);
  }
  return data as T;
}
