import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { awards, clubMembers, clubs, colleges, events, users } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { can, clubScope } from "@/server/rbac";
import { decideMember, leaveClub, requestJoinClub } from "@/server/actions/student";
import { ActionButton } from "@/components/forms";
import { EventCard } from "@/components/event-card";
import { Avatar, Badge, Card, DashList, LinkButton } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: db.select({ n: clubs.name }).from(clubs).where(eq(clubs.slug, slug)).get()?.n ?? "Club" };
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = db.select().from(clubs).where(eq(clubs.slug, slug)).get();
  if (!c) notFound();
  const user = await getCurrentUser();
  const college = c.collegeId ? db.select().from(colleges).where(eq(colleges.id, c.collegeId)).get() : null;
  const members = db.select({ m: clubMembers, name: users.name, id: users.id }).from(clubMembers).innerJoin(users, eq(users.id, clubMembers.userId)).where(eq(clubMembers.clubId, c.id)).all();
  const active = members.filter((m) => m.m.status === "active");
  const pending = members.filter((m) => m.m.status === "pending");
  const mine = user ? members.find((m) => m.id === user.id) : null;
  const scope = await clubScope(c.id);
  const canApprove = user && scope ? await can(user.id, "clubs.approve", scope) : false;
  const evs = db.select().from(events).where(and(eq(events.clubId, c.id), eq(events.visibility, "public"))).orderBy(desc(events.startsAt)).all().filter((e) => e.status !== "draft");
  const wins = db.select({ a: awards }).from(awards).innerJoin(events, eq(events.id, awards.eventId)).where(eq(events.clubId, c.id)).all();
  const upcoming = evs.filter((e) => ["live", "published"].includes(e.status));
  const past = evs.filter((e) => !["live", "published"].includes(e.status));
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
            <span className="eyebrow">{c.category} · {college?.name}</span>
          </div>
          <h1 className="mt-3 text-[clamp(2.2rem,5vw,3.4rem)] font-bold leading-[1.05]">{c.name}</h1>
          {c.tagline && <p className="mt-2 text-2xl font-bold"><span className="highlight">{c.tagline}</span></p>}
          <p className="mt-6 max-w-2xl text-lg text-ink-2">{c.description}</p>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <div className="eyebrow mb-4">What you’ll learn</div>
              <DashList items={c.learnings.map((l) => ({ title: l }))} />
            </div>
            <div>
              <div className="eyebrow mb-4">What we do</div>
              <DashList items={c.activities.map((l) => ({ title: l }))} />
            </div>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Card title="Who fits"><p className="text-sm text-ink-2">{c.fitProfile ?? "—"}</p></Card>
            <Card title="Career paths"><div className="flex flex-wrap gap-1">{c.careerPaths.map((p) => <Badge key={p}>{p}</Badge>)}</div></Card>
            <Card title="First steps"><ol className="list-decimal space-y-1 pl-4 text-sm">{c.firstSteps.map((f) => <li key={f}>{f}</li>)}</ol></Card>
          </div>
          {upcoming.length > 0 && (
            <section className="mt-12">
              <div className="eyebrow mb-4">Upcoming events</div>
              <div className="grid gap-4 md:grid-cols-2">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</div>
            </section>
          )}
          {past.length > 0 && (
            <section className="mt-10">
              <div className="eyebrow mb-4">Past events</div>
              <div className="grid gap-4 md:grid-cols-2">{past.map((e) => <EventCard key={e.id} e={e} />)}</div>
            </section>
          )}
        </div>
        <aside className="space-y-5">
          <Card>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-2xl font-bold">{active.length}</div><div className="text-xs text-muted">members</div></div>
              <div><div className="text-2xl font-bold">{evs.length}</div><div className="text-xs text-muted">events</div></div>
              <div><div className="text-2xl font-bold">{wins.length}</div><div className="text-xs text-muted">awards</div></div>
            </div>
            <div className="mt-5 border-t border-line pt-5">
              {!user ? (
                <LinkButton href={`/login?next=/clubs/${slug}`} className="w-full">Sign in to join</LinkButton>
              ) : mine ? (
                <div className="flex items-center justify-between">
                  <Badge tone={mine.m.status === "active" ? "ok" : "warn"}>{mine.m.status === "active" ? `You're a ${mine.m.role}` : "Request pending"}</Badge>
                  <ActionButton action={leaveClub} hidden={{ clubId: c.id }} variant="ghost" confirm={`Leave ${c.name}?`}>{mine.m.status === "active" ? "Leave" : "Cancel"}</ActionButton>
                </div>
              ) : c.isRecruiting ? (
                <ActionButton action={requestJoinClub} hidden={{ clubId: c.id }} variant="primary" size="lg" className="w-full">Request to join</ActionButton>
              ) : (
                <p className="text-sm text-muted">Not recruiting right now.</p>
              )}
            </div>
            {c.contactEmail && <p className="mt-3 text-center text-xs text-muted">{c.contactEmail}</p>}
          </Card>
          {canApprove && pending.length > 0 && (
            <Card title="Join requests" eyebrow="Visible to club leads">
              <ul className="space-y-2">
                {pending.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">{p.name}</span>
                    <span className="flex gap-1">
                      <ActionButton action={decideMember} hidden={{ clubId: c.id, userId: p.id, decision: "approve" }} variant="primary">Approve</ActionButton>
                      <ActionButton action={decideMember} hidden={{ clubId: c.id, userId: p.id, decision: "reject" }} variant="ghost">Decline</ActionButton>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Members">
            <div className="flex flex-wrap gap-1">
              {active.slice(0, 24).map((m) => <span key={m.id} title={`${m.name}${m.m.role !== "member" ? ` · ${m.m.role}` : ""}`}><Avatar name={m.name} size={30} /></span>)}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
