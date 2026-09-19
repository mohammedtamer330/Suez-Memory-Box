import { clamp, hashString, mulberry32 } from "./rng";

/**
 * Art-directed layout for the "Together" table.
 *
 * Each spread is a 100-unit-wide canvas. Templates are hand-placed slot scaffolds (centre, box size,
 * rotation, z). Per seed we pick a template, optionally mirror it, jitter within tight limits, assign
 * photos to slots by aspect-ratio fit, then run a relaxation pass that keeps every subject's focal
 * point clear of neighbouring photos. Same seed + same photos ⇒ exactly the same table.
 */
export interface PhotoLike { id: string; width: number; height: number; focalX: number; focalY: number }
export type FrameStyle = "print" | "borderless" | "polaroid";

export interface Placed {
  id: string;
  /** centre, in spread units (0..100 horizontally) */
  x: number; y: number;
  /** frame size in spread units */
  w: number; h: number;
  rot: number; z: number;
  style: FrameStyle;
  /** photo inset inside the frame, as % of frame width/height */
  inset: { t: number; r: number; b: number; l: number };
  frameAspect: number;
  tape: boolean;
  /** true when the frame aspect differs enough from the photo that object-fit:cover will crop (focal point applies) */
  crop: boolean;
}
export interface Spread { index: number; height: number; items: Placed[] }
export type Mode = "portrait" | "landscape";

interface Slot { x: number; y: number; bw: number; bh: number; rot: number; z: number }
const S = (x: number, y: number, bw: number, bh: number, rot: number, z: number): Slot => ({ x, y, bw, bh, rot, z });

// Portrait spreads (phones). Slot 0 is the "anchor" — the largest, most central slot.
const PORTRAIT: Slot[][] = [
  [S(46, 25, 74, 44, -2.5, 4), S(76, 56, 42, 54, 4, 5), S(25, 60, 46, 36, 3, 3), S(58, 84, 56, 40, -3, 4), S(24, 100, 40, 50, -4.5, 5), S(80, 108, 40, 32, 3.5, 3), S(50, 122, 50, 28, -1.5, 2)],
  [S(52, 24, 70, 46, 2.5, 4), S(22, 50, 40, 52, -4, 5), S(70, 58, 52, 38, -3, 3), S(30, 84, 52, 38, 3.5, 4), S(76, 92, 40, 52, 4.5, 5), S(46, 111, 48, 30, -2, 2), S(20, 120, 34, 28, 5, 3)],
  [S(50, 26, 78, 46, -1.5, 4), S(24, 58, 42, 42, 4, 5), S(72, 62, 48, 44, -4, 3), S(48, 88, 58, 40, 2.5, 4), S(80, 100, 36, 46, 4, 5), S(20, 108, 38, 44, -3.5, 3), S(56, 121, 44, 26, 2, 2)],
];
const LANDSCAPE: Slot[][] = [
  [S(48, 30, 46, 46, -2, 4), S(22, 20, 32, 34, 3.5, 3), S(78, 24, 34, 40, -3.5, 5), S(74, 52, 34, 26, 3, 3), S(22, 50, 36, 30, -4, 5), S(50, 58, 30, 24, 2.5, 2)],
  [S(50, 28, 44, 46, 2, 4), S(80, 22, 30, 38, -3, 3), S(20, 26, 32, 40, 3, 5), S(26, 56, 34, 26, -2.5, 3), S(72, 54, 38, 30, 4, 5), S(52, 58, 28, 22, -3.5, 2)],
];

const SPREAD_TARGET: Record<Mode, number> = { portrait: 7, landscape: 6 };
const A_MIN = 0.66, A_MAX = 1.62;

function frameFor(style: FrameStyle, A: number) {
  // returns frame aspect (w/h) and inset in % of frame w / h
  let l: number, t: number, b: number; // fractions of frame width
  if (style === "polaroid") { l = 0.05; t = 0.05; b = 0.19; }
  else if (style === "borderless") { l = t = b = 0.008; }
  else { l = t = b = 0.028; }
  const photoW = 1 - 2 * l;
  const photoH = photoW / A;
  const frameH = photoH + t + b;
  return { aspect: 1 / frameH, inset: { l: l * 100, r: l * 100, t: (t / frameH) * 100, b: (b / frameH) * 100 } };
}

