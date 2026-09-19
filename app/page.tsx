import { getExperienceData } from "@/lib/data";
import { Experience } from "@/components/experience/Experience";

export const revalidate = 60;

export default async function Home() {
  const data = await getExperienceData();
  return <Experience data={data} />;
}
