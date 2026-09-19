import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

/**
 * First gate only: keeps signed-out visitors out of /admin pages. Every API route and admin page
 * ALSO checks the session server-side (lib/guard.ts) — never rely on this file alone.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/admin/login") return NextResponse.next();
  const valid = await verifySessionToken(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
  if (!valid) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
