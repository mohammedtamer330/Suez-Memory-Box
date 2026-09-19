"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { layoutBook, PAGE_H, PAGE_W, type BookPage } from "@/lib/book-layout";
import type { Person, PersonPhoto } from "@/lib/types";
import type { SoundEngine } from "@/lib/sound";
import { BookCover, clothFor } from "./BookCover";
import { PhotoImg } from "./PhotoImg";

type Face = { t: "cover" } | { t: "end" } | { t: "page"; page: BookPage | null } | { t: "blank" };
interface Sheet { front: Face; back: Face }

export interface ReaderHandle {
  /** turns the cover open (resolves when the page settles) */
  open: () => Promise<void>;
  /** turns everything back to the closed cover */
  close: () => Promise<void>;
  next: () => void;
  prev: () => void;
  readonly index: number;
}

function buildSheets(pages: BookPage[], spread: boolean): Sheet[] {
  const sheets: Sheet[] = [{ front: { t: "cover" }, back: { t: "end" } }];
  if (!spread) {
    if (!pages.length) sheets.push({ front: { t: "page", page: null }, back: { t: "blank" } });
    for (const p of pages) sheets.push({ front: { t: "page", page: p }, back: { t: "blank" } });
  } else {
    if (!pages.length) sheets.push({ front: { t: "page", page: null }, back: { t: "page", page: null } });
    for (let i = 0; i < pages.length; i += 2) sheets.push({ front: { t: "page", page: pages[i] }, back: { t: "page", page: pages[i + 1] ?? null } });
  }
  return sheets;
}

function PageView({ page, side, photos, pw }: { page: BookPage | null; side: "left" | "right"; photos: Map<string, PersonPhoto>; pw: number }) {
  return (
    <div className={`bpage bpage--${side}`} style={{ fontSize: pw / 100 }}>
      {page?.items.map((it) => {
        const ph = photos.get(it.id);
        if (!ph) return null;
        return (
          <div
            key={it.id}
            className={`bitem bitem--${it.mount}`}
            style={{ left: `${((it.x - it.w / 2) / PAGE_W) * 100}%`, top: `${((it.y - it.h / 2) / PAGE_H) * 100}%`, width: `${(it.w / PAGE_W) * 100}%`, aspectRatio: String(it.aspect), transform: `rotate(${it.rot}deg)`, zIndex: it.z }}
          >
            <PhotoImg asset={ph} sizes={`${Math.round(pw)}px`} className="bitem-img" />
            {it.mount === "corners" && <><i className="pc pc--tl" /><i className="pc pc--tr" /><i className="pc pc--bl" /><i className="pc pc--br" /></>}
          </div>
        );
      })}
      <span className="bpage-gutter" aria-hidden />
    </div>
  );
}

/**
 * The reader. The cover is the first sheet; each sheet turns on its spine. Phones show one page at a
 * time (the turned sheet swings away and fades); wide screens show a true two-page spread.
 */
