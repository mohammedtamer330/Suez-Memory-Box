import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { ADMIN_COOKIE_NAME, SESSION_SECONDS, checkPassword, createSessionToken } from "@/lib/auth";
import { clearCounter, incrWithTtl } from "@/lib/store";
import { readJson } from "@/lib/guard";

const MAX_ATTEMPTS = 6;
const WINDOW_SEC = 15 * 60;

export async function POST(request: Request) {
  if (!process.env.ADMIN_PASSWORD) return NextResponse.json({ error: "Sign-in isn't configured on the server." }, { status: 500 });
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const key = `s26:login:${ip}`;
  const attempts = await incrWithTtl(key, WINDOW_SEC);
  if (attempts > MAX_ATTEMPTS) return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });

  const body = await readJson<{ password?: string }>(request);
  if (!body || typeof body.password !== "string" || !checkPassword(body.password)) {
    return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
  }
  await clearCounter(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, await createSessionToken(), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_SECONDS,
  });
  return res;
}
