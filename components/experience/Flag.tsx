import { countryName, flagSrc } from "@/lib/countries";

/** Real flag artwork (SVG from /public/flags) — never an emoji. */
export function Flag({ code, className = "", height = 16 }: { code: string; className?: string; height?: number }) {
  const w = Math.round((height * 4) / 3);
  return (
    <span className={`flag ${className}`} style={{ width: w, height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={flagSrc(code)} alt={`${countryName(code)} flag`} width={w} height={height} loading="eager" draggable={false} />
    </span>
  );
}
