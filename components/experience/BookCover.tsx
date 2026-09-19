"use client";
import { hashString } from "@/lib/rng";
import type { ImageAsset, Person } from "@/lib/types";
import { Flag } from "./Flag";
import { PhotoImg } from "./PhotoImg";

const CLOTHS = ["#22364a", "#5b2d2c", "#4a4a2b", "#7a5b3a", "#33474f", "#45303f", "#2f4a3f", "#59422b"];
export const clothFor = (id: string) => CLOTHS[hashString("cloth:" + id) % CLOTHS.length];

/**
 * The front of a personal memory book: cloth binding, the person's cover photograph mounted like a
 * print, their name and real flag. If they have no photograph yet it's a quiet cloth cover — nothing
 * is invented. Fills its parent (which sets the size); aspect is 3:4.
 */
export function BookCover({ person, cover, eager, sizes = "40vw" }: { person: Pick<Person, "id" | "name" | "countryCode">; cover: ImageAsset | null; eager?: boolean; sizes?: string }) {
  return (
    <span className="bcover" style={{ ["--cloth" as string]: clothFor(person.id) }}>
      <span className="bcover-cloth" aria-hidden />
      <span className="bcover-spine" aria-hidden />
      {cover ? (
        <span className="bcover-photo">
          <PhotoImg asset={cover} focal eager={eager} sizes={sizes} className="bcover-img" />
        </span>
      ) : (
        <span className="bcover-empty" aria-hidden />
      )}
      <span className="bcover-label">
        <span className="bcover-name">{person.name}</span>
        <Flag code={person.countryCode} height={13} />
      </span>
      <span className="bcover-wear" aria-hidden />
    </span>
  );
}
