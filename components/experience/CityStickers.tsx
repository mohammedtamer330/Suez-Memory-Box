"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CITIES, type City } from "@/lib/types";
import { CitySticker } from "./CitySticker";
import { useExperience } from "./context";

/** Where they went: six travel artifacts lying on the table, each a different kind of object. */
const SPEC: Record<City["id"], { w: string; rot: number; dx: number; depth: number }> = {
  cairo: { w: "min(56vw, 300px)", rot: -6, dx: -4, depth: 0.5 },
  giza: { w: "min(38vw, 190px)", rot: 7, dx: 6, depth: 1 },
  dahab: { w: "min(38vw, 190px)", rot: -4, dx: -2, depth: 0.8 },
  alexandria: { w: "min(50vw, 260px)", rot: 5, dx: 4, depth: 0.6 },
  suez: { w: "min(38vw, 190px)", rot: -8, dx: 3, depth: 0.9 },
  sharm: { w: "min(38vw, 190px)", rot: 4, dx: -3, depth: 0.7 },
};

export function CityStickers() {
  const { reduced, sound } = useExperience();
  const host = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = host.current; if (!el || reduced) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>(".city"));
    const setters = items.map((it) => gsap.quickSetter(it.querySelector(".city-in"), "y", "px") as (v: number) => void);
    let raf = 0, live = false;
    const tick = () => {
      raf = 0;
      const vh = window.innerHeight;
      items.forEach((it, i) => {
        const r = it.getBoundingClientRect();
        const rel = (r.top + r.height / 2 - vh / 2) / vh;
        setters[i](rel * 34 * Number(it.dataset.depth || 1));
      });
    };
    const on = () => { if (live && !raf) raf = requestAnimationFrame(tick); };
    const io = new IntersectionObserver((es) => { live = es[0].isIntersecting; if (live) on(); }, { rootMargin: "20% 0px" });
    io.observe(el);
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    // land physically, once
    gsap.set(items, { opacity: 0 });
    const lio = new IntersectionObserver((es) => {
      const v = es.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
      v.forEach((t) => lio.unobserve(t));
      if (v.length) gsap.fromTo(v, { opacity: 0, scale: 1.18, y: -22 }, { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.11, onStart: () => sound.play("sticker") });
    }, { threshold: 0.25 });
    items.forEach((i) => lio.observe(i));
    const safety = setTimeout(() => gsap.to(items, { opacity: 1, duration: 0.3 }), 8000);
    return () => { io.disconnect(); lio.disconnect(); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); clearTimeout(safety); };
  }, [reduced, sound]);

  const wiggle = (e: React.MouseEvent<HTMLElement>) => {
    sound.unlock(); sound.play("sticker");
    if (!reduced) gsap.fromTo(e.currentTarget, { rotation: 0 }, { rotation: 4, duration: 0.09, yoyo: true, repeat: 3, ease: "sine.inOut", clearProps: "rotation" });
  };

  return (
    <section ref={host} className="cities" aria-labelledby="cities-h" data-section="cities">
      <h2 id="cities-h" className="sr-only">Where we went</h2>
      <div className="cities-grid">
        {CITIES.map((c) => {
          const s = SPEC[c.id];
          return (
            <div key={c.id} className={`city city--${c.id}`} data-depth={s.depth} style={{ width: s.w, marginLeft: `${s.dx}vw` }} onClick={wiggle}>
              <div className="city-in" style={{ transform: "translateY(0)" }}>
                <div style={{ transform: `rotate(${s.rot}deg)` }}><CitySticker id={c.id} /></div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
