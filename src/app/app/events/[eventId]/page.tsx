import Link from "next/link";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { Check, Circle } from "lucide-react";
import { db } from "@/db";
import { announcements, documents, evaluations, judgeAssignments, problemStatements, rubrics, users } from "@/db/schema";
import { eventAccess, eventStats, nextScheduleItem, recentActivity, roomOccupancy, roundsFor, timersFor } from "@/server/events";
import { AutoRefresh, LiveTimerStrip } from "@/components/live";
import { Badge, Card, EmptyState, Progress, Stat, StatusBadge } from "@/components/ui";
import { fmtDateTime, fmtRelative, fmtTime, humanize, pct } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Control Room" };

export default async function ControlRoom({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, has } = await eventAccess(eventId);
  const rounds = roundsFor(eventId);
  const current = rounds.find((r) => r.id === event.currentRoundId) ?? rounds.find((r) => r.status === "active") ?? null;
  const stats = eventStats(eventId, current?.id ?? null);
  const timers = timersFor(eventId);
  const next = nextScheduleItem(eventId);
  const occupancy = roomOccupancy(eventId);
  const activity = recentActivity(eventId, 10);
  const pinned = db.select().from(announcements).where(eq(announcements.eventId, eventId)).orderBy(desc(announcements.pinned), desc(announcements.createdAt)).limit(3).all();
  const docs = has("documents.view")
    ? db.select({ id: documents.id, title: documents.title, status: documents.status, section: documents.section }).from(documents).where(eq(documents.eventId, eventId)).orderBy(desc(documents.updatedAt)).limit(5).all()
    : [];
  const judgeStatus = current
    ? db
        .select({
          judgeId: judgeAssignments.judgeUserId,
          name: users.name,
          assigned: count(judgeAssignments.id),
          done: sql<number>`(select count(*) from ${evaluations} e where e.round_id = ${current.id} and e.judge_user_id = ${judgeAssignments.judgeUserId} and e.status = 'submitted')`,
        })
        .from(judgeAssignments)
        .innerJoin(users, eq(users.id, judgeAssignments.judgeUserId))
        .where(eq(judgeAssignments.roundId, current.id))
        .groupBy(judgeAssignments.judgeUserId)
        .all()
    : [];

  // Lifecycle checklist derived from real data (spec §43).
  const hasRubric = !!db.select({ id: rubrics.id }).from(rubrics).where(eq(rubrics.eventId, eventId)).get();
  const hasPS = !!db.select({ id: problemStatements.id }).from(problemStatements).where(eq(problemStatements.eventId, eventId)).get();
  const finalReport = db.select().from(documents).where(and(eq(documents.eventId, eventId), eq(documents.section, "final_report"), eq(documents.status, "published"))).get();
  const lifecycle: [string, boolean][] = [
    ["Create & configure", true],
    ["Rules written", !!event.rules],
    ["Rounds created", rounds.length > 0],
    ["Problem statements", hasPS],
    ["Rubric ready", hasRubric],
    ["Judges assigned", stats.judgeCount > 0],
    ["Mentors invited", stats.mentorCount > 0],
    ["Registration opened", event.status !== "draft"],
    ["Teams formed", stats.teamCount > 0],
    ["Check-in", stats.checkedIn > 0],
    ["Event live", ["live", "completed", "archived"].includes(event.status)],
    ["Judging", stats.evalDone > 0],
    ["Results published", event.resultsPublished],
    ["Final documentation", !!finalReport],
    ["Archived", event.status === "archived"],
  ];
  const nextStep = lifecycle.findIndex(([, done]) => !done);

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={15000} />
      <section className={cn("rounded-[var(--radius-card)] border p-6", event.status === "live" ? "border-brand bg-brand text-white" : "border-line bg-card")}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className={cn("eyebrow mb-2", event.status === "live" ? "!text-white/85" : "text-brand-deep")}>
              {event.status === "live" ? "● Event live" : `Event ${event.status}`}
            </div>
            <div className="text-sm opacity-80">Current round</div>
            <div className="text-2xl font-extrabold">{current ? current.name : "No round active"}</div>
            {current && (
              <div className="mt-1 text-sm opacity-85">
                {humanize(current.status)}
                {current.submissionDeadline && ` · submissions close ${fmtTime(current.submissionDeadline)}`}
              </div>
            )}
          </div>
          <div className="min-w-56">
            <div className="text-sm opacity-80">Next up</div>
            {next.length ? (
              next.map((n) => (
                <div key={n.id} className="mt-1">
                  <span className="font-bold">{fmtTime(n.startsAt)}</span> · {n.title}
                </div>
              ))
            ) : (
              <div className="mt-1 opacity-80">Nothing scheduled.</div>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-6 rounded-[var(--radius-card)] border border-line bg-card p-5 sm:grid-cols-4 xl:grid-cols-7">
        <Stat value={stats.teamCount} label="Teams" />
        <Stat value={`${stats.checkedIn}/${stats.participantCount}`} label="Checked in" hint={`${pct(stats.checkedIn, stats.participantCount)}% attendance`} />
        <Stat value={`${stats.submitted}/${stats.teamCount}`} label="Submissions" hint={current?.name.split("·")[0]?.trim()} tone="brand" />
        <Stat value={stats.judgeCount} label="Judges" />
        <Stat value={`${stats.evalDone}/${stats.evalTotal}`} label="Evaluations" hint={`${pct(stats.evalDone, stats.evalTotal)}% complete`} />
        <Stat value={stats.mentorCount} label="Mentors" />
        <Stat value={stats.announcementCount} label="Announcements" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Live timers"
          eyebrow="Synced for everyone"
          actions={
            <Link href={`/app/events/${eventId}/timers`} className="text-sm font-semibold text-brand-deep hover:underline">
              {has("timers.manage") ? "Control timers" : "All timers"}
            </Link>
          }
        >
          <LiveTimerStrip eventId={eventId} initial={timers} serverNow={Date.now()} emptyText="No timers yet. Create one from the Timers tab." />
        </Card>

        <Card title="Lifecycle" eyebrow={nextStep === -1 ? "Complete" : `Next: ${lifecycle[nextStep]?.[0]}`}>
          <ol className="space-y-1.5 text-sm">
            {lifecycle.map(([label, done], i) => (
              <li key={label} className={cn("flex items-center gap-2", i === nextStep ? "font-bold text-ink" : done ? "text-ink-2" : "text-muted")}>
                {done ? <Check className="h-4 w-4 text-ok" /> : <Circle className={cn("h-3.5 w-3.5", i === nextStep ? "text-brand" : "text-line")} />}
                {label}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Judge status" eyebrow={current?.name ?? "No active round"}>
          {judgeStatus.length ? (
            <ul className="space-y-3">
              {judgeStatus.map((j) => (
                <li key={j.judgeId}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-ink">{j.name}</span>
                    <span className="tabular text-muted">
                      {j.done}/{j.assigned}
                    </span>
                  </div>
                  <Progress value={j.done} max={j.assigned} className="mt-1" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No judges assigned for this round.</p>
          )}
        </Card>

        <Card title="Rooms" eyebrow="Occupancy">
          {occupancy.length ? (
            <ul className="space-y-3">
              {occupancy.map((r) => (
                <li key={r.id}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-ink">{r.name}</span>
                    <span className="tabular text-muted">
                      {r.people}/{r.capacity || "∞"} · {r.teams} teams
                    </span>
                  </div>
                  <Progress value={r.people} max={r.capacity || r.people || 1} className="mt-1" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No rooms set up.</p>
          )}
        </Card>

        <Card title="Announcements" actions={<Link href={`/app/events/${eventId}/announcements`} className="text-sm font-semibold text-brand-deep hover:underline">All</Link>}>
          {pinned.length ? (
            <ul className="space-y-3">
              {pinned.map((a) => (
                <li key={a.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    {a.pinned && <Badge tone="brand">Pinned</Badge>}
                    <StatusBadge status={a.priority} />
                    <span className="text-xs text-muted">{fmtRelative(a.createdAt)}</span>
                  </div>
                  <div className="mt-1 font-semibold text-ink">{a.title}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No announcements yet.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Recent activity" eyebrow="From the audit log">
          {activity.length ? (
            <ul className="divide-y divide-line/70">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                  <span className="text-ink-2">{a.summary}</span>
                  <span className="shrink-0 text-xs text-muted" title={fmtDateTime(a.createdAt)}>
                    {fmtRelative(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No activity yet" />
          )}
        </Card>
        <Card title="Important documents" actions={has("documents.view") ? <Link href={`/app/events/${eventId}/docs`} className="text-sm font-semibold text-brand-deep hover:underline">Docs</Link> : null}>
          {docs.length ? (
            <ul className="space-y-2.5 text-sm">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <Link href={`/app/events/${eventId}/docs/${d.id}`} className="font-semibold text-ink hover:text-brand-deep">
                    {d.title}
                  </Link>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No documents you can see.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
