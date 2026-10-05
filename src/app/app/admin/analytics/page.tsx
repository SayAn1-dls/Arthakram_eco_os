import { count, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubAssessments, clubMembers, clubs, events, feedback, opportunities, participants, savedOpportunities, users } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { BarList } from "@/components/bar-list";
import { Card, Forbidden, PageHeader, Stat, StatRow } from "@/components/ui";
import { humanize, pct } from "@/lib/format";

export const metadata = { title: "Analytics" };

export default async function Analytics() {
  const me = await adminPage("analytics.view");
  if (!me) return <Forbidden />;
  const evs = db.select().from(events).all();
  const byType = new Map<string, number>();
  for (const e of evs) byType.set(humanize(e.type), (byType.get(humanize(e.type)) ?? 0) + 1);
  const participationPerEvent = evs
    .map((e) => {
      const total = db.select({ n: count() }).from(participants).where(eq(participants.eventId, e.id)).get()!.n;
      const present = db.select({ n: count() }).from(participants).where(sql`${participants.eventId} = ${e.id} and ${participants.checkedInAt} is not null`).get()!.n;
      return { e, total, present };
    })
    .filter((x) => x.total > 0);
  const clubSize = db
    .select({ name: clubs.name, n: count(clubMembers.userId) })
    .from(clubs)
    .leftJoin(clubMembers, eq(clubMembers.clubId, clubs.id))
    .groupBy(clubs.id)
    .all()
    .sort((a, b) => b.n - a.n);
  const fbByEvent = evs
    .map((e) => {
      const rows = db.select({ r: feedback.rating }).from(feedback).where(eq(feedback.eventId, e.id)).all();
      return { label: e.title, value: rows.length ? +(rows.reduce((a, b) => a + b.r, 0) / rows.length).toFixed(2) : 0, hint: `${rows.length} responses` };
    })
    .filter((x) => x.value > 0);
  const assessments = db.select().from(clubAssessments).all();
  const topClub = new Map<string, number>();
  const clubName = new Map(db.select().from(clubs).all().map((c) => [c.id, c.name]));
  for (const a of assessments) {
    const t = a.results[0];
    if (t) topClub.set(clubName.get(t.clubId) ?? "?", (topClub.get(clubName.get(t.clubId) ?? "?") ?? 0) + 1);
  }
  const oppCat = db.select({ c: opportunities.category, n: count() }).from(opportunities).groupBy(opportunities.category).all();
  const totalUsers = db.select({ n: count() }).from(users).get()!.n;
  const activeUsers = db.select({ n: count() }).from(users).where(isNotNull(users.lastLoginAt)).get()!.n;
  const saves = db.select({ n: count() }).from(savedOpportunities).get()!.n;
  const totalP = participationPerEvent.reduce((a, b) => a + b.total, 0);
  const totalPresent = participationPerEvent.reduce((a, b) => a + b.present, 0);
  return (
    <>
      <PageHeader eyebrow="Admin" title="Analytics" description="Institution-level view of how the ecosystem is being used." />
      <StatRow className="mb-6">
        <Stat value={totalUsers} label="Accounts" hint={`${activeUsers} have signed in`} />
        <Stat value={evs.length} label="Events" />
        <Stat value={totalP} label="Registrations" />
        <Stat value={`${pct(totalPresent, totalP)}%`} label="Attendance" tone="brand" />
        <Stat value={assessments.length} label="Club assessments" hint={`${saves} saved opportunities`} />
      </StatRow>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Registrations per event">
          <BarList data={participationPerEvent.map((x) => ({ label: x.e.title, value: x.total, hint: `${x.present} checked in` }))} />
        </Card>
        <Card title="Attendance rate per event">
          <BarList data={participationPerEvent.map((x) => ({ label: x.e.title, value: pct(x.present, x.total) }))} unit="%" max={100} />
        </Card>
        <Card title="Club membership">
          <BarList data={clubSize.map((c) => ({ label: c.name, value: c.n }))} />
        </Card>
        <Card title="Top club match from Find My Club">
          <BarList data={[...topClub.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} />
        </Card>
        <Card title="Events by type">
          <BarList data={[...byType.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} />
        </Card>
        <Card title="Average feedback rating (out of 5)">
          <BarList data={fbByEvent} max={5} />
        </Card>
        <Card title="Opportunities by category" className="lg:col-span-2">
          <BarList data={oppCat.map((o) => ({ label: humanize(o.c), value: o.n })).sort((a, b) => b.value - a.value)} />
        </Card>
      </div>
    </>
  );
}
