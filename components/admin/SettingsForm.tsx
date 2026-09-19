"use client";
import { useState } from "react";
import type { GroupPhoto, Settings } from "@/lib/types";
import { api } from "./api";
import { SaveBadge, useSave } from "./ui";

export function SettingsForm({ initial, group }: { initial: Settings; group: GroupPhoto[] }) {
  const [s, setS] = useState(initial);
  const [music, setMusic] = useState(initial.musicUrl ?? "");
  const { state, run } = useSave();
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));
  const setLine = (i: number, v: string) => setS((x) => { const c = [...x.closingLines] as [string, string, string]; c[i] = v; return { ...x, closingLines: c }; });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await run(() => api<Settings>("/api/settings", { method: "PUT", json: { title: s.title, tagline: s.tagline, familyName: s.familyName, closingLines: s.closingLines, musicUrl: music.trim() || null, heroPhotoId: s.heroPhotoId } }));
    if (r) setS(r);
  };

  return (
    <form className="stack" onSubmit={save}>
      <div className="page-head">
        <div><h1>Settings</h1><p className="muted">The words and choices that shape the opening and the ending.</p></div>
        <SaveBadge state={state} />
      </div>
      <section className="card stack-s">
        <h2>Opening</h2>
        <label className="field"><span>Title</span><input value={s.title} onChange={(e) => set("title", e.target.value)} maxLength={60} /></label>
        <label className="field"><span>Line under the title</span><input value={s.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} /></label>
        <label className="field"><span>Family name</span><input value={s.familyName} onChange={(e) => set("familyName", e.target.value)} maxLength={40} /><small className="muted">Shown as “Meet {s.familyName}’s Family”. Spelled exactly as you type it.</small></label>
      </section>
      <section className="card stack-s">
        <h2>Hero photograph</h2>
        <p className="muted">The photograph the opening flashes to before it pulls back into the whole collection.</p>
        {group.length === 0 ? <p className="empty">Add group photos first.</p> : (
          <div className="hero-picks" role="radiogroup" aria-label="Hero photograph">
            <button type="button" role="radio" aria-checked={s.heroPhotoId === null} className={`hero-pick auto ${s.heroPhotoId === null ? "on" : ""}`} onClick={() => set("heroPhotoId", null)}>Automatic<small>First starred photo</small></button>
            {group.map((g) => (
              <button type="button" role="radio" aria-checked={s.heroPhotoId === g.id} key={g.id} className={`hero-pick ${s.heroPhotoId === g.id ? "on" : ""}`} onClick={() => set("heroPhotoId", g.id)} aria-label="Use this photo as the hero">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.thumbUrl} alt="" style={{ objectPosition: `${g.focalX * 100}% ${g.focalY * 100}%` }} />
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="card stack-s">
        <h2>Closing message</h2>
        {[0, 1, 2].map((i) => <label className="field" key={i}><span>Line {i + 1}</span><input value={s.closingLines[i]} onChange={(e) => setLine(i, e.target.value)} maxLength={120} /></label>)}
      </section>
      <section className="card stack-s">
        <h2>Music (optional)</h2>
        <label className="field"><span>Track URL</span><input value={music} onChange={(e) => setMusic(e.target.value)} placeholder="https://…/track.mp3" inputMode="url" /><small className="muted">Only use a track you have the rights to. It starts only after a visitor taps, fades in quietly, and can be muted. Leave empty for no music.</small></label>
      </section>
      <div className="row end"><button className="btn primary" type="submit">Save settings</button></div>
    </form>
  );
}
