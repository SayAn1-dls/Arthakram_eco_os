import Link from "next/link";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { evaluations, events, judgeAssignments, mentorRequests, notifications, opportunities, users } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { eventScopeOf, loadGrants } from "@/server/rbac";
import { eventStats } from "@/server/events";
import { clubMatches, participationHistory, passport, recommendedOpportunities, upcomingDeadlines, whatNext } from "@/server/student";
import { allows, allowsAnywhere, PLATFORM } from "@/lib/rbac-core";
import { Badge, Card, DashList, EmptyState, LinkButton, Progress, Stat, StatusBadge } from "@/components/ui";
import { fmtDate, fmtRelative, humanize } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const user = await requireUser();
  const grants = await loadGrants(user.id);
  const isAdmin = allows(grants, "users.view", PLATFORM);
  const organizes = allowsAnywhere(grants, "events.view");
  const judges = allowsAnywhere(grants, "evaluations.submit");
  const mentors = allowsAnywhere(grants, "mentoring.submit");

  const steps = whatNext(user.id);
  const opps = recommendedOpportunities(user.id, 3);
  const clubs = clubMatches(user.id)?.matches.slice(0, 3) ?? [];
  const deadlines = upcomingDeadlines(user.id);
  const myEvents = participationHistory(user.id).slice(0, 4);
  const pp = passport(user.id);
  const recent = db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(5).all();

  const myWorkspaces = organizes
    ? db
        .select()
        .from(events)
        .where(inArray(events.status, ["live", "published", "draft"]))
        .all()
        .filter((e) => allows(grants, "events.view", eventScopeOf(e)))
        .sort((a, b) => (a.status === "live" ? -1 : b.status === "live" ? 1 : a.startsAt.getTime() - b.startsAt.getTime()))
        .slice(0, 3)
    : [];
  const judgePending = judges
    ? db.select({ n: count() }).from(judgeAssignments).where(eq(judgeAssignments.judgeUserId, user.id)).get()!.n -
      db.select({ n: count() }).from(evaluations).where(and(eq(evaluations.judgeUserId, user.id), eq(evaluations.status, "submitted"))).get()!.n
    : 0;
  const mentorPending = mentors ? db.select({ n: count() }).from(mentorRequests).where(and(eq(mentorRequests.mentorId, user.id), eq(mentorRequests.status, "pending"))).get()!.n : 0;
  const platform = isAdmin
    ? {
        users: db.select({ n: count() }).from(users).get()!.n,
        live: db.select({ n: count() }).from(events).where(eq(events.status, "live")).get()!.n,
        upcoming: db.select({ n: count() }).from(events).where(eq(events.status, "published")).get()!.n,
        opps: db.select({ n: count() }).from(opportunities).where(eq(opportunities.status, "active")).get()!.n,
      }
    : null;
  const unread = db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))).get()!.n;
  const first = user.name.split(" ")[0];
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));

  return (
    <div className="space-y-8">
      <header>
        <div className="eyebrow mb-2 text-brand-deep">{fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1 className="text-[2.2rem] font-extrabold leading-tight tracking-tight">
          Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, <span className="highlight">{first}.</span>
        </h1>
        <p className="mt-2 text-muted">
          {unread ? `${unread} unread notification${unread > 1 ? "s" : ""}. ` : ""}
          Here’s what matters across your ecosystem today.
        </p>
      </header>

      {(myWorkspaces.length > 0 || judgePending > 0 || mentorPending > 0 || platform) && (
        <section>
          <div className="eyebrow mb-3">Today’s work</div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {myWorkspaces.map((e) => {
              const s = eventStats(e.id, e.currentRoundId);
              return (
                <Link key={e.id} href={`/app/events/${e.id}`} className={`group rounded-[var(--radius-card)] border p-5 transition-colors hover:border-brand ${e.status === "live" ? "border-brand bg-brand-wash/50" : "border-line bg-card"}`}>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={e.status} />
                    <ArrowRight className="h-4 w-4 text-muted group-hover:text-brand" />
                  </div>
                  <div className="mt-2 font-bold text-ink">{e.title}</div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="font-extrabold tabular">{s.teamCount}</div>
                      <div className="text-xs text-muted">teams</div>
                    </div>
                    <div>
                      <div className="font-extrabold tabular">
                        {s.submitted}/{s.teamCount}
                      </div>
                      <div className="text-xs text-muted">submitted</div>
                    </div>
                    <div>
                      <div className="font-extrabold tabular">
                        {s.evalDone}/{s.evalTotal}
                      </div>
                      <div className="text-xs text-muted">evaluated</div>
                    </div>
                  </div>
                </Link>
              );
            })}
            {judgePending > 0 && (
              <Link href="/app/judge" className="rounded-[var(--radius-card)] border border-line bg-card p-5 hover:border-brand">
                <Badge tone="brand">Judge</Badge>
                <div className="mt-3 text-[2rem] font-extrabold leading-none">{judgePending}</div>
                <div className="mt-1 text-sm text-ink-2">evaluations waiting for you</div>
              </Link>
            )}
            {mentorPending > 0 && (
              <Link href="/app/mentor" className="rounded-[var(--radius-card)] border border-line bg-card p-5 hover:border-brand">
                <Badge tone="info">Mentor</Badge>
                <div className="mt-3 text-[2rem] font-extrabold leading-none">{mentorPending}</div>
                <div className="mt-1 text-sm text-ink-2">mentorship requests to answer</div>
              </Link>
            )}
            {platform && (
              <Link href="/app/admin" className="rounded-[var(--radius-card)] border border-line bg-ink p-5 text-white hover:bg-ink-2">
                <div className="eyebrow !text-white/70">Platform</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-2xl font-extrabold">{platform.users}</div>
                    <div className="text-xs text-white/70">users</div>
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold">{platform.live}</div>
                    <div className="text-xs text-white/70">live events</div>
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold">{platform.upcoming}</div>
                    <div className="text-xs text-white/70">upcoming</div>
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold">{platform.opps}</div>
                    <div className="text-xs text-white/70">opportunities</div>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card title="What should I do next?" eyebrow="Your next 3 steps" actions={<Link href="/app/path" className="text-sm font-semibold text-brand-deep hover:underline">My Path</Link>}>
          {steps.length ? (
            <ol className="space-y-4">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-white">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink">{s.title}</div>
                    <div className="text-sm text-muted">{s.detail}</div>
                  </div>
                  <LinkButton href={s.href} size="sm" variant="outline">
                    {s.cta}
                  </LinkButton>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">You’re on track. Keep competing and collecting feedback.</p>
          )}
        </Card>
        <Card title="Upcoming" eyebrow="Deadlines & events">
          {deadlines.length === 0 ? (
            <p className="text-sm text-muted">Nothing coming up. Save opportunities to track their deadlines here.</p>
          ) : (
            <ul className="space-y-3">
              {deadlines.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                  <Link href={d.href} className="font-semibold text-ink hover:text-brand-deep">
                    {d.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">
                    {d.kind} {fmtRelative(d.when)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card title="Recommended opportunities" actions={<Link href="/app/opportunities" className="text-sm font-semibold text-brand-deep hover:underline">All</Link>}>
          <ul className="space-y-4">
            {opps.map((x) => (
              <li key={x.o.id}>
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/app/opportunities#${x.o.id}`} className="font-semibold text-ink hover:text-brand-deep">
                    {x.o.title}
                  </Link>
                  <Badge tone="solid">{x.score}%</Badge>
                </div>
                <div className="text-xs text-muted">{x.reasons[0]}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Clubs for you" actions={<Link href="/app/find-my-club" className="text-sm font-semibold text-brand-deep hover:underline">{clubs.length ? "Results" : "Take quiz"}</Link>}>
          {clubs.length ? (
            <ul className="space-y-3">
              {clubs.map((c) => (
                <li key={c.clubId}>
                  <div className="flex justify-between text-sm">
                    <Link href={`/clubs/${c.club!.slug}`} className="font-semibold text-ink hover:text-brand-deep">
                      {c.club!.name}
                    </Link>
                    <span className="font-bold tabular text-brand-deep">{c.score}%</span>
                  </div>
                  <Progress value={c.score} className="mt-1" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Find where you belong" action={<LinkButton href="/app/find-my-club" size="sm">Start Find My Club</LinkButton>}>
              17 questions, transparent reasons.
            </EmptyState>
          )}
        </Card>
        <Card title="Student Passport" actions={<Link href="/app/passport" className="text-sm font-semibold text-brand-deep hover:underline">Open</Link>}>
          <div className="grid grid-cols-2 gap-4">
            <Stat value={pp.history.length} label="Events" />
            <Stat value={pp.awards.length} label="Awards" tone="brand" />
            <Stat value={pp.reviews.length} label="Mentor reviews" />
            <Stat value={pp.clubs.length} label="Clubs" />
          </div>
          {pp.skills[0] && <p className="mt-4 text-xs text-muted">Strongest evidence: <b className="text-ink">{pp.skills[0].label}</b></p>}
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card title="My events" actions={<Link href="/app/my-events" className="text-sm font-semibold text-brand-deep hover:underline">All</Link>}>
          {myEvents.length === 0 ? (
            <p className="text-sm text-muted">No events yet.</p>
          ) : (
            <ul className="space-y-3">
              {myEvents.map((h) => (
                <li key={h.p.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={h.team ? `/app/team/${h.team.id}` : `/events/${h.e.slug}`} className="font-semibold text-ink hover:text-brand-deep">
                    {h.e.title}
                  </Link>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted">{humanize(h.e.type)}</span>
                    <StatusBadge status={h.e.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recent activity" actions={<Link href="/app/notifications" className="text-sm font-semibold text-brand-deep hover:underline">Notifications</Link>}>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Quiet so far.</p>
          ) : (
            <DashList items={recent.map((n) => ({ title: n.link ? <Link href={n.link} className="hover:text-brand-deep">{n.title}</Link> : n.title, body: fmtRelative(n.createdAt) }))} />
          )}
        </Card>
      </section>
    </div>
  );
}