const asp = (p: PhotoLike) => (p.width > 0 && p.height > 0 ? p.width / p.height : 4 / 3);

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  arr.forEach((v, i) => {
    for (const rest of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([v, ...rest]);
  });
  return out;
}

export function composeTable(photos: PhotoLike[], seed: number, mode: Mode, heroId?: string | null): Spread[] {
  if (!photos.length) return [];
  const target = SPREAD_TARGET[mode];
  const templates = mode === "portrait" ? PORTRAIT : LANDSCAPE;
  const ordered = photos.slice();
  const hi = heroId ? ordered.findIndex((p) => p.id === heroId) : -1;
  if (hi > 0) ordered.unshift(...ordered.splice(hi, 1));

  const spreadCount = Math.max(1, Math.ceil(ordered.length / target));
  const base = Math.floor(ordered.length / spreadCount);
  const extra = ordered.length % spreadCount;
  const spreads: Spread[] = [];
  let cursor = 0;

  for (let si = 0; si < spreadCount; si++) {
    const count = base + (si < extra ? 1 : 0);
    const group = ordered.slice(cursor, cursor + count);
    cursor += count;
    const rnd = mulberry32(hashString(`spread:${seed}:${si}`));
    const tpl = templates[Math.floor(rnd() * templates.length)];
    const mirror = rnd() < 0.5;
    let slots = tpl.slice(0, count).map((s) => ({ ...s }));
    slots = slots.map((s) => ({
      ...s,
      x: clamp((mirror ? 100 - s.x : s.x) + (rnd() - 0.5) * 3.2, s.bw / 2 + 1.5, 100 - s.bw / 2 - 1.5),
      y: s.y + (rnd() - 0.5) * 2.4,
      rot: (mirror ? -s.rot : s.rot) + (rnd() - 0.5) * 2.2,
    }));

    // assignment: pin hero to the anchor slot on the first spread; otherwise best aspect fit (seed adds tie-break noise)
    const pinHero = si === 0 && hi >= 0 && group[0]?.id === heroId;
    const fixed = pinHero ? [0] : [];
    let best: number[] = group.map((_, i) => i);
    let bestCost = Infinity;
    const idx = group.map((_, i) => i);
    const freeSlots = slots.map((_, i) => i).filter((i) => !fixed.includes(i));
    const freePhotos = idx.filter((i) => !(pinHero && i === 0));
    for (const perm of permutations(freeSlots)) {
      let cost = 0;
      freePhotos.forEach((pi, k) => {
        const slot = slots[perm[k]];
        cost += Math.abs(Math.log(asp(group[pi]) / (slot.bw / slot.bh)));
      });
      cost += rnd() * 0.3;
      if (cost < bestCost) {
        bestCost = cost;
        const assign = new Array(group.length).fill(0);
        if (pinHero) assign[0] = 0;
        freePhotos.forEach((pi, k) => (assign[pi] = perm[k]));
        best = assign;
      }
    }

    const items: Placed[] = group.map((p, gi) => {
      const slot = slots[best[gi]];
      const rawA = asp(p);
      const A = clamp(rawA, A_MIN, A_MAX);
      const r = rnd();
      const isHero = p.id === heroId;
      let style: FrameStyle = r < 0.68 ? "print" : r < 0.88 ? "borderless" : "polaroid";
      if (style === "polaroid" && (A < 0.8 || A > 1.3)) style = "print";
      if (isHero) style = "print";
      // fit the frame inside the slot box by frame aspect
      const { aspect } = frameFor(style, A);
      let w = Math.min(slot.bw, slot.bh * aspect);
      let h = w / aspect;
      if (isHero) { w *= 1.0; h = w / aspect; }
      const { inset } = frameFor(style, A);
      return {
        id: p.id, x: slot.x, y: slot.y, w, h, rot: slot.rot, z: slot.z * 10 + gi,
        style, inset, frameAspect: aspect, tape: false,
        crop: Math.abs(rawA - A) > 0.02 || Math.abs(A - (1 - (inset.l + inset.r) / 100) / ((h - (h * (inset.t + inset.b)) / 100) / w)) > 0.06,
      };
    });

    relax(items, group);

    // one tape piece per spread at most, never on the anchor
    const tapeCandidate = items.filter((it) => it.style !== "polaroid" && it.id !== heroId);
    if (tapeCandidate.length > 2 && rnd() < 0.7) tapeCandidate[Math.floor(rnd() * tapeCandidate.length)].tape = true;

    const top = Math.min(...items.map((it) => it.y - it.h / 2));
    const bottom = Math.max(...items.map((it) => it.y + it.h / 2));
    const shift = 4 - top;
    items.forEach((it) => (it.y += shift));
    spreads.push({ index: si, height: bottom + shift + 4, items });
  }
  return spreads;
}

