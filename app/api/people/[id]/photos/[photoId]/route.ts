import { NextResponse } from "next/server";
import { requireAdmin, readJson, safeError } from "@/lib/guard";
import { readPeople, readPersonPhotos, renumber, sanitizeAsset, writePeople, writePersonPhotos } from "@/lib/data";
import { refreshPublic } from "@/lib/api-helpers";
import { deleteImages } from "@/lib/blob";

type Ctx = { params: Promise<{ id: string; photoId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { id, photoId } = await params;
    const body = await readJson<{ focalX?: number; focalY?: number; asset?: unknown }>(request);
    if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const list = await readPersonPhotos(id);
    const i = list.findIndex((p) => p.id === photoId);
    if (i < 0) return NextResponse.json({ error: "That photo no longer exists." }, { status: 404 });
    let cur = { ...list[i] };
    const old: string[] = [];
    if (typeof body.focalX === "number") cur.focalX = Math.min(1, Math.max(0, body.focalX));
    if (typeof body.focalY === "number") cur.focalY = Math.min(1, Math.max(0, body.focalY));
    if (body.asset) {
      const a = sanitizeAsset(body.asset as never);
      if (!a) return NextResponse.json({ error: "The replacement upload wasn't valid." }, { status: 400 });
      if (a.hash && list.some((p, j) => j !== i && p.hash === a.hash)) return NextResponse.json({ error: "That photo is already in this book." }, { status: 409 });
      old.push(cur.url, cur.thumbUrl);
      cur = { ...cur, ...a };
    }
    const next = [...list];
    next[i] = cur;
    await writePersonPhotos(id, next);
    if (old.length) await deleteImages(old);
    refreshPublic();
    return NextResponse.json(cur);
  } catch (e) { return safeError(e); }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { id, photoId } = await params;
    const list = await readPersonPhotos(id);
    const gone = list.find((p) => p.id === photoId);
    if (!gone) return NextResponse.json({ ok: true });
    const next = renumber(list.filter((p) => p.id !== photoId));
    await writePersonPhotos(id, next);
    // Never leave a dangling cover: fall back to the first remaining photo (or none).
    const people = await readPeople();
    const pi = people.findIndex((p) => p.id === id);
    if (pi >= 0 && people[pi].coverPhotoId === photoId) {
      const copy = [...people];
      copy[pi] = { ...people[pi], coverPhotoId: next[0]?.id ?? null, updatedAt: new Date().toISOString() };
      await writePeople(copy);
    }
    await deleteImages([gone.url, gone.thumbUrl]);
    refreshPublic();
    return NextResponse.json({ ok: true, coverPhotoId: next[0]?.id ?? null });
  } catch (e) { return safeError(e); }
}
