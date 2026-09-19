import "server-only";
import { kvGet, kvSet, kvDel } from "./store";
import { countryCodeFromName, normalizeCountryCode } from "./countries";
import { DEFAULT_SETTINGS } from "./types";
import type { ExperienceData, GroupPhoto, ImageAsset, Person, PersonPhoto, PersonWithPhotos, Settings } from "./types";
import seed from "./seed-data.json";

const K_PEOPLE = "s26:people";
const K_GROUP = "s26:group";
const K_SETTINGS = "s26:settings";
const kPhotos = (id: string) => `s26:photos:${id}`;
// Legacy keys written by the previous version of this site. Read (never written) so nothing already
// uploaded is lost; the first admin save writes the new keys.
const L_EPS = "icx:eps";
const L_MEMORIES = "icx:general_memories";
const lPhotos = (id: string) => `icx:ep_photos:${id}`;

/* ---------- validation ---------- */
const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
export function isSafeImageUrl(u: unknown): u is string {
  if (typeof u !== "string" || u.length > 600) return false;
  if (u.startsWith("/") && !u.startsWith("//")) return true;
  try {
    const p = new URL(u);
    return p.protocol === "https:";
  } catch {
    return false;
  }
}

export function sanitizeAsset(a: Partial<ImageAsset> | null | undefined): ImageAsset | null {
  if (!a || !isSafeImageUrl(a.url)) return null;
  return {
    url: a.url,
    thumbUrl: isSafeImageUrl(a.thumbUrl) ? a.thumbUrl : a.url,
    width: Math.round(num(a.width, 0, 0, 20000)),
    height: Math.round(num(a.height, 0, 0, 20000)),
    focalX: num(a.focalX, 0.5, 0, 1),
    focalY: num(a.focalY, 0.5, 0, 1),
    hash: typeof a.hash === "string" && /^[a-f0-9]{40}$/.test(a.hash) ? a.hash : undefined,
  };
}

/* ---------- legacy normalisation ---------- */
type LegacyEP = { id: string; name: string; country: string; profile_image?: string; created_at?: string; updated_at?: string };
type LegacyPhoto = { id: string; ep_id?: string; image_url: string; sort_order?: number; created_at?: string; featured?: boolean };

function legacyPeople(eps: LegacyEP[]): { people: Person[]; covers: Map<string, PersonPhoto> } {
  const covers = new Map<string, PersonPhoto>();
  const people = eps.map((e, i): Person => {
    const code = countryCodeFromName(e.country) ?? "EG";
    const now = e.updated_at || new Date().toISOString();
    let coverPhotoId: string | null = null;
    // Old placeholder initials avatars are not photographs — never promote them to covers.
    if (e.profile_image && !e.profile_image.startsWith("/avatars/") && isSafeImageUrl(e.profile_image)) {
      coverPhotoId = `cover-${e.id}`;
      covers.set(e.id, { id: coverPhotoId, personId: e.id, url: e.profile_image, thumbUrl: e.profile_image, width: 0, height: 0, focalX: 0.5, focalY: 0.4, sortOrder: -1, createdAt: now });
    }
    return { id: e.id, name: e.name, countryCode: code, coverPhotoId, sortOrder: i, layoutSeed: 1, createdAt: e.created_at || now, updatedAt: now };
  });
  return { people, covers };
}

/* ---------- reads ---------- */
export async function readPeople(): Promise<Person[]> {
  const cur = await kvGet<Person[]>(K_PEOPLE);
  if (cur) return cur.map(cleanPerson).filter(Boolean) as Person[];
  const legacy = await kvGet<LegacyEP[]>(L_EPS);
  if (legacy) return legacyPeople(legacy).people;
  return seed.people as Person[];
}

function cleanPerson(p: Person): Person | null {
  const code = normalizeCountryCode(p.countryCode);
  if (!p?.id || !p.name || !code) return null;
  return { ...p, countryCode: code, layoutSeed: Number.isFinite(p.layoutSeed) ? p.layoutSeed : 1, coverPhotoId: p.coverPhotoId ?? null };
}

