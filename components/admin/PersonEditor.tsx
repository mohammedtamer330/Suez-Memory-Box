"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Crosshair, ImageIcon, RefreshCw, Shuffle, Star, Trash2 } from "lucide-react";
import { allCountries } from "@/lib/countries";
import type { Person, PersonPhoto } from "@/lib/types";
import { api } from "./api";
import { BookPreview } from "./BookPreview";
import { FocalPicker, ReplaceButton, SaveBadge, SortableGrid, UploadPanel, useSave } from "./ui";

const COUNTRIES = allCountries();

export function PersonEditor({ initial, initialPhotos }: { initial: Person; initialPhotos: PersonPhoto[] }) {
  const router = useRouter();
  const [person, setPerson] = useState(initial);
  const [photos, setPhotos] = useState(initialPhotos);
  const [name, setName] = useState(initial.name);
  const [code, setCode] = useState(initial.countryCode);
  const [focal, setFocal] = useState<PersonPhoto | null>(null);
  const [preview, setPreview] = useState(false);
  const { state, run } = useSave();
  const dirty = name.trim() !== person.name || code !== person.countryCode;
  const cover = photos.find((p) => p.id === person.coverPhotoId) ?? photos[0] ?? null;

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await run(() => api<Person>(`/api/people/${person.id}`, { method: "PATCH", json: { name, countryCode: code } }));
    if (r) setPerson(r);
  };
  const setCover = async (p: PersonPhoto) => {
    const r = await run(() => api<Person>(`/api/people/${person.id}`, { method: "PATCH", json: { coverPhotoId: p.id } }));
    if (r) setPerson(r);
  };
  const regenerate = async () => {
    const r = await run(() => api<Person>(`/api/people/${person.id}`, { method: "PATCH", json: { regenerate: true } }), "Regenerating layout…");
    if (r) setPerson(r);
  };
  const reorder = async (next: PersonPhoto[]) => {
    const prev = photos; setPhotos(next);
    const ok = await run(() => api(`/api/people/${person.id}/photos`, { method: "PUT", json: { order: next.map((p) => p.id) } }), "Saving order…");
    if (ok === undefined) setPhotos(prev);
  };
  const patchPhoto = async (p: PersonPhoto, body: Record<string, unknown>) => {
    const r = await run(() => api<PersonPhoto>(`/api/people/${person.id}/photos/${p.id}`, { method: "PATCH", json: body }));
    if (r) setPhotos((l) => l.map((x) => (x.id === p.id ? { ...x, ...r } : x)));
  };
  const removePhoto = async (p: PersonPhoto) => {
    if (!window.confirm("Delete this photo from the book? This can't be undone.")) return;
    const r = await run(() => api<{ coverPhotoId: string | null }>(`/api/people/${person.id}/photos/${p.id}`, { method: "DELETE" }), "Deleting…");
    if (r) { setPhotos((l) => l.filter((x) => x.id !== p.id)); setPerson((x) => ({ ...x, coverPhotoId: r.coverPhotoId ?? null })); }
  };
  const removePerson = async () => {
    if (!window.confirm(`Delete ${person.name} and every photo in their book? This can't be undone.`)) return;
    const r = await run(() => api(`/api/people/${person.id}`, { method: "DELETE" }), "Deleting…");
    if (r !== undefined) router.replace("/admin/people");
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>{person.name}</h1><p className="muted">Their memory book. The book is laid out automatically from these photos and never crops them.</p></div>
        <SaveBadge state={state} />
      </div>
      <form className="card form-inline" onSubmit={saveDetails}>
        <label className="field grow"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
        <label className="field grow"><span>Country</span>
          <select value={code} onChange={(e) => setCode(e.target.value)}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
        </label>
        <button type="submit" className="btn primary" disabled={!dirty || !name.trim()}>Save details</button>
      </form>
      <UploadPanel<PersonPhoto> scope="person" endpoint={`/api/people/${person.id}/photos`} label="Add photos to this book" onAdded={(added) => { setPhotos((l) => [...l, ...added]); setPerson((x) => (x.coverPhotoId ? x : { ...x, coverPhotoId: added[0]?.id ?? null })); }} />
      <div className="row between wrap gap">
        <span className="muted">{photos.length} photo{photos.length === 1 ? "" : "s"}</span>
        <div className="row gap wrap">
          <button type="button" className="btn ghost" onClick={regenerate} disabled={photos.length === 0}><Shuffle size={16} /> Regenerate layout</button>
          <button type="button" className="btn primary" onClick={() => setPreview(true)}><BookOpen size={16} /> Preview book</button>
        </div>
      </div>
      {photos.length === 0 ? <p className="empty"><ImageIcon size={18} /> No photos yet — visitors will see an empty book until you add some.</p> : (
        <SortableGrid items={photos} onReorder={reorder} renderItem={(p, handle) => (
          <figure className={`tile ${person.coverPhotoId === p.id || (!person.coverPhotoId && photos[0]?.id === p.id) ? "is-hero" : ""}`}>
            <div className="tile-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbUrl} alt="" style={{ objectPosition: `${p.focalX * 100}% ${p.focalY * 100}%` }} draggable={false} />
              <span className="tile-handle">{handle}</span>
              {cover?.id === p.id && <span className="tag tag--hero"><Star size={12} /> Cover</span>}
            </div>
            <figcaption className="tile-actions">
              <button type="button" className={`icon-btn ${cover?.id === p.id ? "on" : ""}`} title="Use as cover" aria-label="Use as cover" onClick={() => setCover(p)}><Star size={16} /></button>
              <button type="button" className="icon-btn" title="Set focus point" aria-label="Set focus point" onClick={() => setFocal(p)}><Crosshair size={16} /></button>
              <ReplaceButton scope="person" title="Replace photo" onAsset={async (a) => { await patchPhoto(p, { asset: a }); }}><RefreshCw size={16} /></ReplaceButton>
              <button type="button" className="icon-btn danger" title="Delete" aria-label="Delete photo" onClick={() => removePhoto(p)}><Trash2 size={16} /></button>
            </figcaption>
          </figure>
        )} />
      )}
      <div className="danger-zone"><button type="button" className="btn danger" onClick={removePerson}><Trash2 size={16} /> Delete this person</button></div>
      {focal && <FocalPicker url={focal.url} x={focal.focalX} y={focal.focalY} onCancel={() => setFocal(null)} onSave={async (x, y) => { const p = focal; setFocal(null); await patchPhoto(p, { focalX: x, focalY: y }); }} />}
      {preview && <BookPreview person={person} photos={photos} cover={cover} onClose={() => setPreview(false)} />}
    </div>
  );
}
