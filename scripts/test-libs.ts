import assert from "node:assert/strict";
import { MemoryPool } from "../lib/memory-pool";
import { mulberry32 } from "../lib/rng";
import { auditSpread, composeTable } from "../lib/compose";
import { layoutBook } from "../lib/book-layout";
import seed from "../lib/seed-data.json";

// ---- memory pool
{
  const ids = Array.from({ length: 17 }, (_, i) => `p${i}`);
  const pool = new MemoryPool(ids, mulberry32(7));
  let prev: string | null = null;
  const cycle1: string[] = [];
  for (let i = 0; i < 17; i++) { const d = pool.draw()!; assert.notEqual(d, prev, "immediate repeat"); cycle1.push(d); prev = d; }
  assert.equal(new Set(cycle1).size, 17, "repeat before exhaustion");
  const cycle2: string[] = [];
  for (let i = 0; i < 17; i++) { const d = pool.draw()!; assert.notEqual(d, prev, "immediate repeat across reshuffle"); cycle2.push(d); prev = d; }
  assert.equal(new Set(cycle2.slice(0, 16)).size, 16, "repeat within 2nd cycle");
  // long soak: never an immediate repeat
  const p2 = new MemoryPool(["a", "b", "c"], mulberry32(1)); let last = null as string | null;
  for (let i = 0; i < 500; i++) { const d = p2.draw()!; assert.notEqual(d, last); last = d; }
  // manual open doesn't randomise and prevents immediate repeat
  const p3 = new MemoryPool(ids, mulberry32(3)); p3.draw(); p3.open("p5");
  assert.equal(p3.state.current, "p5"); assert.ok(!p3.state.available.includes("p5"));
  for (let i = 0; i < 40; i++) assert.notEqual(p3.draw(), i === 0 ? "p5" : "__never__");
  assert.equal(new MemoryPool([]).draw(), null);
  assert.equal(new MemoryPool(["only"]).draw(), "only");
  console.log("memory pool ✓");
}

// ---- compose
const photos = (seed.group as any[]).map((g) => ({ id: g.id, width: g.width, height: g.height, focalX: g.focalX, focalY: g.focalY }));
let worstCover = 0, worstOverlap = 0, sameCount = 0;
for (const mode of ["portrait", "landscape"] as const) {
  for (let s = 1; s <= 200; s++) {
    const spreads = composeTable(photos, s, mode, "g-04");
    const ids = spreads.flatMap((sp) => sp.items.map((i) => i.id));
    assert.equal(ids.length, photos.length); assert.equal(new Set(ids).size, photos.length, "duplicate/missing photo in composition");
    for (const sp of spreads) {
      const a = auditSpread(sp, photos);
      worstCover = Math.max(worstCover, a.subjectCovered); worstOverlap = Math.max(worstOverlap, a.maxOverlap);
      for (const it of sp.items) { assert.ok(Number.isFinite(it.x + it.y + it.w + it.h), "NaN in layout"); assert.ok(it.x - it.w / 2 > -4 && it.x + it.w / 2 < 104, "off-canvas " + it.x + " " + it.w); }
    }
    assert.deepEqual(composeTable(photos, s, mode, "g-04"), spreads, "not deterministic");
  }
}
console.log(`compose ✓  (200 seeds × 2 modes) worst subjects covered per spread: ${worstCover}, worst overlap ratio: ${worstOverlap.toFixed(2)}`);
for (const n of [1, 2, 3, 5, 7, 8, 13]) { const sp = composeTable(photos.slice(0, n), 5, "portrait"); assert.equal(sp.flatMap(s => s.items).length, n); }
assert.equal(composeTable([], 1, "portrait").length, 0);

// ---- book
for (const n of [1, 2, 3, 4, 5, 8, 11, 20]) {
  const ph = photos.slice(0, Math.min(n, photos.length));
  const pages = layoutBook(ph, 1, "x");
  assert.equal(pages.flatMap((p) => p.items).length, ph.length, "book lost/duplicated photos");
  for (const pg of pages) for (const it of pg.items) { assert.ok(it.x - it.w / 2 >= -1 && it.x + it.w / 2 <= 101 && it.y - it.h / 2 >= -1 && it.y + it.h / 2 <= 134, `book item off page: kind=${pg.kind} n=${n} ${JSON.stringify(it)}`); }
}
assert.equal(layoutBook([], 1, "x").length, 0);
console.log("book layout ✓");
