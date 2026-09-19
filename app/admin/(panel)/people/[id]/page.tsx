import { notFound } from "next/navigation";
import { PersonEditor } from "@/components/admin/PersonEditor";
import { readPeople, readPersonPhotos } from "@/lib/data";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = (await readPeople()).find((p) => p.id === id);
  if (!person) notFound();
  return <PersonEditor initial={person} initialPhotos={await readPersonPhotos(id)} />;
}
