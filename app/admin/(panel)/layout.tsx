import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/guard";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // The proxy is only a first gate — authorisation is re-checked here on every request.
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <>
      <AdminNav />
      <main className="admin-main">{children}</main>
    </>
  );
}
