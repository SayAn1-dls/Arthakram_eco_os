import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { documents, events, problemStatements, rubrics, teams } from "@/db/schema";
import { clubNames, publicEvents } from "@/server/public";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { fmtDate, humanize } from "@/lib/format";

export const metadata = { title: "Competition archive" };

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  let list = publicEvents({ status: ["completed", "archived"] });
  if (q) {
    const n = q.toLowerCase();
    list = list.filter((e) => [e.title, e.description ?? "", e.type, ...e.tags].some((v) => v.toLowerCase().includes(n)));
  }
  const names = clubNames();
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Archive" title="Past competitions" description="Problem statements, rubrics, results and final reports from events that have finished. A good place to prepare for the next one." />
      <form className="mb-8 max-w-md"><input name="q" defaultValue={q} placeholder="Search past events…" className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none" /></form>
      {list.length === 0 && <EmptyState title="Nothing archived yet" />}
      <div className="space-y-4">
        {list.map((e) => {
          const ps = db.select({ id: problemStatements.id }).from(problemStatements).where(eq(problemStatements.eventId, e.id)).all().length;
          const rb = db.select({ id: rubrics.id }).from(rubrics).where(eq(rubrics.eventId, e.id)).all().length;
          const tm = db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, e.id)).all().length;
          const docs = db.select().from(documents).where(and(eq(documents.eventId, e.id), eq(documents.status, "published"), inArray(documents.visibility, ["public"]))).all();
          return (
            <Card key={e.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2"><Badge>{humanize(e.type)}</Badge><span className="text-xs text-muted">{fmtDate(e.startsAt)} · {e.clubId ? names.get(e.clubId) : ""}</span></div>
                  <Link href={`/events/${e.slug}`} className="mt-2 block text-xl font-bold text-ink hover:text-brand-deep">{e.title}</Link>
                  <p className="text-sm text-muted">{e.tagline}</p>
                </div>
                <div className="flex gap-4 text-center text-sm">
                  <div><div className="text-xl font-bold">{tm}</div><div className="text-xs text-muted">teams</div></div>
                  <div><div className="text-xl font-bold">{ps || "—"}</div><div className="text-xs text-muted">problems</div></div>
                  <div><div className="text-xl font-bold">{rb}</div><div className="text-xs text-muted">rubrics</div></div>
                </div>
              </div>
              {docs.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                  {docs.map((d) => <Link key={d.id} href={`/events/${e.slug}/docs/${d.id}`} className="rounded-full border border-line bg-paper px-3 py-1 text-sm font-semibold text-ink-2 hover:border-brand">📄 {d.title}</Link>)}
                  {e.resultsPublished && <Link href={`/events/${e.slug}`} className="rounded-full border border-brand/40 bg-brand-wash px-3 py-1 text-sm font-semibold text-brand-deep">🏆 Results</Link>}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
