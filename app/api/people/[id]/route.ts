import { NextResponse } from "next/server";
import { requireAdmin, readJson, safeError } from "@/lib/guard";
import { deletePersonPhotosKey, readPeople, readPersonPhotos, writePeople } from "@/lib/data";
import { normalizeCountryCode } from "@/lib/countries";
import { refreshPublic } from "@/lib/api-helpers";
import { deleteImages } from "@/lib/blob";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await readJson<{ name?: string; countryCode?: string; coverPhotoId?: string | null; regenerate?: boolean }>(request);
    if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const list = await readPeople();
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) return NextResponse.json({ error: "That person no longer exists." }, { status: 404 });
    const cur = { ...list[i] };
    if (typeof body.name === "string") {
      const n = body.name.trim().slice(0, 80);
      if (!n) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
      cur.name = n;
    }
    if (body.countryCode !== undefined) {
      const c = normalizeCountryCode(body.countryCode);
      if (!c) return NextResponse.json({ error: "That country isn't valid." }, { status: 400 });
      cur.countryCode = c;
    }
    if (body.coverPhotoId !== undefined) {
      if (body.coverPhotoId === null) cur.coverPhotoId = null;
      else {
        const photos = await readPersonPhotos(id);
        if (!photos.some((p) => p.id === body.coverPhotoId)) return NextResponse.json({ error: "That photo isn't in this book." }, { status: 400 });
        cur.coverPhotoId = body.coverPhotoId;
      }
    }
    if (body.regenerate) cur.layoutSeed = (cur.layoutSeed || 1) + 1;
    cur.updatedAt = new Date().toISOString();
    const next = [...list];
    next[i] = cur;
    await writePeople(next);
    refreshPublic();
    return NextResponse.json(cur);
  } catch (e) { return safeError(e); }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const list = await readPeople();
    const photos = await readPersonPhotos(id);
    await writePeople(list.filter((p) => p.id !== id).map((p, i) => ({ ...p, sortOrder: i })));
    await deletePersonPhotosKey(id);
    await deleteImages(photos.flatMap((p) => [p.url, p.thumbUrl]));
    refreshPublic();
    return NextResponse.json({ ok: true });
  } catch (e) { return safeError(e); }
}
