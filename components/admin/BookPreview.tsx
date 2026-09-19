"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { BookReader, type ReaderHandle } from "@/components/experience/BookReader";
import { getSound } from "@/lib/sound";
import type { Person, PersonPhoto } from "@/lib/types";

/** Exactly what visitors see: the same reader and the same layout engine. */
export function BookPreview({ person, photos, cover, onClose }: { person: Person; photos: PersonPhoto[]; cover: PersonPhoto | null; onClose: () => void }) {
  const [dims, setDims] = useState({ pw: 300, spread: false });
  const ref = useRef<ReaderHandle>(null);
  const sound = getSound();
  useEffect(() => {
    const calc = () => {
      const spread = window.innerWidth >= 900;
      const h = window.innerHeight - 170;
      setDims({ spread, pw: Math.max(150, Math.floor(spread ? Math.min((window.innerWidth - 80) / 2, h * 0.75, 460) : Math.min(window.innerWidth - 32, h * 0.75, 460))) });
    };
    calc(); window.addEventListener("resize", calc);
    const t = setTimeout(() => { void ref.current?.open(); }, 500);
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") ref.current?.next(); if (e.key === "ArrowLeft") ref.current?.prev(); };
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("resize", calc); window.removeEventListener("keydown", k); clearTimeout(t); };
  }, [onClose]);
  return (
    <div className="modal modal--book" role="dialog" aria-modal="true" aria-label="Book preview">
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close preview"><X size={20} /></button>
      <div className="book-stage">
        <BookReader ref={ref} person={person} photos={photos} cover={cover} spread={dims.spread} pw={dims.pw} sound={sound} reduced={false} />
      </div>
      <div className="row center gap"><button className="btn ghost" onClick={() => ref.current?.prev()}>Previous</button><button className="btn ghost" onClick={() => ref.current?.next()}>Next</button></div>
    </div>
  );
}
