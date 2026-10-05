import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubMembers, clubs, colleges } from "@/db/schema";
import { Badge, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Clubs" };

export default async function ClubsPage() {
  const list = db.select({ c: clubs, college: colleges.name }).from(clubs).leftJoin(colleges, eq(colleges.id, clubs.collegeId)).orderBy(asc(clubs.name)).all();
  const members = new Map(db.select({ id: clubMembers.clubId, n: count() }).from(clubMembers).where(eq(clubMembers.status, "active")).groupBy(clubMembers.clubId).all().map((r) => [r.id, r.n]));
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Clubs" title="Find your people" description="Every club explains what you'll learn, what you'll do and who fits — so you can choose on substance." actions={<LinkButton href="/app/find-my-club">Which club fits me?</LinkButton>} />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {list.map(({ c, college }) => (
          <Link key={c.id} href={`/clubs/${c.slug}`} className="group flex flex-col rounded-[var(--radius-card)] border border-line bg-card p-6 transition-colors hover:border-brand">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
              <span className="eyebrow !text-[0.62rem]">{c.category}</span>
              {c.isRecruiting && <Badge tone="ok">Recruiting</Badge>}
            </div>
            <div className="mt-3 text-xl font-extrabold leading-tight text-ink group-hover:text-brand-deep">{c.name}</div>
            <p className="mt-1 text-sm font-semibold text-ink-2">{c.tagline}</p>
            <p className="mt-2 flex-1 text-sm text-muted">{c.description}</p>
            <div className="mt-4 text-xs text-muted">
              {college} · {members.get(c.id) ?? 0} members
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
