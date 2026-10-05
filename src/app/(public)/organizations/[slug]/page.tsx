import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs, colleges, organizations } from "@/db/schema";
import { clubNames, publicEvents } from "@/server/public";
import { EventCard } from "@/components/event-card";
import { Card, PageHeader } from "@/components/ui";
import { humanize } from "@/lib/format";

export default async function OrgPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const o = db.select().from(organizations).where(eq(organizations.slug, slug)).get();
  if (!o) notFound();
  const cols = db.select().from(colleges).where(eq(colleges.organizationId, o.id)).all();
  const cl = db.select().from(clubs).where(eq(clubs.organizationId, o.id)).all();
  const evs = publicEvents().filter((e) => e.organizationId === o.id);
  const names = clubNames();
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow={humanize(o.kind)} title={o.name} description={o.description}>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-ink-2">
          {o.website && <a href={o.website} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-deep hover:underline">{o.website.replace(/^https?:\/\//, "")}</a>}
          {o.contactEmail && <span>{o.contactEmail}</span>}
        </div>
      </PageHeader>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="eyebrow mb-4">Events</div>
          <div className="grid gap-4 md:grid-cols-2">{evs.map((e) => <EventCard key={e.id} e={e} club={e.clubId ? names.get(e.clubId) : undefined} />)}</div>
        </div>
        <aside className="space-y-5">
          <Card title="Colleges"><ul className="space-y-1 text-sm">{cols.map((c) => <li key={c.id}><b>{c.name}</b> <span className="text-muted">{c.city}</span></li>)}</ul></Card>
          <Card title="Clubs"><ul className="space-y-1.5 text-sm">{cl.map((c) => <li key={c.id}><Link href={`/clubs/${c.slug}`} className="font-semibold text-ink hover:text-brand-deep">{c.name}</Link></li>)}</ul></Card>
        </aside>
      </div>
    </div>
  );
}
