import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin, safeError } from "@/lib/guard";
import { putImage } from "@/lib/blob";

export const runtime = "nodejs";
// The admin resizes every photo in the browser first (long edge ≤ 2000px), so files stay well
// under the platform's request-body limit even when the originals are huge or HEIC.
const MAX_BYTES = 4 * 1024 * 1024;

function sniff(b: Buffer): { ext: string; type: string } | null {
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", type: "image/webp" };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b.length > 8 && b.toString("hex", 0, 8) === "89504e470d0a1a0a") return { ext: "png", type: "image/png" };
  return null;
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const variant = form.get("variant") === "thumb" ? "thumb" : "full";
    const scope = form.get("scope") === "person" ? "person" : "group";
    if (!(file instanceof File)) return NextResponse.json({ error: "No file was sent." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is too large after resizing (max 4 MB)." }, { status: 413 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const kind = sniff(bytes);
    if (!kind) return NextResponse.json({ error: "That file isn't a JPG, PNG or WebP image." }, { status: 415 });
    const path = `${scope}/${randomUUID()}${variant === "thumb" ? "-t" : ""}.${kind.ext}`;
    const url = await putImage(bytes, path, kind.type);
    return NextResponse.json({ url });
  } catch (e) {
    return safeError(e, "The upload didn't go through. Please try again.");
  }
}
