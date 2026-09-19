import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin, readJson, safeError } from "@/lib/guard";
import { getPeopleWithPhotos, readPeople, writePeople } from "@/lib/data";
import { normalizeCountryCode } from "@/lib/countries";
import { refreshPublic } from "@/lib/api-helpers";
import type { Person } from "@/lib/types";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json(await getPeopleWithPhotos());
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await readJson<{ name?: string; countryCode?: string }>(request);
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const code = normalizeCountryCode(body?.countryCode);
    if (!name) return NextResponse.json({ error: "Please enter a name." }, { status: 400 });
    if (!code) return NextResponse.json({ error: "Please choose a country." }, { status: 400 });
    const list = await readPeople();
    const now = new Date().toISOString();
    const person: Person = { id: randomUUID(), name, countryCode: code, coverPhotoId: null, sortOrder: list.length, layoutSeed: 1, createdAt: now, updatedAt: now };
    await writePeople([...list, person]);
    refreshPublic();
    return NextResponse.json(person, { status: 201 });
  } catch (e) { return safeError(e); }
}

/** Reorder people: { order: string[] } */
export async function PUT(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await readJson<{ order?: string[] }>(request);
    if (!body || !Array.isArray(body.order)) return NextResponse.json({ error: "Order is missing." }, { status: 400 });
    const list = await readPeople();
    const byId = new Map(list.map((p) => [p.id, p]));
    const first = body.order.map((id) => byId.get(id)).filter((p): p is Person => Boolean(p));
    const rest = list.filter((p) => !body.order!.includes(p.id));
    const next = [...first, ...rest].map((p, i) => ({ ...p, sortOrder: i }));
    await writePeople(next);
    refreshPublic();
    return NextResponse.json(next);
  } catch (e) { return safeError(e); }
}
