import { NextResponse } from "next/server";
import { requireAdmin, readJson, safeError } from "@/lib/guard";
import { readGroup, readSettings, renumber, sanitizeAsset, writeGroup, writeSettings } from "@/lib/data";
import { refreshPublic } from "@/lib/api-helpers";
import { deleteImages } from "@/lib/blob";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await readJson<{ priority?: boolean; focalX?: number; focalY?: number; asset?: unknown; hero?: boolean }>(request);
    if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const list = await readGroup();
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) return NextResponse.json({ error: "That photo no longer exists." }, { status: 404 });
    let cur = { ...list[i] };
    const oldUrls: string[] = [];
    if (typeof body.priority === "boolean") cur.priority = body.priority;
    if (typeof body.focalX === "number") cur.focalX = Math.min(1, Math.max(0, body.focalX));
    if (typeof body.focalY === "number") cur.focalY = Math.min(1, Math.max(0, body.focalY));
    if (body.asset) {
      const a = sanitizeAsset(body.asset as never);
      if (!a) return NextResponse.json({ error: "The replacement upload wasn't valid." }, { status: 400 });
      if (a.hash && list.some((p, j) => j !== i && p.hash === a.hash)) return NextResponse.json({ error: "That photo is already in the collection." }, { status: 409 });
      oldUrls.push(cur.url, cur.thumbUrl);
      cur = { ...cur, ...a };
    }
    const next = [...list];
    next[i] = cur;
    await writeGroup(next);
    if (typeof body.hero === "boolean") {
      const s = await readSettings();
      await writeSettings({ ...s, heroPhotoId: body.hero ? id : s.heroPhotoId === id ? null : s.heroPhotoId });
    }
    if (oldUrls.length) await deleteImages(oldUrls);
    refreshPublic();
    return NextResponse.json(cur);
  } catch (e) { return safeError(e); }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const list = await readGroup();
    const gone = list.find((p) => p.id === id);
    if (!gone) return NextResponse.json({ ok: true });
    await writeGroup(renumber(list.filter((p) => p.id !== id)));
    const s = await readSettings();
    if (s.heroPhotoId === id) await writeSettings({ ...s, heroPhotoId: null });
    await deleteImages([gone.url, gone.thumbUrl]);
    refreshPublic();
    return NextResponse.json({ ok: true });
  } catch (e) { return safeError(e); }
}
