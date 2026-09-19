import Link from "next/link";
import { getExperienceData } from "@/lib/data";

export default async function Overview() {
  const { people, group, settings } = await getExperienceData();
  const withPhotos = people.filter((p) => p.photos.length > 0).length;
  const total = people.reduce((n, p) => n + p.photos.length, 0);
  const empty = people.filter((p) => p.photos.length === 0);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Overview</h1><p className="muted">{settings.title}</p></div></div>
      <div className="stats">
        <Link href="/admin/group" className="stat"><strong>{group.length}</strong><span>group photos</span></Link>
        <Link href="/admin/people" className="stat"><strong>{people.length}</strong><span>people</span></Link>
        <Link href="/admin/people" className="stat"><strong>{total}</strong><span>photos in books</span></Link>
        <Link href="/admin/people" className="stat"><strong>{withPhotos}/{people.length}</strong><span>books with photos</span></Link>
      </div>
      {empty.length > 0 && (
        <section className="card stack-s">
          <h2>Books still empty</h2>
          <p className="muted">These people appear on the shelf with a plain cover until you add their photos.</p>
          <ul className="chips">{empty.map((p) => <li key={p.id}><Link href={`/admin/people/${p.id}`}>{p.name}</Link></li>)}</ul>
        </section>
      )}
    </div>
  );
}
