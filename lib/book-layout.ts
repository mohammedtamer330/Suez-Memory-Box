import { clamp, hashString, mulberry32 } from "./rng";

/**
 * Generates a personal memory book from that person's real photographs.
 * Pages are 100 wide × 133 tall. Every page uses a controlled template; nothing is invented and a
 * photograph is never cropped — frames take each photo's own aspect ratio.
 */
export interface BookPhoto { id: string; width: number; height: number; focalX: number; focalY: number }
export interface BookItem {
  id: string;
  /** centre, page units */
  x: number; y: number;
  /** width in page units; height = w / aspect */
  w: number; h: number;
  aspect: number;
  rot: number;
  z: number;
  /** thin print border, or mounted with photo corners */
  mount: "print" | "corners" | "borderless";
}
export interface BookPage { index: number; kind: string; items: BookItem[] }

export const PAGE_W = 100;
export const PAGE_H = 133;
const asp = (p: BookPhoto) => (p.width > 0 && p.height > 0 ? p.width / p.height : 4 / 3);
type Orient = "L" | "P" | "S";
const orient = (p: BookPhoto): Orient => { const a = asp(p); return a > 1.15 ? "L" : a < 0.87 ? "P" : "S"; };

function place(p: BookPhoto, cx: number, cy: number, maxW: number, maxH: number, rot: number, z: number, mount: BookItem["mount"]): BookItem {
  const aspect = clamp(asp(p), 0.4, 2.6);
  let w = maxW, h = w / aspect;
  if (h > maxH) { h = maxH; w = h * aspect; }
  return { id: p.id, x: cx, y: cy, w, h, aspect, rot, z, mount };
}

export function layoutBook(photos: BookPhoto[], seed: number, personId: string): BookPage[] {
  const rnd = mulberry32(hashString(`book:${personId}:${seed}`));
  const list = photos.slice();
  const pages: BookPage[] = [];
  const j = (amt: number) => (rnd() - 0.5) * 2 * amt;
  const flip = () => (rnd() < 0.5 ? -1 : 1);
  const mountFor = () => (rnd() < 0.3 ? "corners" : rnd() < 0.5 ? "print" : "borderless") as BookItem["mount"];

  while (list.length) {
    const remaining = list.length;
    const a = list[0], b = list[1], c = list[2];
    let kind = "single";
    let items: BookItem[] = [];
    const f = flip();

    // choose a family from the next photos' orientations (deterministic lookahead)
    const oa = orient(a), ob = b ? orient(b) : null, oc = c ? orient(c) : null;
    let take = 1;
    if (remaining === 1) take = 1;
    else if (remaining === 2) take = 2;
    else if (remaining === 3) take = 3;
    else {
      // vary rhythm: mostly pairs and trios, occasional full-page single for portrait photos
      const r = rnd();
      if (oa === "P" && r < 0.34) take = 1;
      else if (r < 0.7) take = 2;
      else take = 3;
    }

    if (take === 1) {
      kind = oa === "P" ? "full" : "single";
      if (oa === "P") items = [place(a, 50 + j(1), 66, 84, 118, j(1.2), 1, "print")];
      else items = [place(a, 50 + j(1.5), 64 + j(3), 86, 84, j(2), 1, mountFor())];
      list.splice(0, 1);
    } else if (take === 2) {
      if (oa === "P" && ob === "P") {
        kind = "pair-portrait";
        items = [place(a, 27 + j(1), 60 + j(2) * f, 44, 84, -2.5 + j(1), 1, mountFor()), place(b!, 73 + j(1), 72 - j(2) * f, 44, 84, 2.5 + j(1), 2, mountFor())];
      } else if (oa === "L" && ob === "L") {
        kind = "pair-stack";
        items = [place(a, 50 + f * 4, 34 + j(1), 80, 52, -2 * f + j(0.8), 1, mountFor()), place(b!, 50 - f * 4, 94 + j(1), 76, 50, 2.2 * f + j(0.8), 2, mountFor())];
      } else {
        kind = "large-small";
        items = [place(a, 50 - f * 6, 46 + j(2), 82, 70, -1.8 * f + j(0.8), 1, "print"), place(b!, 50 + f * 18, 100 + j(2), 46, 44, 4.5 * f + j(1), 2, mountFor())];
      }
      list.splice(0, 2);
    } else {
      if (oa === "L" || oa === "S") {
        kind = "trio-top";
        items = [place(a, 50 + j(1), 34 + j(1), 82, 54, -1.5 * f + j(0.8), 1, "print"), place(b!, 28 + j(1), 100 + j(2), 40, 46, -3 + j(1), 2, mountFor()), place(c!, 72 + j(1), 97 + j(2), 40, 46, 3 + j(1), 3, mountFor())];
      } else {
        kind = "trio-side";
        items = [place(a, 30 + j(1), 68 + j(2), 44, 96, -2.2 + j(0.8), 1, "print"), place(b!, 73 + j(1), 38 + j(1), 42, 50, 2.6 + j(1), 2, mountFor()), place(c!, 71 + j(1), 96 + j(2), 42, 50, -2 + j(1), 3, mountFor())];
        if (f < 0) items = items.map((it) => ({ ...it, x: 100 - it.x, rot: -it.rot }));
      }
      list.splice(0, 3);
    }
    void oc;
    pages.push({ index: pages.length, kind, items });
  }
  return pages;
}
