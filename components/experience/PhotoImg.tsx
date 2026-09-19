"use client";
import { useCallback, useState } from "react";
import type { ImageAsset } from "@/lib/types";

/**
 * A photograph that never shows broken-image UI: it fades in when loaded, and if it fails it quietly
 * falls back to the thumbnail, then to blank paper. Intrinsic width/height are always present when known.
 */
export function PhotoImg({
  asset, sizes, eager, alt = "", className, style, focal, full,
}: {
  asset: ImageAsset; sizes?: string; eager?: boolean; /** always use the full-size file (for images that will be scaled up by transforms) */ full?: boolean; alt?: string; className?: string; style?: React.CSSProperties; focal?: boolean;
}) {
  const [stage, setStage] = useState<"main" | "thumb" | "failed">("main");
  const [loaded, setLoaded] = useState(false);
  const known = asset.width > 0 && asset.height > 0;
  const A = known ? asset.width / asset.height : 0;
  const tw = known ? Math.round(A >= 1 ? Math.min(640, asset.width) : Math.min(640, asset.height) * A) : 0;
  const useSet = !full && known && asset.thumbUrl !== asset.url && tw < asset.width && stage === "main";
  const src = stage === "thumb" ? asset.thumbUrl : asset.url;
  const ref = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);
  if (stage === "failed") return <span className={`img-fail ${className || ""}`} style={style} aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={useSet ? asset.thumbUrl : src}
      srcSet={useSet ? `${asset.thumbUrl} ${tw}w, ${asset.url} ${asset.width}w` : undefined}
      sizes={useSet ? sizes || "60vw" : undefined}
      width={known ? asset.width : undefined}
      height={known ? asset.height : undefined}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={`pimg ${loaded ? "is-loaded" : ""} ${className || ""}`}
      style={{ ...(focal ? { objectPosition: `${asset.focalX * 100}% ${asset.focalY * 100}%` } : null), ...style }}
      onLoad={() => setLoaded(true)}
      onError={() => setStage((s) => (s === "main" && asset.thumbUrl !== asset.url ? "thumb" : "failed"))}
    />
  );
}
