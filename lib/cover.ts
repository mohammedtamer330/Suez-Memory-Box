import type { PersonPhoto, PersonWithPhotos } from "./types";
/** Client-safe cover resolution (lib/data.ts is server-only). */
export function resolveCoverClient(p: PersonWithPhotos): PersonPhoto | null {
  return p.photos.find((x) => x.id === p.coverPhotoId) ?? p.photos[0] ?? null;
}
