import { SettingsForm } from "@/components/admin/SettingsForm";
import { readGroup, readSettings } from "@/lib/data";

export default async function SettingsPage() {
  const [settings, group] = await Promise.all([readSettings(), readGroup()]);
  return <SettingsForm initial={settings} group={group} />;
}
