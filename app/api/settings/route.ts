import { NextResponse } from "next/server";
import { requireAdmin, readJson, safeError } from "@/lib/guard";
import { isSafeImageUrl, readSettings, writeSettings } from "@/lib/data";
import { refreshPublic } from "@/lib/api-helpers";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json(await readSettings());
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

export async function PUT(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await readJson<Record<string, unknown>>(request);
    if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const s = await readSettings();
    const next = { ...s };
    const title = clean(body.title, 60); if (title) next.title = title;
    const tagline = clean(body.tagline, 120); if (tagline !== undefined) next.tagline = tagline;
    const fam = clean(body.familyName, 40); if (fam) next.familyName = fam;
    if (Array.isArray(body.closingLines) && body.closingLines.length === 3) {
      next.closingLines = body.closingLines.map((l) => clean(l, 120) ?? "") as [string, string, string];
    }
    if (body.musicUrl === null || body.musicUrl === "") next.musicUrl = null;
    else if (typeof body.musicUrl === "string" && isSafeImageUrl(body.musicUrl)) next.musicUrl = body.musicUrl;
    if (body.regenerateGroup === true) next.groupLayoutSeed = (s.groupLayoutSeed || 1) + 1;
    if (body.heroPhotoId === null || typeof body.heroPhotoId === "string") next.heroPhotoId = body.heroPhotoId as string | null;
    await writeSettings(next);
    refreshPublic();
    return NextResponse.json(next);
  } catch (e) { return safeError(e); }
}
