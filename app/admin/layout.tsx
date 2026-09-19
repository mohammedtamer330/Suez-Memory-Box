import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = { title: "Admin — Suez Summer ’26", robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="admin">{children}</div>;
}
