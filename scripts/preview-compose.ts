import fs from "node:fs";
import { composeTable } from "../lib/compose";
import seed from "../lib/seed-data.json";
const photos = (seed.group as any[]).map((g) => ({ id: g.id, width: g.width, height: g.height, focalX: g.focalX, focalY: g.focalY }));
const mode = (process.argv[2] || "portrait") as "portrait" | "landscape";
const seeds = (process.argv[3] || "1,2,3").split(",").map(Number);
fs.writeFileSync("/home/claude/work/compose.json", JSON.stringify(seeds.map((s) => ({ seed: s, spreads: composeTable(photos, s, mode, "g-04") }))));
