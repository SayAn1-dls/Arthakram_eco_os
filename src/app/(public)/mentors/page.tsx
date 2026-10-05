import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { mentorProfiles, users } from "@/db/schema";
import { Avatar, Badge, LinkButton, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";

export const metadata = { title: "Mentors" };

export default async function MentorsPage({ searchParams }: { searchParams: Promise<{ q?: string; area?: string }> }) {
  const { q, area } = await searchParams;
  let list = db.select({ m: mentorProfiles, name: users.name }).from(mentorProfiles).innerJoin(users, eq(users.id, mentorProfiles.userId)).where(eq(mentorProfiles.status, "approved")).orderBy(asc(users.name)).all();
  const areas = [...new Set(list.flatMap((x) => x.m.categories))];
  if (area) list = list.filter((x) => x.m.categories.includes(area));
  if (q) {
    const n = q.toLowerCase();
    list = list.filter((x) => [x.name, x.m.headline, x.m.industry ?? "", ...x.m.expertise, ...x.m.skills].some((v) => v.toLowerCase().includes(n)));
  }
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Mentor Connect" title="Get reviewed by people who’ve done it" description="Request structured feedback on projects, cases, pitches and portfolios. Reviews become evidence on your Student Passport." actions={<LinkButton href="/app/mentor" variant="outline">Become a mentor</LinkButton>} />
      <form className="mb-4 max-w-md">
        <input name="q" defaultValue={q} placeholder="Search by name, skill or industry…" className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none" />
      </form>
      <div className="mb-8 flex flex-wrap gap-2">
        <a href="?" className={cn("rounded-full border px-3 py-1 text-sm font-semibold", !area ? "border-brand bg-brand text-white" : "border-line bg-card")}>All</a>
        {areas.map((a) => <a key={a} href={`?area=${a}`} className={cn("rounded-full border px-3 py-1 text-sm font-semibold", area === a ? "border-brand bg-brand text-white" : "border-line bg-card")}>{a.replace(/_/g, " ")}</a>)}
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {list.map(({ m, name }) => (
          <Link key={m.userId} href={`/mentors/${m.userId}`} className="rounded-[var(--radius-card)] border border-line bg-card p-6 transition-colors hover:border-brand">
            <div className="flex items-center gap-3">
              <Avatar name={name} size={48} />
              <div>
                <div className="text-lg font-bold text-ink">{name}</div>
                <div className="text-sm text-muted">{m.headline}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1">{m.expertise.map((e) => <Badge key={e}>{e}</Badge>)}</div>
            <div className="mt-4 text-xs text-muted">{m.experienceYears} yrs · {m.industry} · {m.availability}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
