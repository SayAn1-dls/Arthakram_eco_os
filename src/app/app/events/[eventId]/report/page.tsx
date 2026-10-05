import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, feedback, problemStatements, submissions } from "@/db/schema";
import { eventAccess, eventContext, eventStats, roundsFor } from "@/server/events";
import { computeResults } from "@/server/results";
import { Markdown } from "@/components/markdown";
import { PrintButton } from "@/components/print-button";
import { Badge, Card, Stat, StatusBadge } from "@/components/ui";
import { fmtDate, humanize, pct } from "@/lib/format";

export const metadata = { title: "Final report" };

export default async function ReportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, has } = await eventAccess(eventId);
  const ctx = eventContext(event);
  const rounds = roundsFor(eventId);
  const final = rounds.find((r) => r.isFinal) ?? rounds[rounds.length - 1];
  const stats = eventStats(eventId, final?.id ?? null);
  const res = has("evaluations.view") ? computeResults(eventId) : null;
  const fb = db.select().from(feedback).where(eq(feedback.eventId, eventId)).all();
  const avg = fb.length ? fb.reduce((a, f) => a + f.rating, 0) / fb.length : null;
  const ps = db.select().from(problemStatements).where(eq(problemStatements.eventId, eventId)).orderBy(asc(problemStatements.code)).all();
  const reports = has("documents.view") ? db.select().from(documents).where(and(eq(documents.eventId, eventId), eq(documents.section, "final_report"))).all() : [];
  const docCount = db.select({ id: documents.id }).from(documents).where(eq(documents.eventId, eventId)).all().length;
  const perRound = rounds.map((r) => ({ r, n: db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.roundId, r.id), eq(submissions.status, "draft"))).all().length, total: db.select({ s: submissions.status }).from(submissions).where(eq(submissions.roundId, r.id)).all().filter((s) => !["draft", "not_started"].includes(s.s)).length }));

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Generated live from the event workspace — the archive record for this event.</p>
        <div className="flex gap-2">
          {event.status === "archived" && (
            <Link href={`/archive`} className="text-sm font-semibold text-brand-deep hover:underline">
              View in archive
            </Link>
          )}
          <PrintButton />
        </div>
      </div>
      <Card>
        <div className="eyebrow text-brand-deep">Final report</div>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight">{event.title}</h2>
        <p className="mt-1 text-muted">
          {humanize(event.type)} · {ctx.club?.name ?? ctx.org?.name} · {fmtDate(event.startsAt)} – {fmtDate(event.endsAt)} · {event.venue ?? humanize(event.mode)}
        </p>
        <div className="mt-2 flex gap-2">
          <StatusBadge status={event.status} />
          {event.resultsPublished && <Badge tone="ok">Results published</Badge>}
        </div>
        <hr className="rule my-6" />
        <div className="eyebrow mb-4">By the numbers</div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          <Stat value={stats.participantCount} label="Participants" />
          <Stat value={stats.teamCount} label="Teams" />
          <Stat value={`${pct(stats.checkedIn, stats.participantCount)}%`} label="Attendance" />
          <Stat value={stats.judgeCount} label="Judges" />
          <Stat value={stats.mentorCount} label="Mentors" />
          <Stat value={avg ? avg.toFixed(1) : "—"} label={`Feedback (${fb.length})`} tone="brand" />
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Rounds">
          <ul className="space-y-2 text-sm">
            {perRound.map(({ r, total }) => (
              <li key={r.id} className="flex justify-between">
                <span className="font-semibold text-ink">{r.name}</span>
                <span className="text-muted">
                  {total} submissions · <StatusBadge status={r.status} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Problem statements">
          <ul className="space-y-2 text-sm">
            {ps.length === 0 && <li className="text-muted">None recorded.</li>}
            {ps.map((p) => (
              <li key={p.id}>
                <b>{p.code}</b> · {p.title}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {res && res.rows.length > 0 && (
        <Card title={`Results · ${res.round?.name}`} eyebrow={event.resultsPublished ? "Published" : "Not yet published"}>
          <ol className="space-y-2">
            {res.rows.slice(0, 10).map((r) => (
              <li key={r.teamId} className="flex items-center justify-between text-sm">
                <span>
                  <b className="mr-2 inline-block w-6 text-brand-deep">{r.rank}.</b>
                  {r.teamName}
                </span>
                <span className="tabular font-bold">{r.average.toFixed(1)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
      {reports.map((d) => (
        <Card key={d.id} title={d.title} eyebrow={`Final report document · ${d.status}`}>
          <Markdown>{d.content}</Markdown>
        </Card>
      ))}
      <p className="text-xs text-muted">{docCount} documents in this event’s documentation workspace are part of the archive.</p>
    </div>
  );
}
