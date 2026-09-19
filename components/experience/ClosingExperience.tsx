"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useScrollLock } from "@/hooks/useScrollLock";
import { resolveCoverClient } from "@/lib/cover";
import { BookCover } from "./BookCover";
import { MemoryBox, type BoxHandle } from "./MemoryBox";
import { useExperience } from "./context";

/**
 * The end, played once when it scrolls into view: everything goes back into the box, the camera
 * pulls away, one last photograph drops in, the lid closes — darkness — and only then the message.
 */
export function ClosingExperience({ heroId }: { heroId: string | null }) {
  const { people, group, settings, sound, reduced } = useExperience();
  const host = useRef<HTMLElement>(null);
  const boxRef = useRef<BoxHandle>(null);
  const boxOuter = useRef<HTMLDivElement>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [scale, setScale] = useState(1);
  const played = useRef(false);
  useScrollLock(playing);

  useEffect(() => {
    const fit = () => setScale(Math.max(0.55, Math.min((window.innerWidth - 24) / 430, (window.innerHeight * 0.5) / 300, 1.25)));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const books = useMemo(() => people.slice(0, 5), [people]);
  const shots = useMemo(() => group.filter((g) => g.id !== heroId).slice(0, 6), [group, heroId]);
  const hero = group.find((g) => g.id === heroId) ?? group[0] ?? null;

  useEffect(() => {
    const el = host.current; if (!el) return;
    const lines = linesRef.current!;
    const show = () => gsap.set([lines, ...Array.from(lines.children)], { opacity: 1, y: 0 });
    if (reduced) {
      const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { gsap.to(lines, { opacity: 1, duration: 1.2 }); gsap.set(Array.from(lines.children), { opacity: 1 }); io.disconnect(); } }, { threshold: 0.5 });
      io.observe(el);
      return () => io.disconnect();
    }
    const play = async () => {
      if (played.current) return; played.current = true;
      const b = boxRef.current!, outer = boxOuter.current!, fly = flyRef.current!;
      el.scrollIntoView({ block: "start" });
      setPlaying(true);
      const failsafe = setTimeout(() => { setPlaying(false); show(); }, 45000);
      try {
        b.setState("open");
        const r = outer.getBoundingClientRect();
        const tx = r.left + r.width / 2, ty = r.top + r.height * 0.5;
        const vw = window.innerWidth, vh = window.innerHeight;
        const items = Array.from(fly.children) as HTMLElement[];
        gsap.set(items, { opacity: 0 });
        gsap.set(beamRef.current, { opacity: 1 });
        await new Promise((res) => setTimeout(res, 700));
        const tl = gsap.timeline();
        // 1 — the books come home, then the photographs
        items.forEach((it, i) => {
          const side = i % 2 ? 1 : -1;
          const isBook = it.dataset.kind === "book";
          const w = it.offsetWidth, h = it.offsetHeight;
          const at = 0.2 + i * 0.36;
          tl.fromTo(it,
            { x: tx + side * vw * 0.75 - w / 2, y: ty + (Math.random() - 0.3) * vh * 0.5 - h / 2, rotation: side * 24, scale: 1.15, opacity: 0 },
            { x: tx - w / 2 + (Math.random() - 0.5) * 60, y: ty - h / 2 - 54, rotation: (Math.random() - 0.5) * 16, scale: isBook ? 0.5 : 0.46, opacity: 1, duration: 0.85, ease: "power2.in" }, at)
            .to(it, { opacity: 0, y: `+=34`, scale: 0.3, duration: 0.28, ease: "power1.in" }, at + 0.85)
            .call(() => sound.play(isBook ? "paper" : "photo"), undefined, at + 0.85);
        });
        const filled = 0.2 + items.length * 0.36 + 1.1;
        tl.call(() => b.puffDust(), undefined, filled - 0.3);
        tl.to(b.prints, { y: "-=8", duration: 0.16, yoyo: true, repeat: 1, ease: "power1.out", stagger: 0.04 }, filled - 0.2);
        // 2 — the camera pulls away
        tl.to(outer, { scale: 0.8, y: -18, duration: 1.5, ease: "power2.inOut" }, filled + 0.2);
        await new Promise<void>((res) => tl.eventCallback("onComplete", () => res()));
        // 3 — one last photograph, then the lid
        if (hero) {
          const last = fly.querySelector<HTMLElement>('[data-kind="last"]');
          if (last) {
            const r2 = outer.getBoundingClientRect();
            const cx = r2.left + r2.width / 2, cy = r2.top + r2.height * 0.42;
            await new Promise<void>((res) => {
              gsap.timeline({ onComplete: res })
                .fromTo(last, { x: cx - last.offsetWidth / 2, y: -last.offsetHeight - 30, rotation: -10, scale: 1.3, opacity: 1 }, { y: cy - last.offsetHeight / 2 - 40, rotation: 3, scale: 0.55, duration: 1.1, ease: "power3.in" })
                .to(last, { y: `+=38`, opacity: 0, scale: 0.4, duration: 0.35, ease: "power1.in" })
                .call(() => sound.play("photo"));
            });
          }
        }
        sound.play("lidClose");
        await new Promise<void>((res) => { const t = b.closeTl(); t.eventCallback("onComplete", () => res()); });
        // 4 — darkness. Wait. Then the words.
        await new Promise<void>((res) => gsap.timeline({ onComplete: res }).to([outer, beamRef.current], { opacity: 0, duration: 2.4, ease: "power2.inOut" }));
        await new Promise((res) => setTimeout(res, 1600));
        const kids = Array.from(lines.children) as HTMLElement[];
        await new Promise<void>((res) => {
          const t = gsap.timeline({ onComplete: res });
          gsap.set(lines, { opacity: 1 });
          kids.forEach((k, i) => t.fromTo(k, { opacity: 0, y: 10, filter: "blur(4px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 2, ease: "power2.out" }, i === 2 ? 4.6 : i * 2.1));
        });
      } finally {
        clearTimeout(failsafe);
        setPlaying(false);
        show();
      }
    };
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting && es[0].intersectionRatio > 0.55) { io.disconnect(); void play(); } }, { threshold: [0.55, 0.8] });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, hero, sound]);

  const [l1, l2, l3] = settings.closingLines;
  return (
    <section ref={host} className="closing" aria-labelledby="closing-h" data-section="closing">
      <h2 id="closing-h" className="sr-only">Until we meet again</h2>
      <div ref={beamRef} className="closing-beam" aria-hidden />
      <div className="closing-grain" aria-hidden />
      {!reduced && (
        <div ref={boxOuter} className="closing-box" aria-hidden>
          <div className="open-box-fit" style={{ transform: `scale(${scale})` }}>
            <MemoryBox ref={boxRef} photos={group.slice(0, 4)} noteLines={[`${settings.familyName}’s`, "Family ♡"]} />
          </div>
        </div>
      )}
      <div ref={flyRef} className="closing-fly" aria-hidden>
        {books.map((p) => (
          <div key={p.id} data-kind="book" className="fly-book"><BookCover person={p} cover={resolveCoverClient(p)} sizes="120px" /></div>
        ))}
        {shots.map((g) => (
          <div key={g.id} data-kind="photo" className="fly-photo">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={g.thumbUrl} alt="" draggable={false} style={{ aspectRatio: g.width && g.height ? `${g.width} / ${g.height}` : "4 / 3" }} /></div>
        ))}
        {hero && <div data-kind="last" className="fly-photo fly-photo--last">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={hero.thumbUrl} alt="" draggable={false} style={{ aspectRatio: hero.width && hero.height ? `${hero.width} / ${hero.height}` : "4 / 3" }} /></div>}
      </div>
      <div ref={linesRef} className="closing-lines" style={{ opacity: reduced ? 0 : 0 }}>
        <p className="closing-l1">{l1}</p>
        <p className="closing-l2">{l2}</p>
        <p className="closing-l3">{l3}</p>
      </div>
    </section>
  );
}
