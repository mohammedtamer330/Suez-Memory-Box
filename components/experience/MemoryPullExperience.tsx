"use client";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import gsap from "gsap";
import { mulberry32, hashString } from "@/lib/rng";
import { useExperience } from "./context";

/**
 * "Pull a memory": a physical stack of face-down prints. Press, drag up, release — the top print is
 * pulled free, the camera flashes, and a random photograph (never one seen this cycle) is revealed.
 * Touch gestures are disambiguated: an upward pull on the print drags it; sideways/downward movement
 * is handed back to page scrolling so the stack never traps a scroll.
 */
export function MemoryPullExperience() {
  const { pool, group, flash, openPhoto, reduced, sound } = useExperience();
  const version = useSyncExternalStore((cb) => pool.subscribe(cb), () => pool.version, () => 0);
  void version;
  const layers = Math.max(1, Math.min(6, Math.ceil(pool.remainingRatio * 6)));
  const topRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const g = useRef<{ id: number; x0: number; y0: number; t0: number; mode: "wait" | "pull" | "scroll"; samples: { y: number; t: number }[]; lastY: number; pull: boolean; type: string } | null>(null);
  const inertia = useRef<number | null>(null);

  const rest = useCallback((animate: boolean) => {
    const el = topRef.current; if (!el) return;
    gsap.killTweensOf(el);
    const set = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };
    if (animate) gsap.to(el, { ...set, duration: 0.6, ease: "back.out(1.7)" }); else gsap.set(el, set);
    if (shadowRef.current) gsap.to(shadowRef.current, { opacity: 0.55, duration: 0.4 });
  }, []);

  const complete = useCallback(async (dy: number, dx: number) => {
    const el = topRef.current; if (!el || busy.current) return;
    busy.current = true;
    sound.unlock(); sound.play("paper");
    if (hintRef.current) gsap.to(hintRef.current, { opacity: 0, duration: 0.4 });
    gsap.killTweensOf(el);
    if (!reduced) gsap.to(el, { y: dy - 260, x: dx * 1.3, rotation: dx * 0.08 + 6, scale: 1.1, opacity: 0.0, duration: 0.7, ease: "power2.in" });
    await new Promise((r) => setTimeout(r, reduced ? 60 : 200));
    await flash();
    const id = pool.draw();
    if (id) openPhoto({ id, mode: "reveal" });
    // put the next print on top, out of sight behind the viewer
    setTimeout(() => { rest(false); gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5 }); busy.current = false; }, 700);
  }, [flash, openPhoto, pool, reduced, rest, sound]);

  const onDown = (e: React.PointerEvent) => {
    if (busy.current) return;
    const el = topRef.current; if (!el) return;
    if (inertia.current) { cancelAnimationFrame(inertia.current); inertia.current = null; }
    el.setPointerCapture(e.pointerId);
    g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), mode: "wait", samples: [{ y: e.clientY, t: performance.now() }], lastY: e.clientY, pull: false, type: e.pointerType };
    sound.unlock();
  };
  const onMove = (e: React.PointerEvent) => {
    const s = g.current; const el = topRef.current; if (!s || !el || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    const now = performance.now();
    s.samples.push({ y: e.clientY, t: now }); if (s.samples.length > 6) s.samples.shift();
    if (s.mode === "wait") {
      if (Math.hypot(dx, dy) < 9) return;
      // deliberate upward pull → drag the print; anything else on touch → scroll the page
      if (s.type !== "touch" || (dy < 0 && Math.abs(dy) > Math.abs(dx) * 0.8)) { s.mode = "pull"; gsap.killTweensOf(el); gsap.to(shadowRef.current, { opacity: 1, duration: 0.2 }); gsap.to(el, { scale: 1.045, duration: 0.25 }); sound.play("paper"); }
      else { s.mode = "scroll"; s.lastY = e.clientY; }
    }
    if (s.mode === "pull") {
      const y = dy < 0 ? dy : dy * 0.28;               // resistance when pushed down
      gsap.set(el, { x: dx * 0.55, y, rotation: dx * 0.045 + Math.min(0, dy) * -0.006 });
    } else if (s.mode === "scroll") {
      window.scrollBy(0, s.lastY - e.clientY); s.lastY = e.clientY;
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const s = g.current; const el = topRef.current; g.current = null;
    if (!s || !el) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (s.mode === "scroll") {
      const a = s.samples[0], b = s.samples[s.samples.length - 1];
      let v = a && b && b.t > a.t ? (a.y - b.y) / (b.t - a.t) * 16 : 0; // px/frame
      const step = () => { if (Math.abs(v) < 0.4) { inertia.current = null; return; } window.scrollBy(0, v); v *= 0.95; inertia.current = requestAnimationFrame(step); };
      inertia.current = requestAnimationFrame(step);
      return;
    }
    if (s.mode === "wait") { // a tap (no drag): give the print a small tug, and offer the keyboard-equivalent action
      if (s.type === "mouse" || s.type === "pen") { void complete(-40, 0); }
      else gsap.fromTo(el, { y: 0 }, { y: -14, duration: 0.18, yoyo: true, repeat: 1, ease: "power1.out" });
      return;
    }
    const a = s.samples[0], b = s.samples[s.samples.length - 1];
    const vy = a && b && b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0; // px/ms (negative = up)
    const h = el.offsetHeight;
    if (dy < -Math.max(90, h * 0.3) || (vy < -0.6 && dy < -36)) void complete(dy, dx);
    else { sound.play("paper"); rest(true); }
  };
  const onCancel = () => { g.current = null; rest(true); };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void complete(-60, 0); } };

  // gentle idle bob to show the print can be pulled (not when reduced-motion, not while engaged)
  useEffect(() => {
    if (reduced) return;
    const el = topRef.current; if (!el) return;
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 2.6, delay: 1.5 });
    tl.to(el, { y: -12, duration: 0.5, ease: "power2.out" }).to(el, { y: 0, duration: 0.7, ease: "bounce.out" });
    return () => { tl.kill(); };
  }, [reduced]);

  const rnd = mulberry32(hashString("stack:" + group.length));
  const under = Array.from({ length: layers }, (_, i) => ({ x: (rnd() - 0.5) * 12, y: (i + 1) * 3.2, r: (rnd() - 0.5) * 5.5 }));

  if (!group.length) return null;
  return (
    <section className="pull" aria-labelledby="pull-h" data-section="pull">
      <h2 id="pull-h" className="sr-only">Pull a memory</h2>
      <div className="pull-stage">
        {under.map((u, i) => (
          <div key={i} className="pull-card pull-under" style={{ transform: `translate(${u.x}px, ${u.y}px) rotate(${u.r}deg)`, zIndex: 5 - i }} />
        ))}
        <div ref={shadowRef} className="pull-shadow" />
        <div
          ref={topRef}
          className="pull-card pull-top"
          role="button"
          tabIndex={0}
          aria-label="Pull a memory from the stack"
          style={{ zIndex: 10 }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} onKeyDown={onKey}
        >
          <span className="pull-mark" aria-hidden />
        </div>
      </div>
      <div ref={hintRef} className="pull-hint" aria-hidden>
        <svg viewBox="0 0 24 34" width="18" height="26" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 32V4M5 11l7-7 7 7" /></svg>
        <span>Pull a memory</span>
      </div>
    </section>
  );
}
