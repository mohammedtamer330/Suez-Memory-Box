/**
 * One-off: turns the original bundled photos + roster into the seed data the site falls back to
 * when the database is empty. Run: npx tsx scripts/build-seed.ts
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { estimateFocal } from "../lib/focal";
import { countryCodeFromName } from "../lib/countries";

const ORIG = "/home/claude/work/orig/icx-memory-box-vercel";
const OUT = path.resolve("public/seed");
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const dir = path.join(ORIG, "public/seed-memories");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort();
  const seen = new Map<string, string>();
  const group: unknown[] = [];
  let order = 0;
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f));
    const hash = crypto.createHash("sha1").update(buf).digest("hex");
    if (seen.has(hash)) { console.log(`skip duplicate ${f} (same bytes as ${seen.get(hash)})`); continue; }
    seen.set(hash, f);
    const id = f.replace(".jpg", "").replace("memory-", "g-");
    const img = sharp(buf).rotate();
    const meta = await img.clone().toBuffer({ resolveWithObject: true });
    const full = await img.clone().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    const thumb = await img.clone().resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
    fs.writeFileSync(path.join(OUT, `${id}.webp`), full.data);
    fs.writeFileSync(path.join(OUT, `${id}-t.webp`), thumb);
    const small = await img.clone().resize({ width: 48, height: 48, fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const f2 = estimateFocal(new Uint8ClampedArray(small.data), small.info.width, small.info.height);
    group.push({ id, url: `/seed/${id}.webp`, thumbUrl: `/seed/${id}-t.webp`, width: full.info.width, height: full.info.height,
      focalX: +f2.x.toFixed(3), focalY: +f2.y.toFixed(3), hash, sortOrder: order++, priority: false, createdAt: "2026-01-01T00:00:00.000Z" });
    console.log(id, full.info.width + "x" + full.info.height, `focal ${f2.x.toFixed(2)},${f2.y.toFixed(2)}`, (full.data.length/1024|0)+"KB");
  }
  // roster
  const src = fs.readFileSync(path.join(ORIG, "lib/sample-data.ts"), "utf8");
  const re = /\{ id: "([^"]+)", name: "([^"]+)", country: "([^"]+)"/g;
  const people: unknown[] = [];
  let m, i = 0;
  while ((m = re.exec(src))) {
    const code = countryCodeFromName(m[3]);
    if (!code) throw new Error("no country code for " + m[3]);
    people.push({ id: m[1], name: m[2], countryCode: code, coverPhotoId: null, sortOrder: i++, layoutSeed: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
  }
  fs.writeFileSync("lib/seed-data.json", JSON.stringify({ people, group }, null, 1));
  console.log(people.length, "people,", group.length, "group photos");
}
main();
