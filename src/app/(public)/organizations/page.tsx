import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs, colleges, events, organizations } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { humanize } from "@/lib/format";

export const metadata = { title: "Organizations" };

export default async function OrgsPage() {
  const orgs = db.select().from(organizations).orderBy(asc(organizations.name)).all();
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Organizations" title="Colleges, clubs & communities" description="Arthakram is built to run many colleges and organizations, each with its own clubs and events." />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {orgs.map((o) => {
          const cols = db.select().from(colleges).where(eq(colleges.organizationId, o.id)).all();
          const nClubs = db.select({ id: clubs.id }).from(clubs).where(eq(clubs.organizationId, o.id)).all().length;
          const nEvents = db.select({ id: events.id }).from(events).where(eq(events.organizationId, o.id)).all().filter(Boolean).length;
          return (
            <Link key={o.id} href={`/organizations/${o.slug}`} className="rounded-[var(--radius-card)] border border-line bg-card p-6 hover:border-brand">
              <div className="eyebrow">{humanize(o.kind)}</div>
              <div className="mt-2 text-xl font-bold text-ink">{o.name}</div>
              <p className="mt-2 text-sm text-muted">{o.description}</p>
              <div className="mt-4 text-xs text-muted">{cols.length} colleges · {nClubs} clubs · {nEvents} events</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
