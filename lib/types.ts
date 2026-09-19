/** Clean, presentation-free data model. Stable ids, ISO country codes, no captions/dates. */

export interface ImageAsset {
  /** Display-size image (long edge ≤ 2000px, WebP/JPEG). */
  url: string;
  /** Small image (long edge ≤ 640px) used for thumbnails and lazy first paint. */
  thumbUrl: string;
  /** Intrinsic pixel size of `url`. 0 means "unknown" (legacy data) and layouts fall back to 4:3. */
  width: number;
  height: number;
  /** Subject focal point, 0..1, used wherever cropping is unavoidable. */
  focalX: number;
  focalY: number;
  /** SHA-1 of the uploaded bytes; used to reject duplicate assets. */
  hash?: string;
}

export interface GroupPhoto extends ImageAsset {
  id: string;
  sortOrder: number;
  /** Prioritised photos are placed first in the Together collection. */
  priority: boolean;
  createdAt: string;
}

export interface PersonPhoto extends ImageAsset {
  id: string;
  personId: string;
  sortOrder: number;
  createdAt: string;
}

export interface Person {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2, upper-case. */
  countryCode: string;
  coverPhotoId: string | null;
  sortOrder: number;
  /** Bumped by "Regenerate layout" — a different but still art-directed book composition. */
  layoutSeed: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonWithPhotos extends Person {
  photos: PersonPhoto[];
}

export interface Settings {
  title: string;
  tagline: string;
  /** Spelled exactly as the author wants it — used in "Meet <familyName>’s Family". */
  familyName: string;
  closingLines: [string, string, string];
  heroPhotoId: string | null;
  /** Bumped by "Regenerate layout" on the group photos. */
  groupLayoutSeed: number;
  /** Optional licensed track. Empty until the author supplies one. */
  musicUrl: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  title: "Suez Summer ’26",
  tagline: "Some places stay with you forever…",
  familyName: "Askiimmm",
  closingLines: ["Made with love,", "from your fav Askimmm, Tito", "— Until we meet again."],
  heroPhotoId: null,
  groupLayoutSeed: 1,
  musicUrl: null,
};

export interface ExperienceData {
  people: PersonWithPhotos[];
  group: GroupPhoto[];
  settings: Settings;
}

export interface City {
  id: "cairo" | "giza" | "dahab" | "alexandria" | "suez" | "sharm";
  name: string;
}
export const CITIES: City[] = [
  { id: "cairo", name: "Cairo" },
  { id: "giza", name: "Giza" },
  { id: "dahab", name: "Dahab" },
  { id: "alexandria", name: "Alexandria" },
  { id: "suez", name: "Suez" },
  { id: "sharm", name: "Sharm El Sheikh" },
];
