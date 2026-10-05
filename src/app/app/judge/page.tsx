import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { announcements, evaluations, eventRounds, events, judgeAssignments, submissions, teams } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { timersFor } from "@/server/events";
import { AutoRefresh, LiveTimerStrip } from "@/components/live";
import { Badge, Card, EmptyState, PageHeader, Progress, Stat, StatRow, StatusBadge, Table, Td, Th } from "@/components/ui";
import { fmtRelative } from "@/lib/format";

export const metadata = { title: "Judge dashboard" };

export default async function JudgeDashboard() {
  const user = await requireUser();
  const assigns = db
    .select({ a: judgeAssignments, team: teams, round: eventRounds, event: events })
    .from(judgeAssignments)
    .innerJoin(teams, eq(teams.id, judgeAssignments.teamId))
    .innerJoin(eventRounds, eq(eventRounds.id, judgeAssignments.roundId))
    .innerJoin(events, eq(events.id, judgeAssignments.eventId))
    .where(eq(judgeAssignments.judgeUserId, user.id))
    .all();
  const evals = db.select().from(evaluations).where(eq(evaluations.judgeUserId, user.id)).all();
  const evalOf = (r: string, t: string) => evals.find((e) => e.roundId === r && e.teamId === t);
  const subs = assigns.length ? db.select().from(submissions).where(inArray(submissions.teamId, [...new Set(assigns.map((a) => a.team.id))])).all() : [];
  const subOf = (r: string, t: string) => subs.find((s) => s.roundId === r && s.teamId === t);

  const byEvent = new Map<string, typeof assigns>();
  for (const a of assigns) byEvent.set(a.event.id, [...(byEvent.get(a.event.id) ?? []), a]);
  const done = assigns.filter((a) => evalOf(a.round.id, a.team.id)?.status === "submitted").length;
  const active = [...byEvent.values()].map((v) => v[0]!.event).filter((e) => e.status === "live");

  return (
    <>
      <AutoRefresh intervalMs={20000} />
      <PageHeader eyebrow="Review" title="Judge dashboard" description="Only the teams you've been assigned. Score with the published rubric — weighted totals are computed for you." />
      <StatRow className="mb-8 lg:grid-cols-4">
        <Stat value={byEvent.size} label="Events" />
        <Stat value={assigns.length} label="Assigned evaluations" />
        <Stat value={assigns.length - done} label="Pending" tone="brand" />
        <Stat value={done} label="Completed" />
      </StatRow>
      {assigns.length === 0 && <EmptyState title="No assignments yet">When an organizer assigns you teams, they appear here.</EmptyState>}
      <div className="space-y-8">
        {[...byEvent.entries()].map(([eventId, rows]) => {
          const ev = rows[0]!.event;
          const notes = db.select().from(announcements).where(and(eq(announcements.eventId, eventId), inArray(announcements.audience, ["judges", "everyone"]))).all().slice(-2);
          const rounds = [...new Map(rows.map((r) => [r.round.id, r.round])).values()].sort((a, b) => b.order - a.order);
          return (
            <section key={eventId} className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-extrabold">{ev.title}</h2>
                <StatusBadge status={ev.status} />
              </div>
              {active.some((a) => a.id === eventId) && (
                <Card title="Event timers">
                  <LiveTimerStrip eventId={eventId} initial={timersFor(eventId, true)} serverNow={Date.now()} size="sm" />
                </Card>
              )}
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-brand/30 bg-brand-wash px-4 py-2 text-sm">
                  <b>{n.title}</b> — {n.body} <span className="text-xs text-muted">({fmtRelative(n.createdAt)})</span>
                </div>
              ))}
              {rounds.map((round) => {
                const list = rows.filter((r) => r.round.id === round.id).sort((a, b) => a.team.code.localeCompare(b.team.code));
                const d = list.filter((r) => evalOf(round.id, r.team.id)?.status === "submitted").length;
                return (
                  <Card key={round.id} title={round.name} eyebrow={`${d}/${list.length} scored`} actions={<StatusBadge status={round.status} />} padded={false}>
                    <Progress value={d} max={list.length} className="rounded-none" />
                    <Table className="rounded-none border-0">
                      <thead>
                        <tr>
                          <Th>Team</Th>
                          <Th>Submission</Th>
                          <Th>Your evaluation</Th>
                          <Th />
                        </tr>
                      </thead>
                      <tbody>
                        {list.map(({ team }) => {
                          const e = evalOf(round.id, team.id);
                          const s = subOf(round.id, team.id);
                          const ready = s && !["draft", "not_started"].includes(s.status);
                          return (
                            <tr key={team.id}>
                              <Td>
                                <div className="font-semibold text-ink">{team.name}</div>
                                <div className="text-xs text-muted">{team.code}</div>
                              </Td>
                              <Td>{ready ? <StatusBadge status={s.status} /> : <Badge>Not submitted</Badge>}</Td>
                              <Td>{e ? <span>{e.status === "submitted" ? <b className="tabular">{e.totalScore?.toFixed(1)}</b> : <Badge tone="warn">Draft</Badge>}</span> : <span className="text-muted">Pending</span>}</Td>
                              <Td className="text-right">
                                <Link
                                  href={`/app/judge/${eventId}/${round.id}/${team.id}`}
                                  className={`inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-semibold ${e?.status === "submitted" ? "border border-line text-ink-2" : "bg-brand text-white"}`}
                                >
                                  {e?.status === "submitted" ? "View" : e ? "Continue" : "Evaluate"}
                                </Link>
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </Card>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}
