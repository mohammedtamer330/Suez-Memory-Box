"use client";
import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { api } from "./api";

interface Check { id: string; label: string; ok: boolean; detail: string }

export function SystemCheck() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async () => {
    setBusy(true); setErr("");
    try { setChecks((await api<{ checks: Check[] }>("/api/admin/health", { method: "POST", json: {} })).checks); }
    catch (e) { setErr(e instanceof Error ? e.message : "The check failed."); }
    setBusy(false);
  };
  const bad = checks?.filter((c) => !c.ok).length ?? 0;
  return (
    <section className="card stack-s">
      <div className="row between wrap gap">
        <div><h2>System check</h2><p className="muted">Tests what the live site can actually see: settings, the database and photo storage. Nothing secret is shown.</p></div>
        <button type="button" className="btn primary" onClick={run} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : null} Run system check</button>
      </div>
      {err && <p className="form-error" role="alert">{err}</p>}
      {checks && (
        <>
          <p className={bad ? "form-error" : "save-badge save-badge--saved"} role="status">{bad ? `${bad} problem${bad === 1 ? "" : "s"} found` : "Everything is working"}</p>
          <ul className="checks">
            {checks.map((c) => (
              <li key={c.id} className={c.ok ? "ok" : "bad"}>
                {c.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                <div><strong>{c.label}</strong><span>{c.detail}</span></div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
