"use client";
import { forwardRef, memo, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { composeTable, type Placed } from "@/lib/compose";
import type { GroupPhoto } from "@/lib/types";
import { PhotoImg } from "./PhotoImg";
import { useExperience } from "./context";

export interface TableHandle {
  table: HTMLDivElement | null;
  hero: HTMLElement | null;
  /** print wrappers of the first spread (used by the pull-back reveal) */
  firstSpreadPrints: () => HTMLElement[];
}

const Print = memo(function Print({ it, photo, spreadH, index, isHero, onOpen }: {
  it: Placed; photo: GroupPhoto; spreadH: number; index: number; isHero: boolean; onOpen: (id: string, el: HTMLElement) => void;
}) {
  const { inset } = it;
  return (
    <div
      className="print-pos"
      data-hero={isHero ? "1" : undefined}
      style={{
        left: `${it.x - it.w / 2}%`,
        top: `${((it.y - it.h / 2) / spreadH) * 100}%`,
        width: `${it.w}%`,
        aspectRatio: String(it.frameAspect),
        zIndex: it.z + (isHero ? 20 : 0),
      }}
    >
      <button
        type="button"
        className={`print print--${it.style}`}
        data-photo-id={photo.id}
        data-rot={it.rot}
        aria-label={`Open group photograph ${index + 1}`}
        style={{ ["--rot" as string]: `${it.rot}deg` }}
        onClick={(e) => onOpen(photo.id, e.currentTarget)}
      >
        <span className="print-frame" style={{ inset: `${inset.t}% ${inset.r}% ${inset.b}% ${inset.l}%` }}>
          <PhotoImg asset={photo} sizes={isHero ? "100vw" : "(min-width: 860px) 24vw, 56vw"} eager={isHero} full={isHero} focal={it.crop} className="print-img" />
        </span>
        {it.tape && <i className="tape" aria-hidden />}
      </button>
    </div>
  );
});

export const GroupPhotoCollection = forwardRef<TableHandle, {
  photos: GroupPhoto[]; seed: number; heroId: string | null; wide: boolean; landInFirst: boolean;
}>(function GroupPhotoCollection({ photos, seed, heroId, wide, landInFirst }, ref) {
  const { openPhoto } = useExperience();
  const tableRef = useRef<HTMLDivElement>(null);
  const spreads = useMemo(() => composeTable(photos, seed, wide ? "landscape" : "portrait", heroId), [photos, seed, wide, heroId]);
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const spreadEls = useRef<(HTMLDivElement | null)[]>([]);

  useImperativeHandle(ref, () => ({
    get table() { return tableRef.current; },
    get hero() { return (tableRef.current?.querySelector('.print-pos[data-hero="1"]') as HTMLElement) || null; },
    firstSpreadPrints: () => Array.from(spreadEls.current[0]?.querySelectorAll<HTMLElement>(".print-pos") || []),
  }), []);

  const onOpen = (id: string, el: HTMLElement) => openPhoto({ id, mode: "peek", origin: el });

  // Later spreads "land" on the table the first time they scroll into view — a physical placement, not a fade-up.
  useLayoutEffect(() => {
    const els = spreadEls.current.filter(Boolean) as HTMLDivElement[];
    const skip = landInFirst ? 0 : 1;
    els.forEach((el, i) => { if (i >= skip) gsap.set(el.querySelectorAll(".print-pos"), { opacity: 0 }); });
    if (typeof IntersectionObserver === "undefined") { els.forEach((el) => gsap.set(el.querySelectorAll(".print-pos"), { opacity: 1 })); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const prints = e.target.querySelectorAll(".print-pos");
        gsap.fromTo(prints, { opacity: 0, y: -18, scale: 1.07 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "power3.out", stagger: 0.08, clearProps: "transform" });
      }
    }, { threshold: 0.14 });
    els.forEach((el, i) => { if (i >= skip) io.observe(el); });
    return () => io.disconnect();
  }, [spreads, landInFirst]);

  useEffect(() => {
    // safety net: if observers never fire (very tall viewport, print preview), don't leave prints invisible
    const t = setTimeout(() => {
      spreadEls.current.forEach((el) => { if (el && el.getBoundingClientRect().top < window.innerHeight * 1.5) gsap.to(el.querySelectorAll(".print-pos"), { opacity: 1, duration: 0.4, overwrite: "auto" }); });
    }, 6000);
    return () => clearTimeout(t);
  }, [spreads]);

  return (
    <section className="together" aria-labelledby="together-h" data-section="together">
      <h2 id="together-h" className="sr-only">Together</h2>
      <div className={`table ${wide ? "is-wide" : ""}`} ref={tableRef}>
        {spreads.map((sp, si) => (
          <div key={sp.index} ref={(el) => { spreadEls.current[si] = el; }} className="spread" style={{ aspectRatio: `100 / ${sp.height}`, marginTop: si ? (wide ? "-3%" : "-7%") : 0, zIndex: si }}>
            {sp.items.map((it, k) => {
              const photo = byId.get(it.id);
              if (!photo) return null;
              return <Print key={it.id} it={it} photo={photo} spreadH={sp.height} index={spreads.slice(0, si).reduce((n, s) => n + s.items.length, 0) + k} isHero={it.id === heroId} onOpen={onOpen} />;
            })}
          </div>
        ))}
      </div>
    </section>
  );
});
