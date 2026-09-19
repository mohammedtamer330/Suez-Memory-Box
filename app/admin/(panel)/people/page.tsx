import { PeopleManager } from "@/components/admin/PeopleManager";
import { getPeopleWithPhotos, resolveCover } from "@/lib/data";

export default async function PeoplePage() {
  const people = await getPeopleWithPhotos();
  const rows = people.map(({ photos, ...p }) => ({ ...p, cover: resolveCover({ ...p, photos }), count: photos.length }));
  return <PeopleManager initial={rows} />;
}
