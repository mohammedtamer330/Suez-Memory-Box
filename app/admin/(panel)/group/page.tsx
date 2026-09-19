import { GroupManager } from "@/components/admin/GroupManager";
import { readGroup, readSettings } from "@/lib/data";

export default async function GroupPage() {
  const [group, settings] = await Promise.all([readGroup(), readSettings()]);
  return <GroupManager initial={group} heroId={settings.heroPhotoId} />;
}
