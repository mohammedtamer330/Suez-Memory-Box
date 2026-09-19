import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { put, del } from "@vercel/blob";
import { PublicError } from "./errors";

const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const isDev = () => process.env.NODE_ENV !== "production";
const DEV_DIR = path.join(process.cwd(), "public", "dev-uploads");

const NOT_CONNECTED = "Photo storage isn't connected. In Vercel open Storage, create a Blob store with PUBLIC access, connect it to this project, then Redeploy.";

/** Turn a raw Vercel Blob failure into something the admin can act on (and log the real reason). */
function explain(e: unknown): PublicError {
  const m = e instanceof Error ? e.message : String(e);
  console.error("[blob] put failed:", m);
  if (/private/i.test(m)) return new PublicError("Your Blob store is set to Private. Create a new Blob store with PUBLIC access, connect it to this project, then Redeploy.", 503);
  if (/token|unauthor|forbidden|access denied|\b40[13]\b/i.test(m)) return new PublicError("Vercel rejected the Blob token. In Vercel open Storage, disconnect and reconnect the Blob store to this project, then Redeploy.", 503);
  return new PublicError("Photo storage returned an error. In Vercel open Logs and look for “[blob] put failed” to see why.", 502);
}

export async function putImage(bytes: Buffer, relPath: string, contentType: string): Promise<string> {
  if (hasBlob()) {
    try {
      const res = await put(relPath, bytes, { access: "public", contentType, addRandomSuffix: false });
      return res.url;
    } catch (e) {
      throw explain(e);
    }
  }
  if (isDev()) {
    const file = path.join(DEV_DIR, relPath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
    return `/dev-uploads/${relPath}`;
  }
  throw new PublicError(NOT_CONNECTED, 503);
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
