"use client";
import { useState } from "react";
import { Crown, Crosshair, RefreshCw, Shuffle, Star, Trash2 } from "lucide-react";
import type { GroupPhoto } from "@/lib/types";
import { api } from "./api";
import { FocalPicker, ReplaceButton, SaveBadge, SortableGrid, UploadPanel, useSave } from "./ui";

export function GroupManager({ initial, heroId: initialHero }: { initial: GroupPhoto[]; heroId: string | null }) {
  const [items, setItems] = useState(initial);
  const [hero, setHero] = useState(initialHero);
  const [focal, setFocal] = useState<GroupPhoto | null>(null);
  const { state, run } = useSave();

  const reorder = async (next: GroupPhoto[]) => {
    const prev = items; setItems(next);
    const ok = await run(() => api("/api/group", { method: "PUT", json: { order: next.map((p) => p.id) } }), "Saving order…");
    if (ok === undefined) setItems(prev);
  };
  const patch = async (p: GroupPhoto, body: Record<string, unknown>) => {
    const r = await run(() => api<GroupPhoto>(`/api/group/${p.id}`, { method: "PATCH", json: body }));
    if (r) setItems((l) => l.map((x) => (x.id === p.id ? { ...x, ...r } : x)));
    return r;
  };
  const setHeroPhoto = async (p: GroupPhoto) => {
    const on = hero !== p.id;
    const r = await patch(p, { hero: on });
    if (r) setHero(on ? p.id : null);
  };
  const remove = async (p: GroupPhoto) => {
    if (!window.confirm("Delete this photo from the collection? This can't be undone.")) return;
    const ok = await run(() => api(`/api/group/${p.id}`, { method: "DELETE" }), "Deleting…");
    if (ok !== undefined) { setItems((l) => l.filter((x) => x.id !== p.id)); if (hero === p.id) setHero(null); }
  };
  const regenerate = () => run(() => api("/api/settings", { method: "PUT", json: { regenerateGroup: true } }), "Regenerating layout…");

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Group photos</h1><p className="muted">These make the “Together” table and the “Pull a memory” stack. Drag to reorder. Starred photos are placed first.</p></div>
        <SaveBadge state={state} />
      </div>
      <UploadPanel<GroupPhoto> scope="group" endpoint="/api/group" label="Add group photos" onAdded={(added) => setItems((l) => [...l, ...added])} />
      <div className="row between wrap">
        <span className="muted">{items.length} photo{items.length === 1 ? "" : "s"}</span>
        <button type="button" className="btn ghost" onClick={regenerate}><Shuffle size={16} /> Regenerate table layout</button>
      </div>
      {items.length === 0 ? <p className="empty">No group photos yet. Add some above.</p> : (
        <SortableGrid items={items} onReorder={reorder} renderItem={(p, handle) => (
          <figure className={`tile ${hero === p.id ? "is-hero" : ""}`}>
            <div className="tile-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbUrl} alt="" style={{ objectPosition: `${p.focalX * 100}% ${p.focalY * 100}%` }} draggable={false} />
              <span className="tile-handle">{handle}</span>
              {hero === p.id && <span className="tag tag--hero"><Crown size={12} /> Hero</span>}
              {p.priority && <span className="tag tag--star"><Star size={12} /> First</span>}
            </div>
            <figcaption className="tile-actions">
              <button type="button" className={`icon-btn ${p.priority ? "on" : ""}`} title="Show first" aria-label="Show this photo first" aria-pressed={p.priority} onClick={() => patch(p, { priority: !p.priority })}><Star size={16} /></button>
              <button type="button" className={`icon-btn ${hero === p.id ? "on" : ""}`} title="Use as the opening hero photo" aria-label="Use as hero photo" aria-pressed={hero === p.id} onClick={() => setHeroPhoto(p)}><Crown size={16} /></button>
              <button type="button" className="icon-btn" title="Set focus point" aria-label="Set focus point" onClick={() => setFocal(p)}><Crosshair size={16} /></button>
              <ReplaceButton title="Replace photo" onAsset={async (a) => { await patch(p, { asset: a }); }}><RefreshCw size={16} /></ReplaceButton>
              <button type="button" className="icon-btn danger" title="Delete" aria-label="Delete photo" onClick={() => remove(p)}><Trash2 size={16} /></button>
            </figcaption>
          </figure>
        )} />
      )}
      {focal && <FocalPicker url={focal.url} x={focal.focalX} y={focal.focalY} onCancel={() => setFocal(null)} onSave={async (x, y) => { const p = focal; setFocal(null); await patch(p, { focalX: x, focalY: y }); }} />}
    </div>
  );
}
