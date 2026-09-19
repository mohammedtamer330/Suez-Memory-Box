import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";

const prod = process.env.NODE_ENV === "production";
/** `__Host-` binds the cookie to this exact origin (Secure, Path=/, no Domain). Not usable over http in dev. */
export const ADMIN_COOKIE_NAME = prod ? "__Host-s26_admin" : "s26_admin";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

function secretKey(): Uint8Array {
  const dedicated = process.env.SESSION_SECRET;
  if (dedicated && dedicated.length >= 24) return new TextEncoder().encode(dedicated);
  if (prod) throw new Error("SESSION_SECRET (≥24 chars) must be set in production.");
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("ADMIN_PASSWORD is not set.");
  // Dev-only convenience: derive a key so local setup needs one variable.
  return new TextEncoder().encode(`dev-only:${createHash("sha256").update(pw).digest("hex")}`);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/** Constant-time comparison (hash both sides so lengths always match). */
export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof input !== "string") return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
