import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin, readJson, safeError } from "@/lib/guard";
import { readGroup, renumber, writeGroup } from "@/lib/data";
import { parseAssets, refreshPublic } from "@/lib/api-helpers";
import type { GroupPhoto } from "@/lib/types";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json(await readGroup());
}

/** Append a batch. Duplicates/invalid items are reported individually; the rest are saved. */
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await readJson<{ items?: unknown }>(request);
    const existing = await readGroup();
    const { ok, rejected } = parseAssets(body?.items, existing);
    const now = new Date().toISOString();
    const added: GroupPhoto[] = ok.map((a, i) => ({ ...a, id: randomUUID(), sortOrder: existing.length + i, priority: false, createdAt: now }));
    if (added.length) await writeGroup(renumber([...existing, ...added]));
    refreshPublic();
    return NextResponse.json({ added, rejected }, { status: added.length ? 201 : 200 });
  } catch (e) { return safeError(e); }
}

/** Reorder: { order: string[] } — ids not listed keep their relative order at the end. */
export async function PUT(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await readJson<{ order?: string[] }>(request);
    if (!body || !Array.isArray(body.order)) return NextResponse.json({ error: "Order is missing." }, { status: 400 });
    const existing = await readGroup();
    const byId = new Map(existing.map((p) => [p.id, p]));
    const first = body.order.map((id) => byId.get(id)).filter((p): p is GroupPhoto => Boolean(p));
    const rest = existing.filter((p) => !body.order!.includes(p.id));
    const next = renumber([...first, ...rest]);
    await writeGroup(next);
    refreshPublic();
    return NextResponse.json(next);
  } catch (e) { return safeError(e); }
}
