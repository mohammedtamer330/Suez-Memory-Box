import "server-only";
import { put, del } from "@vercel/blob";

export interface Check { id: string; label: string; ok: boolean; detail: string }
const val = (n: string) => process.env[n] ?? "";
const isDev = () => process.env.NODE_ENV !== "production";

/**
 * Admin "System check". Reports which settings the RUNNING deployment can see (names and lengths only —
 * never values) and performs one tiny real write to the database and to photo storage.
 */
export async function runChecks(): Promise<Check[]> {
  const out: Check[] = [];

  const pw = val("ADMIN_PASSWORD");
  out.push({ id: "pw", label: "Admin password", ok: pw.length >= 12, detail: !pw ? "ADMIN_PASSWORD is missing or empty." : pw.length < 12 ? "Set, but shorter than 12 characters — choose a longer one." : "Set." });
  const sec = val("SESSION_SECRET");
  out.push({ id: "secret", label: "Session secret", ok: sec.length >= 24, detail: !sec ? "SESSION_SECRET is missing or empty (required in production)." : sec.length < 24 ? `Set, but only ${sec.length} characters — needs 24 or more.` : "Set." });
  const site = val("NEXT_PUBLIC_SITE_URL");
  out.push({ id: "site", label: "Site URL", ok: /^https:\/\//.test(site), detail: !site ? "NEXT_PUBLIC_SITE_URL is missing (share previews will point to localhost)." : /^https:\/\//.test(site) ? "Set." : "Must start with https://" });

  /* ---- database ---- */
  const kvUrl = val("KV_REST_API_URL"), kvTok = val("KV_REST_API_TOKEN"), kvRo = val("KV_REST_API_READ_ONLY_TOKEN");
  if (!kvUrl || !kvTok) {
    out.push(isDev()
      ? { id: "kv", label: "Database", ok: true, detail: "Not configured — using local files (development only)." }
      : { id: "kv", label: "Database", ok: false, detail: `Missing in this deployment: ${[!kvUrl && "KV_REST_API_URL", !kvTok && "KV_REST_API_TOKEN"].filter(Boolean).join(", ")}. Add them for Production, then Redeploy.` });
  } else if (!/^https:\/\//.test(kvUrl)) {
    out.push({ id: "kv", label: "Database", ok: false, detail: "KV_REST_API_URL must start with https:// (the REST URL from Upstash, not the redis:// one)." });
  } else if (kvRo && kvTok === kvRo) {
    out.push({ id: "kv", label: "Database", ok: false, detail: "KV_REST_API_TOKEN is the READ-ONLY token. Replace it with the read-write token from Upstash." });
  } else {
    try {
      const { kv } = await import("@vercel/kv");
      const stamp = String(Date.now());
      await kv.set("s26:health", stamp);
      const back = await kv.get<string>("s26:health");
      out.push({ id: "kv", label: "Database", ok: String(back) === stamp, detail: String(back) === stamp ? "Read and write work." : "Write succeeded but the value could not be read back." });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      out.push({ id: "kv", label: "Database", ok: false, detail: /NOPERM|read.?only/i.test(m) ? "The token is read-only." : /WRONGPASS|unauthor|forbidden|40[13]/i.test(m) ? "The token was rejected (wrong database or expired)." : /ENOTFOUND|fetch failed|url/i.test(m) ? "The URL can't be reached." : "The database returned an error — see Vercel Logs." });
    }
  }

  /* ---- photo storage ---- */
  const blobTok = val("BLOB_READ_WRITE_TOKEN");
  if (!blobTok) {
    out.push(isDev()
      ? { id: "blob", label: "Photo storage", ok: true, detail: "Not configured — using a local folder (development only)." }
      : { id: "blob", label: "Photo storage", ok: false, detail: "BLOB_READ_WRITE_TOKEN is missing or EMPTY in this deployment. Delete it in Vercel, reconnect the Blob store to the project (leave any prefix empty), then Redeploy." });
  } else if (!blobTok.startsWith("vercel_blob_rw_")) {
    out.push({ id: "blob", label: "Photo storage", ok: false, detail: "BLOB_READ_WRITE_TOKEN doesn't look like a Blob token (it should start with vercel_blob_rw_). It was probably typed by hand — delete it and reconnect the Blob store." });
  } else {
    try {
      const r = await put(`health/check-${Date.now()}.txt`, "ok", { access: "public", contentType: "text/plain", addRandomSuffix: true });
      await del(r.url).catch(() => undefined);
      out.push({ id: "blob", label: "Photo storage", ok: true, detail: "Upload works." });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      out.push({ id: "blob", label: "Photo storage", ok: false, detail: /private/i.test(m) ? "The Blob store is Private. Create a Public one." : /token|unauthor|forbidden|access denied/i.test(m) ? "Vercel rejected the token — reconnect the Blob store." : "Storage returned an error — see Vercel Logs." });
    }
  }
  return out;
}
