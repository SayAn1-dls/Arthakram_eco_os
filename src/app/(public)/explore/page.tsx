import Link from "next/link";
import { getCurrentUser } from "@/server/auth";
import { globalSearch } from "@/server/search";
import { Badge, PageHeader } from "@/components/ui";

export const metadata = { title: "Explore" };

const DOORS = [
  ["Opportunities", "/opportunities", "Hackathons, cases, MUNs, fellowships"],
  ["Events", "/events", "What's live and coming up"],
  ["Competitions", "/competitions", "Compete on published rubrics"],
  ["Clubs", "/clubs", "Find your people"],
  ["Mentors", "/mentors", "Get structured feedback"],
  ["Organizations", "/organizations", "Colleges & communities"],
  ["Archive", "/archive", "Learn from past competitions"],
  ["Learn", "/learn", "Product Guys & Consulting"],
];

export default async function Explore({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const user = await getCurrentUser();
  const hits = q ? await globalSearch(q, user?.id ?? null) : [];
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Explore" title="Everything in the ecosystem" />
      <form className="mb-10 max-w-xl">
        <input name="q" defaultValue={q} autoFocus placeholder="Search events, clubs, mentors, problem statements…" className="h-12 w-full rounded-xl border border-line bg-white px-4 focus:border-brand focus:outline-none" />
      </form>
      {q ? (
        <ul className="divide-y divide-line/70 rounded-[var(--radius-card)] border border-line bg-card">
          {hits.length === 0 && <li className="p-6 text-center text-muted">No matches for “{q}”.</li>}
          {hits.map((h, i) => (
            <li key={i}><Link href={h.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-brand-wash/40"><span><b className="text-ink">{h.title}</b> {h.subtitle && <span className="text-sm text-muted">{h.subtitle}</span>}</span><Badge>{h.kind}</Badge></Link></li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DOORS.map(([t, h, d]) => (
            <Link key={h} href={h} className="rounded-[var(--radius-card)] border border-line bg-card p-5 hover:border-brand">
              <div className="dash text-lg font-bold text-ink">{t}</div>
              <p className="mt-1 pl-[1.85rem] text-sm text-muted">{d}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