export const BookReader = forwardRef<ReaderHandle, {
  person: Pick<Person, "id" | "name" | "countryCode" | "layoutSeed">;
  photos: PersonPhoto[]; cover: PersonPhoto | null; spread: boolean; pw: number; sound: SoundEngine; reduced: boolean;
  onIndex?: (i: number, max: number) => void; interactive?: boolean;
}>(function BookReader({ person, photos, cover, spread, pw, sound, reduced, onIndex, interactive = true }, ref) {
  const ph = (pw * PAGE_H) / PAGE_W;
  const pages = useMemo(() => layoutBook(photos, person.layoutSeed || 1, person.id), [photos, person.layoutSeed, person.id]);
  const sheets = useMemo(() => buildSheets(pages, spread), [pages, spread]);
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const sheetEls = useRef<(HTMLDivElement | null)[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [index, setIndexState] = useState(0);
  const idx = useRef(0);
  const busy = useRef(false);
  const N = sheets.length;
  const maxIndex = spread ? N : N - 1;
  const maxRef = useRef(maxIndex); maxRef.current = maxIndex;

  const setIdx = useCallback((i: number) => { idx.current = i; setIndexState(i); onIndex?.(i, maxRef.current); }, [onIndex]);

  const paint = useCallback((i: number, rot: number) => {
    const el = sheetEls.current[i]; if (!el) return;
    const p = Math.min(1, Math.abs(rot) / 180);
    el.style.setProperty("--sh", String(Math.sin(p * Math.PI) * 0.55));
    if (!spread) el.style.opacity = String(p > 0.62 ? Math.max(0, 1 - (p - 0.62) / 0.3) : 1);
  }, [spread]);

  const restack = useCallback(() => {
    sheetEls.current.forEach((el, i) => {
      if (!el) return;
      const turned = i < idx.current;
      gsap.set(el, { zIndex: turned ? i + 1 : N - i });
      if (!spread) { el.style.visibility = turned ? "hidden" : ""; }
    });
    const w = wrapRef.current;
    if (w && spread) gsap.to(w, { x: idx.current === 0 ? -pw / 2 : idx.current >= N ? pw / 2 : 0, duration: reduced ? 0 : 0.7, ease: "power2.inOut" });
  }, [N, pw, reduced, spread]);

  useEffect(() => {
    sheetEls.current.forEach((el, i) => { if (el) { gsap.set(el, { rotationY: i < idx.current ? -180 : 0, transformPerspective: 2200 }); paint(i, i < idx.current ? -180 : 0); } });
    restack();
    if (wrapRef.current && spread) gsap.set(wrapRef.current, { x: idx.current === 0 ? -pw / 2 : idx.current >= N ? pw / 2 : 0 });
  }, [sheets, spread, pw]); // eslint-disable-line react-hooks/exhaustive-deps

  const tweenSheet = useCallback((i: number, toTurned: boolean, dur = 0.95) => new Promise<void>((res) => {
    const el = sheetEls.current[i]; if (!el) return res();
    gsap.killTweensOf(el);
    el.style.visibility = "";
    gsap.set(el, { zIndex: 200 });
    const to = toTurned ? -180 : 0;
    if (reduced) { gsap.set(el, { rotationY: to }); paint(i, to); res(); return; }
    gsap.to(el, { rotationY: to, duration: dur, ease: "power2.inOut", onUpdate: () => paint(i, Number(gsap.getProperty(el, "rotationY"))), onComplete: () => { paint(i, to); res(); } });
  }), [paint, reduced]);

  const go = useCallback(async (dir: 1 | -1, dur?: number) => {
    if (busy.current) return;
    const i = idx.current;
    if (dir === 1 && i >= maxRef.current) return;
    if (dir === -1 && i <= 0) return;
    busy.current = true;
    sound.play("page");
    const sheet = dir === 1 ? i : i - 1;
    setIdx(i + dir);
    await tweenSheet(sheet, dir === 1, dur);
    restack();
    busy.current = false;
  }, [restack, setIdx, sound, tweenSheet]);

  useImperativeHandle(ref, () => ({
    open: () => go(1, 1.1) as Promise<void>,
    close: async () => {
      if (idx.current === 0) return;
      // everything under the cover goes flat at once; the cover then swings shut over it
      busy.current = true;
      sheetEls.current.forEach((el, i) => { if (el && i > 0) { gsap.killTweensOf(el); gsap.set(el, { rotationY: 0, opacity: 1, visibility: "" }); } });
      sound.play("page");
      idx.current = 0; setIndexState(0); onIndex?.(0, maxRef.current);
      const w = wrapRef.current; if (w && spread) gsap.to(w, { x: -pw / 2, duration: 0.6, ease: "power2.inOut" });
      await tweenSheet(0, false, 0.65);
      restack();
      busy.current = false;
    },
    next: () => { void go(1); },
    prev: () => { void go(-1); },
    get index() { return idx.current; },
  }), [go, onIndex, pw, restack, sound, spread, tweenSheet]);

  /* --- drag to turn --- */
  const drag = useRef<{ x0: number; y0: number; t0: number; sheet: number; dir: 1 | -1; live: boolean; id: number } | null>(null);
  const travel = spread ? pw * 0.9 : pw * 0.8;
  const onDown = (e: React.PointerEvent) => {
    if (!interactive || busy.current || idx.current === 0) return;
    drag.current = { x0: e.clientX, y0: e.clientY, t0: performance.now(), sheet: -1, dir: 1, live: false, id: e.pointerId };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.live) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      d.dir = dx < 0 ? 1 : -1;
      if ((d.dir === 1 && idx.current >= maxRef.current) || (d.dir === -1 && idx.current <= 0)) { drag.current = null; return; }
      d.sheet = d.dir === 1 ? idx.current : idx.current - 1;
      d.live = true;
      const el = sheetEls.current[d.sheet];
      if (el) { gsap.killTweensOf(el); el.style.visibility = ""; gsap.set(el, { zIndex: 200 }); }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    // next: progress runs 0→1 as we drag left; prev: 1→0 as we drag right
    const prog = d.dir === 1 ? Math.min(1, Math.max(0, -dx / travel)) : Math.min(1, Math.max(0, 1 - dx / travel));
    const el = sheetEls.current[d.sheet];
    if (el) { gsap.set(el, { rotationY: -180 * prog }); paint(d.sheet, -180 * prog); }
  };
  const onUp = async (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null;
    if (!d || !d.live) return;
    const dx = e.clientX - d.x0;
    const v = Math.abs(dx) / Math.max(1, performance.now() - d.t0);
    const el = sheetEls.current[d.sheet];
    const rot = el ? Number(gsap.getProperty(el, "rotationY")) : 0;
    const prog = Math.abs(rot) / 180;
    const commit = d.dir === 1 ? prog > 0.3 || v > 0.5 : prog < 0.7 || v > 0.5;
    busy.current = true;
    const turned = d.dir === 1 ? commit : !commit;
    if (commit) { sound.play("page"); setIdx(idx.current + d.dir); }
    await tweenSheet(d.sheet, turned, 0.5);
    restack();
    busy.current = false;
  };

  const face = (f: Face, side: "left" | "right") => {
    if (f.t === "cover") return <BookCover person={person} cover={cover} eager sizes={`${Math.round(pw)}px`} />;
    if (f.t === "end") return <div className="bpage bpage--end" />;
    if (f.t === "blank") return <div className={`bpage bpage--${side}`} />;
    return <PageView page={f.page} side={side} photos={byId} pw={pw} />;
  };

  return (
    <div className="reader" style={{ width: spread ? pw * 2 : pw, height: ph, ["--pw" as string]: `${pw}px`, ["--cloth" as string]: clothFor(person.id) }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-index={index}>
      <div ref={wrapRef} className="reader-wrap" style={{ width: spread ? pw * 2 : pw, height: ph }}>
        <div className="reader-board" style={{ left: spread ? "50%" : 0, width: pw, height: ph }} />
        {spread && <div className="reader-board reader-board--l" style={{ left: 0, width: pw, height: ph, opacity: index > 0 ? 1 : 0 }} />}
        {sheets.map((s, i) => (
          <div
            key={i}
            ref={(el) => { sheetEls.current[i] = el; }}
            className={`sheet ${i === 0 ? "sheet--cover" : ""}`}
            style={{ left: spread ? "50%" : 0, width: pw, height: ph, zIndex: N - i }}
          >
            <div className="face face--front">{face(s.front, "right")}<i className="face-shade" /></div>
            <div className="face face--back">{face(s.back, "left")}<i className="face-shade face-shade--back" /></div>
          </div>
        ))}
      </div>
    </div>
  );
});
