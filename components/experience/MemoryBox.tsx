"use client";
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import type { ImageAsset } from "@/lib/types";
import { CitySticker } from "./CitySticker";

/**
 * A worn cardboard travel box built from CSS-3D planes (real perspective, real hinge) — no video, no
 * WebGL. The lid rotates on its back edge; contents are standing prints, a folded note and a camera.
 */
export const BOX = { W: 330, D: 190, H: 112, FLOOR: 106 / 2 }; // FLOOR = y of the inside floor (from centre)
const { W, D, H } = BOX;
const FLOOR_Y = H / 2 - 6;
const LID_LIP = 26;
/** while the lid is shut everything sits this far down inside the box; it rises as the lid lifts */
const SINK = 34;

export interface BoxHandle {
  root: HTMLDivElement | null;
  tilt: HTMLDivElement | null;
  note: HTMLElement | null;
  camera: HTMLElement | null;
  prints: HTMLElement[];
  glow: HTMLElement | null;
  /** lid opens with resistance → swing → settle. Returns the timeline (caller may add to it). */
  openTl: () => gsap.core.Timeline;
  closeTl: () => gsap.core.Timeline;
  puffDust: () => void;
  setState: (s: "closed" | "open") => void;
}

interface Item { kind: "print" | "note" | "camera"; x: number; z: number; rz: number; rx: number; lift?: number; w: number; h: number; photo?: number }
const ITEMS: Item[] = [
  { kind: "print", x: -102, z: -66, rz: -10, rx: -7, w: 104, h: 138, photo: 0 },
  { kind: "print", x: 4, z: -60, rz: 3, rx: -5, w: 112, h: 146, photo: 1 },
  { kind: "print", x: 104, z: -62, rz: 11, rx: -8, w: 100, h: 132, photo: 2 },
  { kind: "note", x: -30, z: -12, rz: -4, rx: -4, w: 104, h: 138 },
  { kind: "print", x: 58, z: 10, rz: -5, rx: -3, w: 92, h: 122, photo: 3 },
  { kind: "camera", x: 92, z: 40, rz: 5, rx: -2, lift: 58, w: 124, h: 92 },
];

function Camera() {
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" aria-hidden>
      <defs>
        <linearGradient id="cam-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b2a29" /><stop offset="1" stopColor="#151413" /></linearGradient>
        <linearGradient id="cam-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e9e5dc" /><stop offset=".55" stopColor="#b9b4a8" /><stop offset="1" stopColor="#8d887c" /></linearGradient>
        <radialGradient id="cam-lens" cx=".42" cy=".38" r=".7"><stop offset="0" stopColor="#5e7c90" /><stop offset=".35" stopColor="#1e2a33" /><stop offset="1" stopColor="#07090b" /></radialGradient>
        <linearGradient id="cam-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d8d4ca" /><stop offset=".5" stopColor="#6d695f" /><stop offset="1" stopColor="#c6c1b5" /></linearGradient>
      </defs>
      <rect x="6" y="34" width="188" height="104" rx="11" fill="url(#cam-body)" />
      <rect x="6" y="34" width="188" height="14" rx="6" fill="#0e0d0c" opacity=".55" />
      <path d="M6 44 Q6 20 30 20 H170 Q194 20 194 44 V52 H6Z" fill="url(#cam-top)" />
      <rect x="36" y="9" width="40" height="15" rx="3" fill="#a9a498" /><rect x="40" y="12" width="32" height="9" rx="2" fill="#2a3a44" />
      <rect x="132" y="8" width="26" height="14" rx="3" fill="url(#cam-ring)" />
      <circle cx="171" cy="17" r="7" fill="#b9382a" /><circle cx="171" cy="15.5" r="4" fill="#d5574a" opacity=".6" />
      <circle cx="146" cy="88" r="0" />
      <circle cx="100" cy="90" r="44" fill="url(#cam-ring)" />
      <circle cx="100" cy="90" r="38" fill="#0c0d0e" /><circle cx="100" cy="90" r="31" fill="url(#cam-lens)" />
      <circle cx="100" cy="90" r="19" fill="#0a0e12" stroke="#31404a" strokeWidth="1.5" /><ellipse cx="90" cy="80" rx="8" ry="5" fill="#fff" opacity=".22" transform="rotate(-32 90 80)" />
      <rect x="150" y="60" width="30" height="18" rx="3" fill="#0b0b0a" /><rect x="153" y="63" width="24" height="12" rx="2" fill="#1e2a31" />
      <g stroke="#3d3a36" strokeWidth="1"><path d="M14 60 V128M20 60 V128M180 96 V128M186 96 V128" opacity=".6" /></g>
    </svg>
  );
}

