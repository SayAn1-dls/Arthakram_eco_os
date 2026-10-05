import Link from "next/link";
import { requireUser } from "@/server/auth";
import { globalSearch } from "@/server/search";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { Input } from "@/components/forms";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const user = await requireUser();
  const hits = await globalSearch(q, user.id);
  const groups = new Map<string, typeof hits>();
  for (const h of hits) groups.set(h.kind, [...(groups.get(h.kind) ?? []), h]);
  return (
    <>
      <PageHeader eyebrow="Search" title={q ? `Results for “${q}”` : "Search Arthakram"} description="Events, competitions, clubs, colleges, organizations, mentors, opportunities, documents, problem statements and resources — filtered to what you’re allowed to see." />
      <form className="mb-8 max-w-xl">
        <Input name="q" defaultValue={q} placeholder="Try “product”, “rubric”, “Rohan”, “kirana”…" autoFocus />
      </form>
      {q && hits.length === 0 && <EmptyState title="No matches">Try a broader word.</EmptyState>}
      <div className="space-y-8">
        {[...groups.entries()].map(([kind, list]) => (
          <section key={kind}>
            <div className="eyebrow mb-3">
              {kind} <span className="text-muted">({list.length})</span>
            </div>
            <ul className="divide-y divide-line/70 rounded-[var(--radius-card)] border border-line bg-card">
              {list.map((h, i) => (
                <li key={i}>
                  <Link href={h.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-brand-wash/40">
                    <span>
                      <span className="font-semibold text-ink">{h.title}</span>
                      {h.subtitle && <span className="ml-2 text-sm text-muted">{h.subtitle}</span>}
                    </span>
                    <Badge>{kind}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
