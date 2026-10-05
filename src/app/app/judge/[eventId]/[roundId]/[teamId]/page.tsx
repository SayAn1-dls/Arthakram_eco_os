import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { evaluations, evaluationScores, eventRounds, events, files, judgeAssignments, problemStatements, submissions, teams } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { can, eventScopeOf } from "@/server/rbac";
import { rubricForRound, rubricWithCriteria } from "@/server/results";
import { saveEvaluation } from "@/server/actions/competition";
import { EvaluationForm } from "@/components/evaluation-form";
import { Badge, Card, EmptyState, Forbidden, StatusBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Evaluate" };

export default async function EvaluatePage({ params }: { params: Promise<{ eventId: string; roundId: string; teamId: string }> }) {
  const { eventId, roundId, teamId } = await params;
  const user = await requireUser();
  const event = db.select().from(events).where(eq(events.id, eventId)).get();
  if (!event) notFound();
  const assigned = db
    .select()
    .from(judgeAssignments)
    .where(and(eq(judgeAssignments.eventId, eventId), eq(judgeAssignments.roundId, roundId), eq(judgeAssignments.teamId, teamId), eq(judgeAssignments.judgeUserId, user.id)))
    .get();
  if (!assigned || !(await can(user.id, "evaluations.submit", eventScopeOf(event)))) return <Forbidden message="You can only evaluate teams you've been assigned to." />;
  const round = db.select().from(eventRounds).where(eq(eventRounds.id, roundId)).get()!;
  const team = db.select().from(teams).where(eq(teams.id, teamId)).get()!;
  const ps = team.problemStatementId ? db.select().from(problemStatements).where(eq(problemStatements.id, team.problemStatementId)).get() : null;
  const sub = db.select().from(submissions).where(and(eq(submissions.roundId, roundId), eq(submissions.teamId, teamId))).get();
  const subFiles = sub ? db.select().from(files).where(eq(files.submissionId, sub.id)).all() : [];
  const rubricRow = rubricForRound(eventId, roundId);
  const rubric = rubricRow ? rubricWithCriteria(rubricRow.id) : null;
  const ev = db.select().from(evaluations).where(and(eq(evaluations.roundId, roundId), eq(evaluations.teamId, teamId), eq(evaluations.judgeUserId, user.id))).get();
  const scores = ev ? db.select().from(evaluationScores).where(eq(evaluationScores.evaluationId, ev.id)).all() : [];
  const locked = ev?.status === "submitted" && !event.allowJudgeEditAfterSubmit && !(await can(user.id, "evaluations.edit", eventScopeOf(event)));

  const links = sub
    ? ([
        ["Repository", sub.repoUrl],
        ["Live demo", sub.demoUrl],
        ["Deck", sub.deckUrl],
        ["Video", sub.videoUrl],
        ["Docs", sub.docsUrl],
      ].filter(([, u]) => u) as [string, string][])
    : [];

  return (
    <div className="space-y-6">
      <Link href="/app/judge" className="text-sm text-muted hover:text-brand-deep">
        ← Judge dashboard
      </Link>
      <div>
        <div className="eyebrow text-brand-deep">
          {event.title} · {round.name}
        </div>
        <h1 className="mt-1 text-3xl font-bold">
          {team.name} <span className="text-lg font-semibold text-muted">{team.code}</span>
        </h1>
      </div>
      <ol className="flex flex-wrap gap-2 text-xs font-semibold text-muted">
        {["Open submission", "Review project", "Review rubric", "Give scores", "Add feedback", "Submit evaluation"].map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className="rounded-full bg-paper-2 px-2 py-0.5">
              {i + 1}. {s}
            </span>
            {i < 5 && <span>→</span>}
          </li>
        ))}
      </ol>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <Card title="Submission" actions={<StatusBadge status={sub?.status ?? "not_started"} />}>
            {!sub || sub.status === "draft" ? (
              <EmptyState title="Nothing submitted yet">You can still prepare notes, but scoring is fairer after submission.</EmptyState>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="text-lg font-bold text-ink">{sub.title}</div>
                {sub.submittedAt && <div className="text-xs text-muted">Submitted {fmtDateTime(sub.submittedAt)}</div>}
                {sub.description && <p className="whitespace-pre-line text-ink-2">{sub.description}</p>}
                <ul className="space-y-1.5">
                  {links.map(([label, url]) => (
                    <li key={label}>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-deep hover:underline">
                        {label} ↗
                      </a>
                    </li>
                  ))}
                  {subFiles.map((f) => (
                    <li key={f.id}>
                      <a href={`/api/files/${f.id}`} target="_blank" className="font-semibold text-brand-deep hover:underline">
                        📎 {f.originalName}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
          {ps && (
            <Card title="Problem statement">
              <Badge tone="brand">{ps.code}</Badge>
              <div className="mt-2 font-bold text-ink">{ps.title}</div>
              <p className="mt-1 text-sm text-muted">{ps.description}</p>
            </Card>
          )}
        </div>
        {rubric && rubric.criteria.length ? (
          <EvaluationForm
            action={saveEvaluation}
            hidden={{ eventId, roundId, teamId }}
            criteria={rubric.criteria}
            rubricName={rubric.name}
            initial={{
              scores: Object.fromEntries(scores.map((s) => [s.criterionId, s.score])),
              comments: Object.fromEntries(scores.filter((s) => s.comment).map((s) => [s.criterionId, s.comment!])),
              feedback: ev?.feedback ?? "",
              privateNotes: ev?.privateNotes ?? "",
              status: ev?.status ?? null,
            }}
            locked={locked}
          />
        ) : (
          <EmptyState title="No rubric published">The organizer hasn't published a rubric for this round yet. Judges can't create rubrics.</EmptyState>
        )}
      </div>
    </div>
  );
}
