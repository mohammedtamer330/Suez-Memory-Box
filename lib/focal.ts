import { clamp } from "./rng";

/**
 * Heuristic subject finder. NOT face detection — it weights skin-tone likelihood and local
 * contrast, with a soft centre prior, and returns the weighted centroid. It's good enough to
 * keep "where the people are" away from aggressive crops; admins can override per photo.
 *
 * `rgba` is a small downsample (long edge ≈ 48px) so this is cheap in the browser and in Node.
 */
export function estimateFocal(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): { x: number; y: number } {
  if (w < 2 || h < 2) return { x: 0.5, y: 0.5 };
  const luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) luma[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  let sw = 0, sx = 0, sy = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
      const skin = r > 95 && g > 40 && b > 20 && Math.max(r, g, b) - Math.min(r, g, b) > 15 && Math.abs(r - g) > 12 && r > g && r > b ? 1 : 0;
      const gx = luma[i + 1] - luma[i - 1];
      const gy = luma[i + w] - luma[i - w];
      const edge = Math.min(1, Math.hypot(gx, gy) / 90);
      const nx = x / (w - 1) - 0.5, ny = y / (h - 1) - 0.5;
      const centre = Math.exp(-(nx * nx + ny * ny) / (2 * 0.32 * 0.32));
      const wgt = (0.65 * skin + 0.35 * edge + 0.02) * (0.35 + 0.65 * centre);
      sw += wgt; sx += wgt * (x / (w - 1)); sy += wgt * (y / (h - 1));
    }
  }
  if (sw <= 0) return { x: 0.5, y: 0.5 };
  return { x: clamp(sx / sw, 0.15, 0.85), y: clamp(sy / sw, 0.15, 0.85) };
}
