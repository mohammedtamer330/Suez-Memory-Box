"use client";
import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { mulberry32, hashString } from "@/lib/rng";
import { resolveCoverClient } from "@/lib/cover";
import { BookCover } from "./BookCover";
import { useExperience } from "./context";

/** "Everyone": every person's memory book standing on the table. */
export function MemoryBookCollection() {
  const { people, openBook, sound, reduced } = useExperience();
  const host = useRef<HTMLDivElement>(null);
  const tilts = useMemo(() => people.map((p) => { const r = mulberry32(hashString("tilt:" + p.id)); return { r: (r() - 0.5) * 3.2, y: Math.round(r() * 10) }; }), [people]);

  useEffect(() => {
    const el = host.current; if (!el || reduced || typeof IntersectionObserver === "undefined") return;
    const items = Array.from(el.querySelectorAll<HTMLElement>(".shelf-item"));
    gsap.set(items, { opacity: 0, y: 26 });
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
      vis.forEach((t) => io.unobserve(t));
      if (vis.length) gsap.to(vis, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.07 });
    }, { threshold: 0.12 });
    items.forEach((i) => io.observe(i));
    const safety = setTimeout(() => gsap.to(items, { opacity: 1, y: 0, duration: 0.4 }), 7000);
    return () => { io.disconnect(); clearTimeout(safety); };
  }, [people, reduced]);

  if (!people.length) return null;
  return (
    <section className="everyone" aria-labelledby="everyone-h" data-section="everyone">
      <h2 id="everyone-h" className="everyone-h">Everyone</h2>
      <div ref={host} className="shelf">
        {people.map((p, i) => {
          const cover = resolveCoverClient(p);
          return (
            <div key={p.id} className="shelf-item" style={{ marginTop: tilts[i].y }}>
              <button
                type="button"
                className="shelf-book"
                aria-label={`Open ${p.name}’s memory book`}
                style={{ transform: `rotate(${tilts[i].r}deg)` }}
                onClick={(e) => { sound.unlock(); sound.play("page"); openBook(p.id, e.currentTarget); }}
              >
                <BookCover person={p} cover={cover} sizes="(min-width: 900px) 22vw, 44vw" />
              </button>
              <i className="shelf-shadow" aria-hidden />
            </div>
          );
        })}
      </div>
    </section>
  );
}
