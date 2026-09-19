import "server-only";
import { revalidatePath } from "next/cache";
import { sanitizeAsset } from "./data";
import type { ImageAsset } from "./types";

export const refreshPublic = () => {
  try { revalidatePath("/"); } catch { /* not in a request scope during tests */ }
};

export interface Rejection { index: number; reason: string }

/** Validate a batch of client-provided assets. One bad item never fails the batch. */
export function parseAssets(items: unknown, existing: { url: string; hash?: string }[]): { ok: ImageAsset[]; rejected: Rejection[] } {
  const ok: ImageAsset[] = [];
  const rejected: Rejection[] = [];
  if (!Array.isArray(items)) return { ok, rejected: [{ index: 0, reason: "No photos were provided." }] };
  const seenHash = new Set(existing.map((e) => e.hash).filter(Boolean) as string[]);
  const seenUrl = new Set(existing.map((e) => e.url));
  items.slice(0, 200).forEach((raw, index) => {
    const a = sanitizeAsset(raw as Partial<ImageAsset>);
    if (!a) return void rejected.push({ index, reason: "This photo's upload wasn't valid." });
    if ((a.hash && seenHash.has(a.hash)) || seenUrl.has(a.url)) return void rejected.push({ index, reason: "This photo is already in the collection." });
    if (a.hash) seenHash.add(a.hash);
    seenUrl.add(a.url);
    ok.push(a);
  });
  return { ok, rejected };
}
