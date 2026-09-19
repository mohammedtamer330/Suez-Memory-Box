"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useHistoryLayer } from "@/hooks/useHistoryLayer";
import { useIsWide } from "@/hooks/useReducedMotion";
import { useScrollLock } from "@/hooks/useScrollLock";
import { resolveCoverClient } from "@/lib/cover";
import { BookReader, type ReaderHandle } from "./BookReader";
import { useExperience } from "./context";

export interface BookState { personId: string; origin: HTMLElement | null }

function sizeFor(spread: boolean) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const h = vh - 150;
  const pw = spread ? Math.min((vw - 72) / 2, h * 0.75, 520) : Math.min(vw - 30, h * 0.75, 520);
  return Math.max(150, Math.floor(pw));
}

/** Full-screen reader. The book leaves the shelf, comes to the front, opens; closing shuts it and returns it. */
export function MemoryBook({ state, onClose }: { state: BookState | null; onClose: () => void }) {
  const { people, sound, reduced } = useExperience();
  const wide = useIsWide(900);
  const spread = Boolean(wide);
  const [mounted, setMounted] = useState(false);
  const [pw, setPw] = useState(300);
  const [pos, setPos] = useState({ i: 0, max: 1 });
  const stRef = useRef<BookState | null>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const reader = useRef<ReaderHandle>(null);
  const closing = useRef(false);
  const opened = useRef("");
  const active = Boolean(state);
  useScrollLock(active);

  const person = useMemo(() => people.find((p) => p.id === state?.personId) ?? people.find((p) => p.id === stRef.current?.personId) ?? null, [people, state]);

  useEffect(() => { if (state) { stRef.current = state; closing.current = false; setPw(sizeFor(spread)); setMounted(true); } }, [state, spread]);
  useEffect(() => {
    if (!mounted) return;
    const on = () => setPw(sizeFor(spread));
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [mounted, spread]);

  useLayoutEffect(() => {
    const st = stRef.current;
    if (!mounted || !state || !st || !person || !hostRef.current || opened.current === st.personId) return;
    opened.current = st.personId;
    const host = hostRef.current, bg = bgRef.current, chrome = chromeRef.current;
    gsap.set(host, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
    gsap.fromTo(bg, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.2 : 0.55, ease: "power2.out" });
    gsap.set(chrome, { opacity: 0 });
    const o = st.origin;
    const start = async () => {
      if (o && !reduced) {
        const r = o.getBoundingClientRect();
        const s = Math.max(0.05, r.width / pw);
        o.style.visibility = "hidden";
        await new Promise<void>((res) => gsap.fromTo(host,
          { x: r.left + r.width / 2 - window.innerWidth / 2, y: r.top + r.height / 2 - window.innerHeight / 2 - 8, scale: s, rotation: 0 },
          { x: 0, y: -8, scale: 1, rotation: 0, duration: 0.85, ease: "power3.inOut", onComplete: res }));
      } else gsap.fromTo(host, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.3 });
      if (closing.current) return;
      gsap.to(chrome, { opacity: 1, duration: 0.5 });
      await new Promise((r) => setTimeout(r, reduced ? 0 : 160));
      if (!closing.current) await reader.current?.open();
    };
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, state, person]);

  const finish = useCallback(() => {
    const o = stRef.current?.origin; if (o) o.style.visibility = "";
    opened.current = "";
    setMounted(false);
    closing.current = false;
    onClose();
  }, [onClose]);

  const close = useCallback(async () => {
    if (closing.current) return;
    closing.current = true;
    const host = hostRef.current, bg = bgRef.current, chrome = chromeRef.current;
    if (!host || !bg) { finish(); return; }
    gsap.to(chrome, { opacity: 0, duration: 0.2 });
    await reader.current?.close();
    sound.play("thump");
    const o = stRef.current?.origin;
    const r = o && o.isConnected ? o.getBoundingClientRect() : null;
    const on = r && r.bottom > 0 && r.top < window.innerHeight;
    gsap.to(bg, { opacity: 0, duration: reduced ? 0.15 : 0.6, ease: "power2.inOut" });
    if (r && on && !reduced) {
      gsap.to(host, { x: r.left + r.width / 2 - window.innerWidth / 2, y: r.top + r.height / 2 - window.innerHeight / 2 - 8, scale: Math.max(0.05, r.width / pw), duration: 0.7, ease: "power3.inOut", onComplete: finish });
    } else gsap.to(host, { opacity: 0, scale: 0.94, duration: 0.3, onComplete: finish });
  }, [finish, pw, reduced, sound]);

  useHistoryLayer(active, () => { void close(); });
  useEffect(() => {
    if (!mounted) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") void close();
      else if (e.key === "ArrowRight") reader.current?.next();
      else if (e.key === "ArrowLeft") reader.current?.prev();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [mounted, close]);

  if (!mounted || !person) return null;
  const photos = person.photos;
  const cover = resolveCoverClient(person);
  const atStart = pos.i <= 0, atEnd = pos.i >= pos.max;
  return (
    <div className="mbook" role="dialog" aria-modal="true" aria-label={`${person.name}’s memory book`}>
      <div ref={bgRef} className="mbook-bg" onClick={() => { void close(); }} />
      <div ref={hostRef} className="mbook-host">
        <BookReader ref={reader} person={person} photos={photos} cover={cover} spread={spread} pw={pw} sound={sound} reduced={reduced} onIndex={(i, max) => setPos({ i, max })} />
      </div>
      <div ref={chromeRef} className="mbook-chrome">
        <button type="button" className="viewer-close" onClick={() => { void close(); }} aria-label="Close the book">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="mbook-nav">
          <button type="button" className="mbook-arrow" onClick={() => reader.current?.prev()} disabled={atStart || pos.i <= 1 && !spread && false} aria-label="Previous page" style={{ opacity: atStart ? 0.25 : 1 }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button type="button" className="mbook-arrow" onClick={() => reader.current?.next()} disabled={atEnd} aria-label="Next page" style={{ opacity: atEnd ? 0.25 : 1 }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
