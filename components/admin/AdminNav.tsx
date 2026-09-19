"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Eye, Images, LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import { api } from "./api";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/group", label: "Group photos", icon: Images },
  { href: "/admin/people", label: "People", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav() {
  const path = usePathname();
  const router = useRouter();
  const out = async () => { try { await api("/api/admin/logout", { method: "POST" }); } catch { /* ignore */ } router.replace("/admin/login"); router.refresh(); };
  return (
    <header className="admin-bar">
      <nav aria-label="Admin">
        {LINKS.map((l) => {
          const on = l.exact ? path === l.href : path.startsWith(l.href);
          const Icon = l.icon;
          return <Link key={l.href} href={l.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}><Icon size={17} /><span>{l.label}</span></Link>;
        })}
      </nav>
      <div className="admin-bar-end">
        <a href="/" target="_blank" rel="noreferrer" className="bar-btn"><Eye size={16} /><span>View site</span></a>
        <button type="button" className="bar-btn" onClick={out}><LogOut size={16} /><span>Sign out</span></button>
      </div>
    </header>
  );
}
