"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "./api";

export function LoginForm() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await api("/api/admin/login", { method: "POST", json: { password: pw } }); router.replace("/admin"); router.refresh(); }
    catch (x) { setErr(x instanceof Error ? x.message : "Couldn't sign in."); setBusy(false); }
  };
  return (
    <form className="login card" onSubmit={submit}>
      <h1>Suez Summer ’26</h1>
      <p className="muted">Admin</p>
      <label className="field"><span>Password</span><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" autoFocus required /></label>
      {err && <p className="form-error" role="alert">{err}</p>}
      <button className="btn primary" type="submit" disabled={busy || !pw}>{busy ? <Loader2 size={16} className="spin" /> : null} Sign in</button>
    </form>
  );
}
