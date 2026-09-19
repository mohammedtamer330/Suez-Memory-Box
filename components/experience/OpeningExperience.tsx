"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useScrollLock } from "@/hooks/useScrollLock";
import { mulberry32, hashString } from "@/lib/rng";
import { Flag } from "./Flag";
import { MemoryBox, type BoxHandle } from "./MemoryBox";
import type { TableHandle } from "./GroupPhotoCollection";
import { useExperience } from "./context";

export const INTRO_KEY = "s26:intro";
const DEFAULT_TAG = "Different places. Same people. Unforgettable summer ♡";

/**
 * darkness → title → the box → (tap) it opens → the family's names → photographs land → camera flash →
 * the hero photograph → the camera pulls back into the whole collection.
 * Skippable at any moment; shown once per session; reduced-motion gets a quiet cross-fade version.
 */
export function OpeningExperience({ table, heroId, onDone }: { table: React.RefObject<TableHandle | null>; heroId: string | null; onDone: () => void }) {
  const { people, group, settings, sound, reduced, flash } = useExperience();
  const [gone, setGone] = useState(false);
  const [ready, setReady] = useState(false); // waiting for the tap
  const root = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const boxWrap = useRef<HTMLDivElement>(null);
  const box = useRef<BoxHandle>(null);
  const tapRef = useRef<HTMLButtonElement>(null);
  const namesRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const tagNote = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const tapResolve = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const tls = useRef<gsap.core.Timeline[]>([]);
  const started = useRef(false);
  const [scale, setScale] = useState(1);
  useScrollLock(!gone);

  const pileIds = useMemo(() => {
    const rnd = mulberry32(hashString("pile:" + group.length));
    const rest = group.filter((g) => g.id !== heroId);
    const pick: typeof group = [];
    const pool = [...rest];
    while (pick.length < 8 && pool.length) pick.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return pick;
  }, [group, heroId]);

  const finish = useCallback((instant: boolean) => {
    if (!alive.current) return;
    alive.current = false;
    tls.current.forEach((t) => t.kill());
    const t = table.current;
    if (t?.table) gsap.set(t.table, { clearProps: "transform,transformOrigin" });
    t?.firstSpreadPrints().forEach((el) => gsap.set(el, { clearProps: "opacity,transform" }));
    try { sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* private mode */ }
    setGone(true);
    onDone();
    if (instant) window.scrollTo(0, 0);
  }, [onDone, table]);

  useLayoutEffect(() => {
    const fit = () => setScale(Math.max(0.55, Math.min((window.innerWidth - 24) / 430, (window.innerHeight * 0.5) / 300, 1.25)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    try { history.scrollRestoration = "manual"; } catch { /* ignore */ }
    window.scrollTo(0, 0);
    let seen = false;
    try { seen = sessionStorage.getItem(INTRO_KEY) === "1" && !new URLSearchParams(window.location.search).has("intro"); } catch { /* ignore */ }
    if (seen) { finish(true); return; }

    const track = (tl: gsap.core.Timeline) => { tls.current.push(tl); return tl; };
    const run = (tl: gsap.core.Timeline) => new Promise<void>((res) => { track(tl); if (tl.duration() === 0) return res(); tl.eventCallback("onComplete", () => res()); });
    const wait = (s: number) => new Promise<void>((res) => { const t = gsap.delayedCall(s, res); void t; });
    const ok = () => alive.current;

    const sequence = async () => {
      const R = root.current; if (!R) return;
      const q = <T extends Element>(s: string) => R.querySelector<T>(s);
      const title = q(".open-title h1"), tag = q(".open-title p");

      /* 1 — darkness, then the title finds its exposure */
      await run(gsap.timeline()
        .fromTo(title, { opacity: 0, filter: "blur(10px)", letterSpacing: "0.34em" }, { opacity: 1, filter: "blur(0px)", letterSpacing: "0.2em", duration: reduced ? 0.8 : 2.4, ease: "power2.out" }, reduced ? 0 : 0.9)
        .fromTo(tag, { opacity: 0, y: 6 }, { opacity: 0.72, y: 0, duration: reduced ? 0.6 : 1.5, ease: "power1.out" }, reduced ? 0.2 : 2.1)
        .fromTo(boxWrap.current, { opacity: 0, y: 46 }, { opacity: 1, y: 0, duration: reduced ? 0.6 : 2.1, ease: "power2.out" }, reduced ? 0.3 : 3.0)
        .fromTo(skipRef.current, { opacity: 0 }, { opacity: 0.7, duration: 1 }, reduced ? 0.4 : 2.4));
      if (!ok()) return;

      /* 2 — the box waits for a hand */
      gsap.fromTo(tapRef.current, { opacity: 0 }, { opacity: 1, duration: 1.2 });
      gsap.to(tapRef.current, { opacity: 0.45, duration: 1.4, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 1.3 });
      setReady(true);
      await new Promise<void>((res) => { tapResolve.current = res; });
      if (!ok()) return;
      sound.unlock();
      setReady(false);
      gsap.killTweensOf(tapRef.current);
      gsap.to(tapRef.current, { opacity: 0, duration: 0.3 });

      /* 3 — it opens */
      const b = box.current!;
      if (reduced) {
        b.setState("open");
        await wait(0.6);
      } else {
        sound.play("creak");
        const tl = b.openTl();
        tl.call(() => sound.play("thump"), undefined, 1.72)
          .call(() => b.puffDust(), undefined, 1.74)
          .to(title, { opacity: 0, y: -14, duration: 1.4, ease: "power2.in" }, 0.2)
          .to(tag, { opacity: 0, duration: 1 }, 0.2);
        // the note lifts out of the box, turning to face us
        if (b.note) tl.to(b.note, { y: "-=74", z: "+=90", rotationZ: 0, rotationX: -14, scale: 1.18, duration: 1.4, ease: "power3.out" }, 2.6);
        await run(track(tl));
        if (!ok()) return;
        await wait(0.5);
      }

      /* 4 — the family's names */
      const N = namesRef.current!, list = listRef.current!, clip = clipRef.current!;
      const lis = Array.from(list.children) as HTMLElement[];
      gsap.set(N, { display: "flex" });
      const nt = track(gsap.timeline());
      nt.to(boxWrap.current, { y: () => window.innerHeight * 0.62, scale: 0.92, opacity: 0, duration: reduced ? 0.6 : 1.5, ease: "power2.inOut" }, 0)
        .fromTo(noteRef.current, { opacity: 0, y: -22, rotation: -5 }, { opacity: 1, y: 0, rotation: -2, duration: reduced ? 0.5 : 1.1, ease: "power3.out" }, reduced ? 0 : 0.5);
      sound.play("paper");
      if (reduced) {
        gsap.set(lis, { opacity: 1, x: 0 });
        nt.to(clip, { opacity: 1, duration: 0.5 }, 0.2);
      } else {
        gsap.set(lis, { opacity: 0, x: 14 });
        gsap.set(clip, { opacity: 1 });
        let at = 1.5, dt = 0.4;
        const ch = clip.clientHeight;
        lis.forEach((li, i) => {
          nt.to(li, { opacity: 1, x: 0, duration: 0.55, ease: "power2.out" }, at);
          const need = li.offsetTop + li.offsetHeight - ch;
          if (need > 0) nt.to(list, { y: -need, duration: 0.5, ease: "power2.out" }, at);
          if (i % 4 === 0) nt.call(() => sound.play("paper"), undefined, at);
          at += dt; dt = Math.max(0.11, dt * 0.92);
        });
      }
      await run(nt);
      if (!ok()) return;
      await wait(reduced ? 2.2 : 1.1);
      if (!ok()) return;

      const t = table.current;
      const heroEl = t?.hero;
      if (reduced || !heroEl || !t?.table) {
        // quiet ending: everything dissolves into the table
        await run(gsap.timeline().to(R, { opacity: 0, duration: 1.1, ease: "power1.inOut" }));
        finish(false);
        return;
      }

      /* 5 — photographs land, faster and faster */
      const pile = pileRef.current!;
      const imgs = Array.from(pile.children) as HTMLElement[];
      const vw = window.innerWidth, vh = window.innerHeight;
      const rnd = mulberry32(hashString("land"));
      const pt = track(gsap.timeline());
      pt.to(N, { opacity: 0.16, duration: 1.2, ease: "power1.out" }, 0)
        .to(tagNote.current, { opacity: 1, rotation: 3, duration: 0.9, ease: "power2.out" }, 1.0);
      let pat = 0.5, pdt = 0.5;
      imgs.forEach((el, i) => {
        const side = rnd() < 0.5 ? -1 : 1;
        const fx = side * (vw * (0.7 + rnd() * 0.3)), fy = (rnd() - 0.5) * vh * 0.9;
        const tx = (rnd() - 0.5) * vw * 0.34, ty = (rnd() - 0.5) * vh * 0.26;
        pt.fromTo(el, { x: fx, y: fy, rotation: side * (25 + rnd() * 30), scale: 1.25, opacity: 0 }, { x: tx, y: ty, rotation: (rnd() - 0.5) * 22, scale: 1, opacity: 1, duration: 0.6, ease: "power3.out" }, pat);
        pt.call(() => sound.play("photo"), undefined, pat + 0.32);
        pat += pdt; pdt = Math.max(0.16, pdt * 0.82);
        void i;
      });
      await run(pt);
      if (!ok()) return;
      await wait(0.25);

      /* 6 — flash. At its brightest we swap the whole scene for the hero photograph on the table. */
      await flash();
      if (!ok()) return;
      const tb = t.table;
      const others = t.firstSpreadPrints().filter((e) => e !== heroEl);
      gsap.set(others, { opacity: 0 });
      const heroRect = heroEl.getBoundingClientRect();
      const tRect = tb.getBoundingClientRect();
      const cx = heroRect.left + heroRect.width / 2, cy = heroRect.top + heroRect.height / 2;
      const w = heroEl.offsetWidth, h = heroEl.offsetHeight;
      const S = Math.max(1, Math.min((window.innerWidth * 0.9) / w, (window.innerHeight * 0.74) / h));
      gsap.set(tb, { transformOrigin: `${cx - tRect.left}px ${cy - tRect.top}px`, x: window.innerWidth / 2 - cx, y: window.innerHeight / 2 - cy, scale: S });
      gsap.set(R, { backgroundColor: "rgba(5,7,10,0)" });
      gsap.set([N, pile, boxWrap.current, tagNote.current, R.querySelector(".open-title"), skipRef.current], { display: "none" });
      window.scrollTo(0, 0);

      /* 7 — hold on the hero, then the camera pulls back */
      const hold = track(gsap.timeline());
      hold.to(tb, { scale: S * 1.035, duration: 2.6, ease: "none" });
      await run(hold);
      if (!ok()) return;
      const pb = track(gsap.timeline());
      pb.to(tb, { scale: 1, x: 0, y: 0, duration: 3.3, ease: "power3.inOut" }, 0)
        .fromTo(others, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 1.3, ease: "power2.out", stagger: 0.1 }, 0.9)
        .call(() => sound.play("paper"), undefined, 1.0);
      await run(pb);
      if (!ok()) return;
      finish(false);
    };
    void sequence();
    return () => { /* the sequence owns its own lifetime (StrictMode double-invoke is guarded by `started`) */ };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gone) return null;
  const names = people;
  return (
    <div ref={root} className="open" data-scene="opening">
      <div className="open-beam" aria-hidden />
      <div className="open-grain" aria-hidden />
      <div ref={titleRef} className="open-title">
        <h1>{settings.title}</h1>
        <p>{settings.tagline}</p>
      </div>

      <div ref={boxWrap} className="open-box" style={{ opacity: 0 }}>
        <div className="open-box-fit" style={{ transform: `scale(${scale})` }}>
          <MemoryBox ref={box} photos={group.slice(0, 4)} noteLines={[`${settings.familyName}’s`, "Family ♡"]} />
        </div>
        {ready && <button type="button" className="open-box-hit" aria-label="Open the box" onClick={() => tapResolve.current?.()} />}
      </div>

      <button ref={tapRef} type="button" className="open-tap" style={{ opacity: 0 }} tabIndex={ready ? 0 : -1} onClick={() => tapResolve.current?.()} disabled={!ready}>
        <span className="open-tap-ring" aria-hidden />
        <span>Tap to open</span>
      </button>

      <div ref={namesRef} className="open-names" style={{ display: "none" }}>
        <div ref={noteRef} className="open-note" style={{ opacity: 0 }}>
          <i className="open-note-tape" aria-hidden />
          <span className="open-note-a">Meet</span>
          <span className="open-note-b">{settings.familyName}’s Family ♡</span>
        </div>
        <div ref={clipRef} className="open-names-clip" style={{ opacity: 0 }}>
          <ul ref={listRef} className="open-list">
            {names.map((p) => (
              <li key={p.id}><span className="open-list-name">{p.name}</span><i className="open-list-dots" aria-hidden /><Flag code={p.countryCode} height={15} /></li>
            ))}
          </ul>
        </div>
      </div>

      <div ref={pileRef} className="open-pile" aria-hidden>
        {pileIds.map((g) => (
          <span key={g.id} className="open-pile-print">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={g.thumbUrl} alt="" style={{ aspectRatio: g.width && g.height ? `${g.width} / ${g.height}` : "4 / 3" }} draggable={false} /></span>
        ))}
      </div>
      <div ref={tagNote} className="open-tagnote" style={{ opacity: 0 }} aria-hidden>{DEFAULT_TAG}</div>

      <button ref={skipRef} type="button" className="open-skip" style={{ opacity: 0 }} onClick={() => finish(true)}>Skip</button>
    </div>
  );
}
