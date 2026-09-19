import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { PublicError } from "./errors";

/**
 * Key/value persistence. Production uses Vercel KV / Upstash (same KV_REST_API_* env vars as before).
 * In local development, when KV isn't configured, a JSON file under .local-data/ is used so the whole
 * admin works offline. In production without KV, writes fail closed with a clear error — nothing is
 * silently dropped.
 */
export class StoreUnavailableError extends Error {
  constructor() {
    super("Storage isn't configured. Attach Upstash Redis (KV) to this project and redeploy.");
  }
}

const hasKV = () => Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const isDev = () => process.env.NODE_ENV !== "production";
const FILE = path.join(process.cwd(), ".local-data", "store.json");

async function readFileDb(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return {};
  }
}
async function writeFileDb(db: Record<string, unknown>) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 1));
}

/** Turn a raw Upstash/Redis failure into something the admin can act on (and log the real reason). */
function explainKv(e: unknown): PublicError {
  const m = e instanceof Error ? e.message : String(e);
  console.error("[kv] write failed:", m);
  if (/NOPERM|read.?only/i.test(m)) return new PublicError("The database rejected the save: KV_REST_API_TOKEN is a READ-ONLY token. In Vercel set KV_REST_API_TOKEN to the read-write token from Upstash (REST API section), then Redeploy.", 503);
  if (/WRONGPASS|unauthor|invalid token|forbidden|\b40[13]\b/i.test(m)) return new PublicError("The database rejected the token. Make sure KV_REST_API_TOKEN belongs to the same database as KV_REST_API_URL, then Redeploy.", 503);
  if (/ENOTFOUND|fetch failed|invalid url|failed to parse url|ECONNREFUSED|getaddrinfo/i.test(m)) return new PublicError("The database URL can't be reached. KV_REST_API_URL must start with https:// and come from Upstash. Fix it, then Redeploy.", 503);
  return new PublicError("The database returned an error. In Vercel open Logs and look for “[kv] write failed”.", 502);
}

export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    if (hasKV()) {
      const { kv } = await import("@vercel/kv");
      return ((await kv.get<T>(key)) as T | null) ?? null;
    }
    if (isDev()) return ((await readFileDb())[key] as T | undefined) ?? null;
  } catch (e) {
    console.error("[store] read failed:", key, e instanceof Error ? e.message : e);
  }
  return null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  if (hasKV()) {
    try {
      const { kv } = await import("@vercel/kv");
      await kv.set(key, value);
    } catch (e) {
      throw explainKv(e);
    }
    return;
  }
  if (isDev()) {
    const db = await readFileDb();
    db[key] = value;
    await writeFileDb(db);
    return;
  }
  throw new StoreUnavailableError();
}

export async function kvDel(key: string): Promise<void> {
  if (hasKV()) {
    try {
      const { kv } = await import("@vercel/kv");
      await kv.del(key);
    } catch (e) {
      throw explainKv(e);
    }
    return;
  }
  if (isDev()) {
    const db = await readFileDb();
    delete db[key];
    await writeFileDb(db);
    return;
  }
  throw new StoreUnavailableError();
}

/** Atomic-ish counter with expiry, used for login rate limiting. Falls back to memory if KV is unavailable. */
const mem = new Map<string, { n: number; exp: number }>();
export async function incrWithTtl(key: string, ttlSec: number): Promise<number> {
  try {
    if (hasKV()) {
      const { kv } = await import("@vercel/kv");
      const n = await kv.incr(key);
      if (n === 1) await kv.expire(key, ttlSec);
      return n;
    }
  } catch {
    /* fall through to memory */
  }
  const now = Date.now();
  const cur = mem.get(key);
  if (!cur || cur.exp < now) {
    mem.set(key, { n: 1, exp: now + ttlSec * 1000 });
    return 1;
  }
  cur.n += 1;
  return cur.n;
}
export async function clearCounter(key: string) {
  mem.delete(key);
  try {
    if (hasKV()) {
      const { kv } = await import("@vercel/kv");
      await kv.del(key);
    }
  } catch {
    /* ignore */
  }
}
