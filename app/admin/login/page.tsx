import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/guard";
import { LoginForm } from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return <main className="login-wrap"><LoginForm /></main>;
}
