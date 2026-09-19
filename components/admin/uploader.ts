"use client";
import { estimateFocal } from "@/lib/focal";
import { api } from "./api";

export interface UploadedAsset { url: string; thumbUrl: string; width: number; height: number; focalX: number; focalY: number; hash: string }
export type FileStatus = { name: string; state: "queued" | "processing" | "uploading" | "done" | "failed"; reason?: string };

const FULL_EDGE = 2000, THUMB_EDGE = 640, MAX_BYTES = 3.8 * 1024 * 1024;
export const ACCEPT = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"], "image/heic": [".heic"], "image/heif": [".heif"] };

const isHeic = (f: File) => /\.(heic|heif)$/i.test(f.name) || /image\/hei(c|f)/i.test(f.type);

async function decode(file: File): Promise<ImageBitmap> {
  let src: Blob = file;
  if (isHeic(file)) {
    const { heicTo } = await import("heic-to");
    src = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  }
  try { return await createImageBitmap(src, { imageOrientation: "from-image" }); }
  catch { throw new Error("This file couldn't be read as an image."); }
}

function encode(bmp: ImageBitmap, edge: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const k = Math.min(1, edge / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d")!; g.imageSmoothingQuality = "high"; g.drawImage(bmp, 0, 0, w, h);
  return new Promise((res, rej) => {
    c.toBlob((b) => {
      if (b && b.type === "image/webp") return res({ blob: b, w, h });
      // browsers that can't encode WebP fall back to PNG — re-encode as JPEG instead
      c.toBlob((j) => (j ? res({ blob: j, w, h }) : rej(new Error("Couldn't prepare this photo."))), "image/jpeg", quality);
    }, "image/webp", quality);
  });
}

async function sha1(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function prepare(file: File) {
  if (file.size > 60 * 1024 * 1024) throw new Error("This file is over 60 MB.");
  const [bmp, hash] = await Promise.all([decode(file), file.arrayBuffer().then(sha1)]);
  let full = await encode(bmp, FULL_EDGE, 0.86);
  for (const [edge, q] of [[FULL_EDGE, 0.78], [1800, 0.72], [1500, 0.68]] as const) {
    if (full.blob.size <= MAX_BYTES) break;
    full = await encode(bmp, edge, q);
  }
  if (full.blob.size > MAX_BYTES) throw new Error("This photo is too large even after resizing.");
  const thumb = await encode(bmp, THUMB_EDGE, 0.8);
  const s = Math.min(1, 48 / Math.max(bmp.width, bmp.height));
  const sw = Math.max(2, Math.round(bmp.width * s)), sh = Math.max(2, Math.round(bmp.height * s));
  const sc = document.createElement("canvas"); sc.width = sw; sc.height = sh;
  const sg = sc.getContext("2d", { willReadFrequently: true })!; sg.drawImage(bmp, 0, 0, sw, sh);
  const f = estimateFocal(sg.getImageData(0, 0, sw, sh).data, sw, sh);
  bmp.close?.();
  return { full, thumb, hash, focalX: f.x, focalY: f.y };
}

async function post(blob: Blob, variant: "full" | "thumb", scope: "group" | "person"): Promise<string> {
  const form = new FormData();
  form.set("file", new File([blob], `${variant}.${blob.type.includes("webp") ? "webp" : "jpg"}`, { type: blob.type }));
  form.set("variant", variant); form.set("scope", scope);
  const r = await api<{ url: string }>("/api/upload", { method: "POST", body: form });
  return r.url;
}

export async function uploadOne(file: File, scope: "group" | "person"): Promise<UploadedAsset> {
  const p = await prepare(file);
  const url = await post(p.full.blob, "full", scope);
  const thumbUrl = await post(p.thumb.blob, "thumb", scope);
  return { url, thumbUrl, width: p.full.w, height: p.full.h, focalX: p.focalX, focalY: p.focalY, hash: p.hash };
}

/** Upload many files, 3 at a time. One failure never stops the others. */
export async function uploadMany(files: File[], scope: "group" | "person", onStatus: (i: number, s: FileStatus) => void): Promise<{ assets: UploadedAsset[]; failed: number }> {
  const assets: (UploadedAsset | null)[] = new Array(files.length).fill(null);
  let next = 0, failed = 0;
  files.forEach((f, i) => onStatus(i, { name: f.name, state: "queued" }));
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      const f = files[i];
      try {
        onStatus(i, { name: f.name, state: "processing" });
        const p = await prepare(f);
        onStatus(i, { name: f.name, state: "uploading" });
        const url = await post(p.full.blob, "full", scope);
        const thumbUrl = await post(p.thumb.blob, "thumb", scope);
        assets[i] = { url, thumbUrl, width: p.full.w, height: p.full.h, focalX: p.focalX, focalY: p.focalY, hash: p.hash };
        onStatus(i, { name: f.name, state: "done" });
      } catch (e) {
        failed++;
        onStatus(i, { name: f.name, state: "failed", reason: e instanceof Error ? e.message : "Upload failed." });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
  return { assets: assets.filter((a): a is UploadedAsset => Boolean(a)), failed };
}
