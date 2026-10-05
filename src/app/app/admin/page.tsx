import Link from "next/link";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, clubMembers, clubs, events, mentorProfiles, opportunities, organizations, roleAssignments, users, colleges } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { Card, Forbidden, LinkButton, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { fmtRelative } from "@/lib/format";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const user = await adminPage("users.view");
  if (!user) return <Forbidden />;
  const n = (q: { n: number } | undefined) => q?.n ?? 0;
  const stats = {
    users: n(db.select({ n: count() }).from(users).get()),
    orgs: n(db.select({ n: count() }).from(organizations).get()),
    colleges: n(db.select({ n: count() }).from(colleges).get()),
    clubs: n(db.select({ n: count() }).from(clubs).get()),
    live: n(db.select({ n: count() }).from(events).where(eq(events.status, "live")).get()),
    upcoming: n(db.select({ n: count() }).from(events).where(eq(events.status, "published")).get()),
    drafts: n(db.select({ n: count() }).from(events).where(eq(events.status, "draft")).get()),
    opps: n(db.select({ n: count() }).from(opportunities).where(eq(opportunities.status, "active")).get()),
    mentors: n(db.select({ n: count() }).from(mentorProfiles).where(eq(mentorProfiles.status, "approved")).get()),
    grants: n(db.select({ n: count() }).from(roleAssignments).where(isNull(roleAssignments.revokedAt)).get()),
  };
  const pendingMentors = db.select({ id: mentorProfiles.userId, name: users.name, headline: mentorProfiles.headline }).from(mentorProfiles).innerJoin(users, eq(users.id, mentorProfiles.userId)).where(eq(mentorProfiles.status, "pending")).all();
  const pendingMembers = db.select({ n: count() }).from(clubMembers).where(eq(clubMembers.status, "pending")).get()?.n ?? 0;
  const draftEvents = db.select().from(events).where(eq(events.status, "draft")).all();
  const activity = db.select({ a: auditLogs, actor: users.name }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).orderBy(desc(auditLogs.createdAt)).limit(10).all();
  const liveEvents = db.select().from(events).where(and(eq(events.status, "live"))).all();
  return (
    <>
      <PageHeader eyebrow="Admin" title="Control center" description="Control → Configure → Delegate → Monitor → Analyze." actions={<LinkButton href="/app/admin/users">Manage access</LinkButton>} />
      <div className="mb-8 grid grid-cols-2 gap-6 rounded-[var(--radius-card)] border border-line bg-card p-5 sm:grid-cols-5">
        <Stat value={stats.users} label="Users" />
        <Stat value={`${stats.orgs} · ${stats.colleges} · ${stats.clubs}`} label="Orgs · colleges · clubs" />
        <Stat value={stats.live} label="Live events" tone="brand" />
        <Stat value={stats.upcoming} label="Upcoming events" />
        <Stat value={stats.opps} label="Active opportunities" />
        <Stat value={stats.mentors} label="Approved mentors" />
        <Stat value={stats.grants} label="Active access grants" />
        <Stat value={stats.drafts} label="Draft events" />
        <Stat value={pendingMentors.length} label="Mentor approvals" tone={pendingMentors.length ? "brand" : "ink"} />
        <Stat value={pendingMembers} label="Club join requests" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Pending approvals">
          <ul className="space-y-3 text-sm">
            {pendingMentors.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span>
                  <b className="text-ink">{m.name}</b> <span className="text-muted">wants to mentor</span>
                </span>
                <Link href="/app/admin/mentors" className="font-semibold text-brand-deep">
                  Review
                </Link>
              </li>
            ))}
            {draftEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span>
                  <b className="text-ink">{e.title}</b> <span className="text-muted">is a draft</span>
                </span>
                <Link href={`/app/events/${e.id}/setup`} className="font-semibold text-brand-deep">
                  Open
                </Link>
              </li>
            ))}
            {pendingMentors.length + draftEvents.length === 0 && <li className="text-muted">Nothing waiting.</li>}
          </ul>
        </Card>
        <Card title="Live now">
          <ul className="space-y-3 text-sm">
            {liveEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <Link href={`/app/events/${e.id}`} className="font-semibold text-ink hover:text-brand-deep">
                  {e.title}
                </Link>
                <StatusBadge status="live" />
              </li>
            ))}
            {liveEvents.length === 0 && <li className="text-muted">No live events.</li>}
          </ul>
        </Card>
        <Card title="Platform activity" actions={<Link href="/app/admin/audit" className="text-sm font-semibold text-brand-deep">Audit log</Link>}>
          <ul className="space-y-2.5 text-sm">
            {activity.map(({ a }) => (
              <li key={a.id}>
                <div className="text-ink-2">{a.summary}</div>
                <div className="text-xs text-muted">{fmtRelative(a.createdAt)}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
