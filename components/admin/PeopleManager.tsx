"use client";
import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { allCountries } from "@/lib/countries";
import type { Person, PersonPhoto } from "@/lib/types";
import { Flag } from "@/components/experience/Flag";
import { api } from "./api";
import { SaveBadge, SortableGrid, useSave } from "./ui";

type Row = Person & { cover: PersonPhoto | null; count: number };
const COUNTRIES = allCountries();

export function PeopleManager({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const { state, run } = useSave();

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Please enter a name.");
    if (!code) return setErr("Please choose a country.");
    const p = await run(() => api<Person>("/api/people", { method: "POST", json: { name, countryCode: code } }), "Adding…");
    if (p) { setRows((r) => [...r, { ...p, cover: null, count: 0 }]); setName(""); }
  };
  const reorder = async (next: Row[]) => {
    const prev = rows; setRows(next);
    const ok = await run(() => api("/api/people", { method: "PUT", json: { order: next.map((p) => p.id) } }), "Saving order…");
    if (ok === undefined) setRows(prev);
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>People</h1><p className="muted">Everyone who gets a memory book. Drag to change the order of the names and the shelf.</p></div>
        <SaveBadge state={state} />
      </div>
      <form className="card form-inline" onSubmit={add}>
        <label className="field grow"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Full name" autoComplete="off" /></label>
        <label className="field grow"><span>Country</span>
          <select value={code} onChange={(e) => setCode(e.target.value)}>
            <option value="">Choose a country…</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        <button type="submit" className="btn primary"><Plus size={16} /> Add person</button>
        {err && <p className="form-error" role="alert">{err}</p>}
      </form>
      <SortableGrid items={rows} onReorder={reorder} className="list" renderItem={(p, handle) => (
        <div className="row-item">
          {handle}
          <div className="row-cover">{/* eslint-disable-next-line @next/next/no-img-element */}{p.cover ? <img src={p.cover.thumbUrl} alt="" style={{ objectPosition: `${p.cover.focalX * 100}% ${p.cover.focalY * 100}%` }} /> : <span className="row-cover-empty" />}</div>
          <div className="row-main"><strong>{p.name}</strong><span className="muted"><Flag code={p.countryCode} height={12} /> {p.count} photo{p.count === 1 ? "" : "s"}</span></div>
          <Link className="btn ghost" href={`/admin/people/${p.id}`}><Pencil size={15} /> Edit book</Link>
        </div>
      )} />
    </div>
  );
}