const rectOf = (it: Placed) => ({ l: it.x - it.w / 2, r: it.x + it.w / 2, t: it.y - it.h / 2, b: it.y + it.h / 2 });

/** Nudge higher photos off the subjects (focal points) of lower ones; re-order z if nudging can't fix it. */
function relax(items: Placed[], photos: PhotoLike[]) {
  const byId = new Map(photos.map((p) => [p.id, p]));
  const focal = (it: Placed) => {
    const p = byId.get(it.id)!;
    const ix = it.inset.l / 100, iw = 1 - (it.inset.l + it.inset.r) / 100;
    const iy = it.inset.t / 100, ih = 1 - (it.inset.t + it.inset.b) / 100;
    return { x: it.x - it.w / 2 + it.w * (ix + iw * p.focalX), y: it.y - it.h / 2 + it.h * (iy + ih * p.focalY), r: 0.2 * Math.min(it.w, it.h) };
  };
  const covers = (top: Placed, under: Placed) => {
    const f = focal(under);
    const r = rectOf(top);
    return f.x + f.r > r.l && f.x - f.r < r.r && f.y + f.r > r.t && f.y - f.r < r.b;
  };
  const overlapRatio = (a: Placed, b: Placed) => {
    const ra = rectOf(a), rb = rectOf(b);
    const ox = Math.max(0, Math.min(ra.r, rb.r) - Math.max(ra.l, rb.l));
    const oy = Math.max(0, Math.min(ra.b, rb.b) - Math.max(ra.t, rb.t));
    return (ox * oy) / Math.min(a.w * a.h, b.w * b.h);
  };
  const MAX_OVERLAP = 0.24;
  for (let pass = 0; pass < 24; pass++) {
    let moved = false;
    const sorted = [...items].sort((a, b) => a.z - b.z);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const under = sorted[i], top = sorted[j];
        const hitsSubject = covers(top, under);
        if (!hitsSubject && overlapRatio(top, under) <= MAX_OVERLAP) continue;
        // push the upper photo away from the subject (or, for plain overlap, from the other photo's centre)
        const f = hitsSubject ? focal(under) : { x: under.x, y: under.y };
        const dx = top.x - f.x, dy = top.y - f.y;
        const len = Math.hypot(dx, dy) || 1;
        top.x = clamp(top.x + (dx / len) * 1.3, top.w / 2 + 1, 100 - top.w / 2 - 1);
        top.y += (dy / len) * 1.3;
        moved = true;
      }
    }
    if (!moved) break;
  }
  // last resort: if a top photo still covers an underlying subject, slide it beneath (z swap)
  const sorted = [...items].sort((a, b) => a.z - b.z);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (covers(sorted[j], sorted[i]) && !covers(sorted[i], sorted[j])) {
        const z = sorted[i].z; sorted[i].z = sorted[j].z; sorted[j].z = z;
      }
    }
  }
}

/** Diagnostics used by tests and admin preview: worst subject coverage and overlap. */
export function auditSpread(spread: Spread, photos: PhotoLike[]) {
  const byId = new Map(photos.map((p) => [p.id, p]));
  let subjectCovered = 0, maxOverlap = 0;
  const items = [...spread.items].sort((a, b) => a.z - b.z);
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    const p = byId.get(a.id)!;
    const fx = a.x - a.w / 2 + a.w * p.focalX, fy = a.y - a.h / 2 + a.h * p.focalY;
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      const rb = rectOf(b), ra = rectOf(a);
      if (fx > rb.l && fx < rb.r && fy > rb.t && fy < rb.b) subjectCovered++;
      const ox = Math.max(0, Math.min(ra.r, rb.r) - Math.max(ra.l, rb.l));
      const oy = Math.max(0, Math.min(ra.b, rb.b) - Math.max(ra.t, rb.t));
      maxOverlap = Math.max(maxOverlap, (ox * oy) / Math.min(a.w * a.h, b.w * b.h));
    }
  }
  return { subjectCovered, maxOverlap };
}