export const MemoryBox = forwardRef<BoxHandle, { photos: ImageAsset[]; noteTitle?: string; noteLines?: string[] }>(function MemoryBox({ photos, noteTitle = "Meet", noteLines = ["Askiimmm’s", "Family ♡"] }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const hinge = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const dust = useRef<HTMLDivElement>(null);
  const noteEl = useRef<HTMLDivElement | null>(null);
  const camEl = useRef<HTMLDivElement | null>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    // static placement of everything that stands inside the box (bottom-centre anchored)
    ITEMS.forEach((it, i) => {
      const el = items.current[i]; if (!el) return;
      gsap.set(el, { opacity: 0, xPercent: -50, yPercent: -100, x: it.x, y: FLOOR_Y - (it.lift ?? 0) + SINK, z: it.z, rotationZ: it.rz, rotationX: it.rx, transformOrigin: "50% 100%" });
    });
    gsap.set(hinge.current, { x: 0, y: -H / 2 - 4, z: -D / 2, rotationX: 0, transformOrigin: "50% 0%" });
    gsap.set(tilt.current, { rotationX: -20, y: 0, scale: 1 });
    gsap.set(glow.current, { opacity: 0 });
  }, []);

  const api: BoxHandle = {
    get root() { return root.current; },
    get tilt() { return tilt.current; },
    get note() { return noteEl.current; },
    get camera() { return camEl.current; },
    get prints() { return items.current.filter((_, i) => ITEMS[i].kind === "print") as HTMLElement[]; },
    get glow() { return glow.current; },
    openTl() {
      const tl = gsap.timeline();
      tl.to(hinge.current, { rotationX: 5, duration: 0.55, ease: "power2.in" })                    // resistance: it's stuck a little
        .to(hinge.current, { rotationX: 5, duration: 0.14 })
        .to(hinge.current, { rotationX: 112, duration: 1.05, ease: "power3.in" })                  // gathers speed
        .to(hinge.current, { rotationX: 106, duration: 0.85, ease: "elastic.out(1, 0.42)" })       // settles on its hinge
        .to(tilt.current, { rotationX: -36, y: 26, duration: 1.7, ease: "power2.inOut" }, 0.5)      // we lean in to look
        .to(glow.current, { opacity: 1, duration: 1.6, ease: "power1.out" }, 1.0)
        .to(items.current.filter(Boolean), { y: (i: number, el: Element) => Number(el.getAttribute("data-y")), opacity: 1, duration: 0.95, ease: "back.out(1.5)", stagger: { each: 0.07, from: "random" } }, 1.0);
      return tl;
    },
    closeTl() {
      const tl = gsap.timeline();
      tl.to(items.current.filter(Boolean), { y: (i: number, el: Element) => Number(el.getAttribute("data-y")) + SINK, opacity: 0, duration: 0.6, ease: "power2.in", stagger: 0.04 }, 0)
        .to(glow.current, { opacity: 0, duration: 1.2 }, 0)
        .to(tilt.current, { rotationX: -20, y: 0, duration: 1.3, ease: "power2.inOut" }, 0)
        .to(hinge.current, { rotationX: 30, duration: 0.7, ease: "power2.inOut" }, 0.45)
        .to(hinge.current, { rotationX: 0, duration: 0.42, ease: "power3.in" })
        .to(hinge.current, { rotationX: 3.2, duration: 0.09, ease: "power1.out" })                 // the thump: it rebounds slightly
        .to(hinge.current, { rotationX: 0, duration: 0.16, ease: "power2.in" })
        .to(tilt.current, { y: 5, duration: 0.07, ease: "power1.out" }, "<-0.12")
        .to(tilt.current, { y: 0, duration: 0.3, ease: "power2.out" });
      return tl;
    },
    puffDust() {
      const host = dust.current; if (!host) return;
      host.querySelectorAll<HTMLElement>("i").forEach((d, k) => {
        gsap.fromTo(d, { opacity: 0, x: (Math.random() - 0.5) * 220, y: 20, scale: 0.6 + Math.random() }, { opacity: 0.55 - Math.random() * 0.25, y: -80 - Math.random() * 150, x: `+=${(Math.random() - 0.5) * 70}`, duration: 2.6 + Math.random() * 2, ease: "power1.out", delay: k * 0.05, onComplete: () => { gsap.to(d, { opacity: 0, duration: 1.2 }); } });
      });
    },
    setState(s) {
      gsap.set(hinge.current, { rotationX: s === "open" ? 106 : 0 });
      gsap.set(tilt.current, { rotationX: s === "open" ? -36 : -20, y: s === "open" ? 26 : 0 });
      gsap.set(glow.current, { opacity: s === "open" ? 1 : 0 });
      items.current.forEach((el) => { if (el) gsap.set(el, { y: Number(el.getAttribute("data-y")) + (s === "open" ? 0 : SINK), opacity: s === "open" ? 1 : 0 }); });
    },
  };
  useImperativeHandle(ref, () => api); // eslint-disable-line react-hooks/exhaustive-deps

  const ph = (i: number) => photos[i % Math.max(1, photos.length)];
  const face = (w: number, h: number, t: string, cls: string, extra?: React.CSSProperties) => ({ className: `mf ${cls}`, style: { width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, transform: t, ...extra } });

  return (
    <div ref={root} className="mbox" aria-hidden>
      <div ref={glow} className="mbox-glow" />
      <div className="mbox-scene">
        <div ref={tilt} className="mbox-tilt">
          {/* ---- shell ---- */}
          <div {...face(W, H, `translateZ(${-D / 2}px)`, "mf-back")} />
          <div {...face(D, H, `rotateY(-90deg) translateZ(${W / 2}px)`, "mf-side")} />
          <div {...face(D, H, `rotateY(90deg) translateZ(${W / 2}px)`, "mf-side")} />
          <div {...face(W, D, `rotateX(-90deg) translateZ(${H / 2}px)`, "mf-bottom")} />
          <div {...face(W - 14, D - 14, `rotateX(-90deg) translateZ(${H / 2 - 6}px)`, "mf-floor")} />

          {/* ---- contents ---- */}
          {ITEMS.map((it, i) => (
            <div
              key={i}
              ref={(el) => { items.current[i] = el; if (it.kind === "note") noteEl.current = el; if (it.kind === "camera") camEl.current = el; }}
              className={`mitem mitem--${it.kind}`}
              data-y={FLOOR_Y - (it.lift ?? 0)}
              style={{ width: it.w, height: it.h }}
            >
              {it.kind === "print" && ph(it.photo ?? 0) && (
                <span className="mprint">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={ph(it.photo ?? 0).thumbUrl} alt="" draggable={false} style={{ objectPosition: `${ph(it.photo ?? 0).focalX * 100}% ${ph(it.photo ?? 0).focalY * 100}%` }} /></span>
              )}
              {it.kind === "print" && !ph(it.photo ?? 0) && <span className="mprint mprint--blank" />}
              {it.kind === "note" && (
                <span className="mnote"><i className="mnote-tape" /><span className="mnote-t">{noteTitle}</span>{noteLines.map((l, k) => <span key={k} className="mnote-l">{l}</span>)}</span>
              )}
              {it.kind === "camera" && <Camera />}
            </div>
          ))}

          {/* ---- front wall (over the contents) ---- */}
          <div {...face(W, H, `translateZ(${D / 2}px)`, "mf-front")}>
            <i className="mstrap" />
            <i className="mclasp" />
            <span className="mst mst-a"><CitySticker id="suez" /></span>
            <span className="mst mst-b"><CitySticker id="dahab" /></span>
            <span className="mst mst-c"><CitySticker id="cairo" /></span>
          </div>
          {/* rims: the cardboard's thickness at the top edges */}
          <div {...face(W, 7, `translateY(${-H / 2}px) translateZ(${D / 2 - 3.5}px) rotateX(90deg)`, "mf-rim")} />
          <div {...face(W, 7, `translateY(${-H / 2}px) translateZ(${-D / 2 + 3.5}px) rotateX(90deg)`, "mf-rim")} />
          <div {...face(7, D, `translateY(${-H / 2}px) translateX(${-W / 2 + 3.5}px) rotateX(90deg)`, "mf-rim")} />
          <div {...face(7, D, `translateY(${-H / 2}px) translateX(${W / 2 - 3.5}px) rotateX(90deg)`, "mf-rim")} />

          {/* ---- lid (hinged at the back top edge) ---- */}
          <div ref={hinge} className="mhinge">
            <div className="mlid" style={{ width: W + 8, height: D + 6, marginLeft: -(W + 8) / 2 }}>
              <div className="mlid-top mf">
                <i className="mtape mtape-1" /><i className="mtape mtape-2" />
                <i className="mstrap mstrap--lid" />
                <span className="mst mst-d"><CitySticker id="alexandria" /></span>
                <span className="mst mst-e"><CitySticker id="sharm" /></span>
              </div>
              <div className="mlid-under" />
              <div className="mlid-lip mf" style={{ height: LID_LIP }}><i className="mstrap mstrap--lip" /><i className="mclasp mclasp--lid" /></div>
              <div className="mlid-lipside mlid-lipside--l mf" style={{ width: D + 6, height: LID_LIP }} />
              <div className="mlid-lipside mlid-lipside--r mf" style={{ width: D + 6, height: LID_LIP }} />
            </div>
          </div>
        </div>
      </div>
      <div ref={dust} className="mbox-dust">{Array.from({ length: 16 }, (_, i) => <i key={i} />)}</div>
    </div>
  );
});
