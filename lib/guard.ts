import "server-only";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "./auth";
import { StoreUnavailableError } from "./store";

/**
 * Server-side authorisation used by EVERY admin route handler and admin page.
 * The proxy/middleware layer is only a first gate; this is the one that counts.
 * Mutating requests must also come from this site's own origin (CSRF defence in depth on top of SameSite).
 */
export async function isAdmin(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(ADMIN_COOKIE_NAME)?.value);
}

export async function requireAdmin(request?: Request): Promise<NextResponse | null> {
  if (!(await isAdmin())) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (request && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const h = await headers();
    const origin = h.get("origin");
    const host = h.get("x-forwarded-host") || h.get("host");
    if (origin) {
      try {
        if (new URL(origin).host !== host) return NextResponse.json({ error: "Request blocked." }, { status: 403 });
      } catch {
        return NextResponse.json({ error: "Request blocked." }, { status: 403 });
      }
    }
  }
  return null;
}

/** Turn any thrown error into a safe JSON response — never leak stack traces or DB errors. */
export function safeError(e: unknown, fallback = "Something went wrong. Please try again."): NextResponse {
  if (e instanceof StoreUnavailableError) return NextResponse.json({ error: e.message }, { status: 503 });
  console.error("[api]", e instanceof Error ? e.message : e);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
