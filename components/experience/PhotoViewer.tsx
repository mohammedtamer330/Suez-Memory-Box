"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useHistoryLayer } from "@/hooks/useHistoryLayer";
import { useScrollLock } from "@/hooks/useScrollLock";
import { PhotoImg } from "./PhotoImg";
import { useExperience } from "./context";

export interface ViewerState { id: string; mode: "peek" | "reveal"; origin: HTMLElement | null }

const BORDER = 0.03; // print border as a fraction of the photo width

function fit(aspect: number, vw: number, vh: number, top: number, bottom: number) {
  const side = vw < 520 ? 16 : 40;
  const maxW = vw - side * 2, maxH = vh - top - bottom;
  // frame = photo + border on every side; the photo itself is never cropped
  let pw = maxW / (1 + 2 * BORDER);
  let ph = pw / aspect;
  if (ph * (1 + 2 * BORDER) > maxH) { ph = maxH / (1 + 2 * BORDER); pw = ph * aspect; }
  pw = Math.min(pw, 1100);
  ph = pw / aspect;
  const b = pw * BORDER;
  return { pw, ph, b, w: pw + 2 * b, h: ph + 2 * b };
}

export function PhotoViewer({ state, onClose }: { state: ViewerState | null; onClose: () => void }) {
  const { group, pool, sound, reduced, flash } = useExperience();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const busy = useRef(false);
  const stateRef = useRef<ViewerState | null>(null);
  const byId = useMemo(() => new Map(group.map((p) => [p.id, p])), [group]);
  const photo = currentId ? byId.get(currentId) ?? null : null;
  const active = Boolean(state);
  useScrollLock(active);

  const dims = useCallback(() => {
    if (!photo) return null;
    const A = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 4 / 3;
    const vw = window.innerWidth, vh = window.innerHeight;
    const sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat")) || 0;
    const reveal = stateRef.current?.mode === "reveal";
    return { ...fit(A, vw, vh, 56 + sat, reveal ? 118 : 64), vw, vh };
  }, [photo]);

  /* --- open --- */
  useEffect(() => {
    if (state) { stateRef.current = state; closing.current = false; setCurrentId(state.id); setMounted(true); }
  }, [state]);

  useLayoutEffect(() => {
    const st = stateRef.current;
    if (!state || !photo || !mounted || !st || busy.current) return;
    const card = cardRef.current, bg = bgRef.current, shadow = shadowRef.current, chrome = chromeRef.current;
    const d = dims();
    if (!card || !bg || !d || !shadow || !chrome) return;
    if (card.dataset.opened === state.id + ":" + st.mode) return; // already placed
    card.dataset.opened = state.id + ":" + st.mode;
    const img = card.querySelector<HTMLElement>(".vcard-img");
    const tx = d.vw / 2 - d.w / 2, ty = d.vh / 2 - d.h / 2 + (st.mode === "reveal" ? -22 : -4);
    gsap.set(card, { width: d.w, height: d.h, x: tx, y: ty, transformPerspective: 1100 });
    const rot = (((state.id.length * 7) % 5) - 2) * 0.55;
    gsap.killTweensOf([card, bg, shadow, chrome, img]);
    if (st.mode === "peek" && st.origin && !reduced) {
      const r = st.origin.getBoundingClientRect();
      const s = Math.max(0.05, r.width / d.w);
      const fromRot = parseFloat(st.origin.dataset.rot || "0") || 0;
      st.origin.style.visibility = "hidden";
      gsap.fromTo(card, { x: r.left + r.width / 2 - d.w / 2, y: r.top + r.height / 2 - d.h / 2, scale: s, rotation: fromRot, opacity: 1, rotationX: 0 },
        { x: tx, y: ty, scale: 1, rotation: rot, opacity: 1, rotationX: 0, duration: 0.72, ease: "power3.out" });
      sound.play("photo");
    } else if (st.mode === "reveal" && !reduced) {
      gsap.fromTo(card, { scale: 0.9, rotation: rot + 5, opacity: 1, y: ty + 26, rotationX: 10 }, { scale: 1, rotation: rot, y: ty, rotationX: 0, duration: 1.0, ease: "power3.out" });
      // the photograph "develops": pale and cool at first, then settles into full colour
      if (img) gsap.fromTo(img, { filter: "brightness(1.55) contrast(.7) saturate(.25)" }, { filter: "brightness(1) contrast(1) saturate(1)", duration: 1.7, ease: "power2.out", delay: 0.15, clearProps: "filter" });
    } else {
      gsap.fromTo(card, { opacity: 0, scale: 0.96, rotation: rot }, { opacity: 1, scale: 1, rotation: rot, duration: 0.3, ease: "power2.out" });
    }
    gsap.fromTo(bg, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.2 : 0.5, ease: "power2.out" });
    gsap.fromTo(shadow, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: "power2.out" });
    gsap.fromTo(chrome, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: reduced ? 0 : 0.35 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, photo, mounted]);

  /* --- swap content in place (after the camera flash) --- */
  const relayout = useCallback(() => {
    const card = cardRef.current, d = dims();
    if (!card || !d) return;
    card.dataset.opened = (currentId || "") + ":" + (stateRef.current?.mode || "");
    const rot = (((String(currentId).length * 7 + Math.floor(Math.random() * 5)) % 5) - 2) * 0.6;
    gsap.set(card, { width: d.w, height: d.h, x: d.vw / 2 - d.w / 2, y: d.vh / 2 - d.h / 2 - 22, scale: 1, rotation: rot, rotationX: 0, opacity: 1 });
    const img = card.querySelector<HTMLElement>(".vcard-img");
    if (img && !reduced) gsap.fromTo(img, { filter: "brightness(1.55) contrast(.7) saturate(.25)" }, { filter: "brightness(1) contrast(1) saturate(1)", duration: 1.6, ease: "power2.out", delay: 0.1, clearProps: "filter" });
  }, [dims, currentId, reduced]);

  useLayoutEffect(() => {
    if (mounted && photo && cardRef.current?.dataset.opened && cardRef.current.dataset.swap === "1") { cardRef.current.dataset.swap = ""; relayout(); }
  }, [currentId, mounted, photo, relayout]);

  useEffect(() => {
    if (!mounted) return;
    const onResize = () => {
      const card = cardRef.current, d = dims();
      if (!card || !d || closing.current) return;
      gsap.set(card, { width: d.w, height: d.h, x: d.vw / 2 - d.w / 2, y: d.vh / 2 - d.h / 2 - (stateRef.current?.mode === "reveal" ? 22 : 4) });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted, dims]);

  /* --- close --- */
  const finish = useCallback(() => {
    const o = stateRef.current?.origin;
    if (o) o.style.visibility = "";
    setMounted(false);
    setCurrentId(null);
    if (cardRef.current) cardRef.current.dataset.opened = "";
    closing.current = false;
    onClose();
  }, [onClose]);

  const close = useCallback((flick?: number) => {
    if (closing.current) return;
    closing.current = true;
    const card = cardRef.current, bg = bgRef.current, shadow = shadowRef.current, chrome = chromeRef.current;
    const st = stateRef.current;
    if (!card || !bg || !st) { finish(); return; }
    sound.play("paper");
    gsap.killTweensOf([card, bg, shadow, chrome]);
    gsap.to(chrome, { opacity: 0, duration: 0.15 });
    gsap.to(shadow, { opacity: 0, duration: 0.3 });
    gsap.to(bg, { opacity: 0, duration: reduced ? 0.15 : 0.5, ease: "power2.inOut" });
    const o = st.origin;
    const r = o && o.isConnected ? o.getBoundingClientRect() : null;
    const onScreen = r && r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
    if (st.mode === "peek" && onScreen && r && !reduced) {
      const d = dims();
      const s = d ? Math.max(0.05, r.width / d.w) : 0.3;
      const toRot = parseFloat(o!.dataset.rot || "0") || 0;
      gsap.to(card, { x: r.left + r.width / 2 - (d?.w ?? 0) / 2, y: r.top + r.height / 2 - (d?.h ?? 0) / 2, scale: s, rotation: toRot, duration: 0.55, ease: "power3.inOut", onComplete: finish });
    } else if (!reduced) {
      const dir = flick && flick < 0 ? -1 : 1;
      gsap.to(card, { y: `+=${dir * window.innerHeight * 0.7}`, rotation: `+=${dir * 6}`, opacity: 0, duration: 0.5, ease: "power2.in", onComplete: finish });
    } else gsap.to(card, { opacity: 0, duration: 0.15, onComplete: finish });
  }, [dims, finish, reduced, sound]);

  useHistoryLayer(active, () => close());

  useEffect(() => {
    if (!mounted) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [mounted, close]);

  /* --- drag to dismiss --- */
  const drag = useRef<{ id: number; y0: number; x0: number; t0: number; moved: boolean; startY: number; startX: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (busy.current || closing.current) return;
    const card = cardRef.current; if (!card) return;
    card.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, y0: e.clientY, x0: e.clientX, t0: performance.now(), moved: false, startY: Number(gsap.getProperty(card, "y")), startX: Number(gsap.getProperty(card, "x")) };
    gsap.killTweensOf(card);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; const card = cardRef.current; if (!d || !card || d.id !== e.pointerId) return;
    const dy = e.clientY - d.y0, dx = e.clientX - d.x0;
    if (!d.moved && Math.hypot(dx, dy) > 6) d.moved = true;
    if (!d.moved) return;
    gsap.set(card, { x: d.startX + dx * 0.6, y: d.startY + dy, rotation: dx * 0.03 });
    if (bgRef.current) gsap.set(bgRef.current, { opacity: Math.max(0.25, 1 - Math.abs(dy) / 520) });
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; const card = cardRef.current; drag.current = null;
    if (!d || !card) return;
    const dy = e.clientY - d.y0;
    const v = dy / Math.max(1, performance.now() - d.t0);
    if (d.moved && (Math.abs(dy) > 110 || Math.abs(v) > 0.7)) { close(Math.sign(dy)); return; }
    if (d.moved) {
      const dm = dims();
      if (dm) gsap.to(card, { x: dm.vw / 2 - dm.w / 2, y: dm.vh / 2 - dm.h / 2 - (stateRef.current?.mode === "reveal" ? 22 : 4), rotation: 0, duration: 0.45, ease: "back.out(1.4)" });
      if (bgRef.current) gsap.to(bgRef.current, { opacity: 1, duration: 0.3 });
    }
  };

  /* --- "another memory" (reveal only) --- */
  const another = async () => {
    if (busy.current || closing.current) return;
    busy.current = true;
    await flash();
    const next = pool.draw();
    if (next && byId.has(next)) {
      if (cardRef.current) cardRef.current.dataset.swap = "1";
      setCurrentId(next);
    }
    setTimeout(() => { busy.current = false; }, 500);
  };

  if (!mounted || !photo) return null;
  const reveal = stateRef.current?.mode === "reveal";
  const d = dims();
  return (
    <div ref={rootRef} className="viewer" role="dialog" aria-modal="true" aria-label="Photograph">
      <div ref={bgRef} className="viewer-bg" onClick={() => close()} />
      <div ref={chromeRef} className="viewer-chrome">
        <button type="button" className="viewer-close" onClick={() => close()} aria-label="Put the photograph back">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        {reveal && (
          <button type="button" className="viewer-another" onClick={another} aria-label="Take another memory from the stack">
            <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M4 11h5l2-3h10l2 3h5v14H4z" /><circle cx="16" cy="18" r="5" /><circle cx="25" cy="14" r=".8" fill="currentColor" /></svg>
          </button>
        )}
      </div>
      <div ref={shadowRef} className="viewer-shadow" style={d ? { width: d.w * 0.92, height: d.h * 0.92, left: d.vw / 2 - (d.w * 0.92) / 2, top: d.vh / 2 - (d.h * 0.92) / 2 + 26 } : undefined} />
      <div
        ref={cardRef}
        className="vcard"
        style={{ padding: d?.b, touchAction: "none" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      >
        <div className="vcard-photo"><PhotoImg key={photo.id} asset={photo} eager className="vcard-img" sizes="100vw" alt="" /></div>
      </div>
    </div>
  );
}
