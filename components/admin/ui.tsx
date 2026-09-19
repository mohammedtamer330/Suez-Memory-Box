"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, UploadCloud } from "lucide-react";
import { ACCEPT, uploadMany, type FileStatus, type UploadedAsset } from "./uploader";
import { api, ApiError } from "./api";

/* ---------- save state ---------- */
export type SaveState = { kind: "idle" } | { kind: "saving"; label?: string } | { kind: "saved" } | { kind: "failed"; message: string };

export function useSave() {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const run = useCallback(async <T,>(fn: () => Promise<T>, label?: string): Promise<T | undefined> => {
    clearTimeout(timer.current);
    setState({ kind: "saving", label });
    try {
      const r = await fn();
      setState({ kind: "saved" });
      timer.current = setTimeout(() => setState({ kind: "idle" }), 2200);
      return r;
    } catch (e) {
      setState({ kind: "failed", message: e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong." });
      return undefined;
    }
  }, []);
  return { state, run, reset: () => setState({ kind: "idle" }) };
}

export function SaveBadge({ state }: { state: SaveState }) {
  if (state.kind === "idle") return <span className="save-badge" aria-live="polite" />;
  return (
    <span className={`save-badge save-badge--${state.kind}`} role="status" aria-live="polite">
      {state.kind === "saving" && <><Loader2 size={14} className="spin" /> {state.label || "Saving…"}</>}
      {state.kind === "saved" && <>Saved</>}
      {state.kind === "failed" && <>Failed — {state.message}</>}
    </span>
  );
}

/* ---------- upload panel ---------- */
export function UploadPanel<T>({ scope, endpoint, onAdded, label }: {
  scope: "group" | "person"; endpoint: string; onAdded: (added: T[]) => void; label: string;
}) {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [phase, setPhase] = useState<"idle" | "working" | "complete">("idle");
  const [notes, setNotes] = useState<string[]>([]);

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!accepted.length) return;
    setPhase("working"); setNotes([]);
    const status: FileStatus[] = accepted.map((f) => ({ name: f.name, state: "queued" }));
    setFiles(status);
    const { assets } = await uploadMany(accepted, scope, (i, s) => { status[i] = s; setFiles([...status]); });
    const messages: string[] = [];
    if (assets.length) {
      try {
        const r = await api<{ added: T[]; rejected: { index: number; reason: string }[] }>(endpoint, { method: "POST", json: { items: assets satisfies UploadedAsset[] } });
        onAdded(r.added);
        r.rejected.forEach((x) => messages.push(x.reason));
      } catch (e) { messages.push(e instanceof Error ? e.message : "Saving failed."); }
    }
    setNotes(messages);
    setPhase("complete");
  }, [endpoint, onAdded, scope]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: ACCEPT, multiple: true, disabled: phase === "working" });
  const done = files.filter((f) => f.state === "done").length;
  const failed = files.filter((f) => f.state === "failed");
  return (
    <div className="upload">
      <div {...getRootProps({ className: `dropzone ${isDragActive ? "is-active" : ""} ${phase === "working" ? "is-busy" : ""}` })}>
        <input {...getInputProps()} />
        <UploadCloud size={26} aria-hidden />
        <strong>{label}</strong>
        <span>Drop photos here or tap to choose — JPG, PNG, WebP, HEIC. Several at once is fine.</span>
      </div>
      {phase !== "idle" && (
        <div className="upload-status" role="status" aria-live="polite">
          <div className="upload-head">
            {phase === "working" ? <><Loader2 size={14} className="spin" /> Uploading {done} of {files.length}…</> : <>Complete — {done} of {files.length} added{failed.length ? `, ${failed.length} failed` : ""}</>}
          </div>
          <ul className="upload-list">
            {files.map((f, i) => (
              <li key={i} className={`u-${f.state}`}>
                <span className="u-name">{f.name}</span>
                <span className="u-state">{f.state === "failed" ? f.reason : f.state === "processing" ? "Processing" : f.state === "uploading" ? "Uploading" : f.state === "done" ? "Uploaded" : "Waiting"}</span>
              </li>
            ))}
          </ul>
          {notes.map((n, i) => <p key={i} className="upload-note">{n}</p>)}
        </div>
      )}
    </div>
  );
}

/* ---------- sortable grid ---------- */
export function SortableGrid<T extends { id: string }>({ items, onReorder, renderItem, className = "grid" }: {
  items: T[]; onReorder: (next: T[]) => void; renderItem: (item: T, handle: React.ReactNode) => React.ReactNode; className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dndId = useId(); // stable ids so server and client markup match (dnd-kit's default counter doesn't)
  const end = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id), to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  };
  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className={className}>{items.map((it) => <SortableTile key={it.id} id={it.id}>{(handle) => renderItem(it, handle)}</SortableTile>)}</div>
      </SortableContext>
    </DndContext>
  );
}

function SortableTile({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button type="button" className="drag-handle" aria-label="Drag to reorder" {...attributes} {...listeners}><GripVertical size={16} /></button>
  );
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : undefined, opacity: isDragging ? 0.75 : 1 }}>{children(handle)}</div>;
}

/* ---------- focal point picker ---------- */
export function FocalPicker({ url, x, y, onCancel, onSave }: { url: string; x: number; y: number; onCancel: () => void; onSave: (x: number, y: number) => void }) {
  const [pt, setPt] = useState({ x, y });
  const ref = useRef<HTMLDivElement>(null);
  const pick = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    setPt({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onCancel]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Set the focus point">
      <div className="modal-card">
        <h3>Where are the people?</h3>
        <p className="muted">Tap the most important part of the photo. Wherever it has to be cropped, this point stays in view.</p>
        <div ref={ref} className="focal-stage" onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); pick(e); }} onPointerMove={(e) => { if (e.buttons) pick(e); }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" draggable={false} />
          <i className="focal-dot" style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }} />
        </div>
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn primary" onClick={() => onSave(pt.x, pt.y)}>Save focus point</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- replace-file button ---------- */
export function ReplaceButton({ onAsset, children, title, scope = "group" }: { onAsset: (a: UploadedAsset) => Promise<void> | void; children: React.ReactNode; title: string; scope?: "group" | "person" }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input ref={input} type="file" accept="image/*,.heic,.heif" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = "";
        if (!f) return;
        setBusy(true);
        try {
          const { uploadOne } = await import("./uploader");
          await onAsset(await uploadOne(f, scope));
        } finally { setBusy(false); }
      }} />
      <button type="button" className="icon-btn" title={title} aria-label={title} disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 size={16} className="spin" /> : children}</button>
    </>
  );
}
