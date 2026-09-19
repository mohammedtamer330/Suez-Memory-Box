import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin, readJson, safeError } from "@/lib/guard";
import { readPeople, readPersonPhotos, renumber, writePeople, writePersonPhotos } from "@/lib/data";
import { parseAssets, refreshPublic } from "@/lib/api-helpers";
import type { PersonPhoto } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_r: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json(await readPersonPhotos((await params).id));
}

export async function POST(request: Request, { params }: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const people = await readPeople();
    const pi = people.findIndex((p) => p.id === id);
    if (pi < 0) return NextResponse.json({ error: "That person no longer exists." }, { status: 404 });
    const body = await readJson<{ items?: unknown }>(request);
    const existing = await readPersonPhotos(id);
    const { ok, rejected } = parseAssets(body?.items, existing);
    const now = new Date().toISOString();
    const added: PersonPhoto[] = ok.map((a, i) => ({ ...a, id: randomUUID(), personId: id, sortOrder: existing.length + i, createdAt: now }));
    if (added.length) {
      await writePersonPhotos(id, renumber([...existing, ...added]));
      // First photo ever added becomes the cover automatically; the admin can change it any time.
      if (!people[pi].coverPhotoId || !existing.some((p) => p.id === people[pi].coverPhotoId)) {
        const next = [...people];
        next[pi] = { ...people[pi], coverPhotoId: (existing[0] ?? added[0]).id, updatedAt: now };
        await writePeople(next);
      }
    }
    refreshPublic();
    return NextResponse.json({ added, rejected }, { status: added.length ? 201 : 200 });
  } catch (e) { return safeError(e); }
}

export async function PUT(request: Request, { params }: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await readJson<{ order?: string[] }>(request);
    if (!body || !Array.isArray(body.order)) return NextResponse.json({ error: "Order is missing." }, { status: 400 });
    const existing = await readPersonPhotos(id);
    const byId = new Map(existing.map((p) => [p.id, p]));
    const first = body.order.map((x) => byId.get(x)).filter((p): p is PersonPhoto => Boolean(p));
    const rest = existing.filter((p) => !body.order!.includes(p.id));
    const next = renumber([...first, ...rest]);
    await writePersonPhotos(id, next);
    refreshPublic();
    return NextResponse.json(next);
  } catch (e) { return safeError(e); }
}
