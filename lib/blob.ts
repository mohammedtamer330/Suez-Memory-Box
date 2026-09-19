import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { put, del } from "@vercel/blob";

const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const isDev = () => process.env.NODE_ENV !== "production";
const DEV_DIR = path.join(process.cwd(), "public", "dev-uploads");

export async function putImage(bytes: Buffer, relPath: string, contentType: string): Promise<string> {
  if (hasBlob()) {
    const res = await put(relPath, bytes, { access: "public", contentType, addRandomSuffix: false });
    return res.url;
  }
  if (isDev()) {
    const file = path.join(DEV_DIR, relPath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
    return `/dev-uploads/${relPath}`;
  }
  throw new Error("Image storage isn't configured. Attach Vercel Blob to this project and redeploy.");
}

/** Best-effort cleanup; never throws (a leftover file must not block a delete in the admin). */
export async function deleteImages(urls: (string | undefined | null)[]) {
  const list = urls.filter((u): u is string => Boolean(u));
  for (const u of list) {
    try {
      if (u.startsWith("/dev-uploads/") && isDev()) await fs.rm(path.join(DEV_DIR, u.replace("/dev-uploads/", "")), { force: true });
      else if (hasBlob() && /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(u)) await del(u);
    } catch (e) {
      console.error("[blob] cleanup failed:", e instanceof Error ? e.message : e);
    }
  }
}