export async function readPersonPhotos(personId: string): Promise<PersonPhoto[]> {
  const cur = await kvGet<PersonPhoto[]>(kPhotos(personId));
  if (cur) return [...cur].sort((a, b) => a.sortOrder - b.sortOrder);
  const legacy = await kvGet<LegacyPhoto[]>(lPhotos(personId));
  const out: PersonPhoto[] = [];
  if (legacy) {
    for (const [i, p] of legacy.entries()) {
      if (!isSafeImageUrl(p.image_url)) continue;
      out.push({ id: p.id, personId, url: p.image_url, thumbUrl: p.image_url, width: 0, height: 0, focalX: 0.5, focalY: 0.45, sortOrder: p.sort_order ?? i, createdAt: p.created_at || new Date().toISOString() });
    }
  }
  const legacyEps = await kvGet<LegacyEP[]>(L_EPS);
  const cover = legacyEps && legacyPeople(legacyEps.filter((e) => e.id === personId)).covers.get(personId);
  if (cover) out.unshift(cover);
  return out.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function readGroup(): Promise<GroupPhoto[]> {
  const cur = await kvGet<GroupPhoto[]>(K_GROUP);
  if (cur) return [...cur].sort((a, b) => a.sortOrder - b.sortOrder);
  const legacy = await kvGet<LegacyPhoto[]>(L_MEMORIES);
  if (legacy) {
    return legacy
      .filter((p) => isSafeImageUrl(p.image_url))
      .map((p, i): GroupPhoto => ({ id: p.id, url: p.image_url, thumbUrl: p.image_url, width: 0, height: 0, focalX: 0.5, focalY: 0.5, sortOrder: p.sort_order ?? i, priority: Boolean(p.featured), createdAt: p.created_at || new Date().toISOString() }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return (seed.group as GroupPhoto[]).slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function readSettings(): Promise<Settings> {
  const s = await kvGet<Partial<Settings>>(K_SETTINGS);
  const lines = Array.isArray(s?.closingLines) && s!.closingLines!.length === 3 ? (s!.closingLines as [string, string, string]) : DEFAULT_SETTINGS.closingLines;
  return {
    ...DEFAULT_SETTINGS,
    ...(s || {}),
    closingLines: lines,
    groupLayoutSeed: Number.isFinite(s?.groupLayoutSeed) ? (s!.groupLayoutSeed as number) : 1,
    musicUrl: s?.musicUrl && isSafeImageUrl(s.musicUrl) ? s.musicUrl : process.env.NEXT_PUBLIC_MUSIC_URL || null,
  };
}

/** Public ordering: prioritised photos first, then manual order. */
export function orderGroup(list: GroupPhoto[]): GroupPhoto[] {
  return [...list].sort((a, b) => Number(b.priority) - Number(a.priority) || a.sortOrder - b.sortOrder);
}

export function resolveCover(p: PersonWithPhotos): PersonPhoto | null {
  return p.photos.find((x) => x.id === p.coverPhotoId) ?? p.photos[0] ?? null;
}

export async function getPeopleWithPhotos(): Promise<PersonWithPhotos[]> {
  const people = (await readPeople()).sort((a, b) => a.sortOrder - b.sortOrder);
  const withPhotos = await Promise.all(people.map(async (p) => ({ ...p, photos: await readPersonPhotos(p.id) })));
  return withPhotos;
}

export async function getExperienceData(): Promise<ExperienceData> {
  const [people, group, settings] = await Promise.all([getPeopleWithPhotos(), readGroup(), readSettings()]);
  return { people, group: orderGroup(group), settings };
}

/* ---------- writes ---------- */
export const writePeople = (list: Person[]) => kvSet(K_PEOPLE, list);
export const writeGroup = (list: GroupPhoto[]) => kvSet(K_GROUP, list);
export const writePersonPhotos = (id: string, list: PersonPhoto[]) => kvSet(kPhotos(id), list);
export const writeSettings = (s: Settings) => kvSet(K_SETTINGS, s);
export const deletePersonPhotosKey = (id: string) => kvDel(kPhotos(id)).catch(() => {});

/** Re-number sortOrder 0..n-1 in current array order. */
export const renumber = <T extends { sortOrder: number }>(list: T[]): T[] => list.map((x, i) => ({ ...x, sortOrder: i }));
