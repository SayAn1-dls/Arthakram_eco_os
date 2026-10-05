import "server-only";
import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { evaluations, evaluationScores, eventRounds, judgeAssignments, rubricCriteria, rubrics, teams } from "@/db/schema";
import { rankTeams } from "@/lib/scoring";

/** The rubric for a round: one bound to the round, else the event-wide default. */
export function rubricForRound(eventId: string, roundId: string) {
  return (
    db.select().from(rubrics).where(and(eq(rubrics.eventId, eventId), eq(rubrics.roundId, roundId))).get() ??
    db.select().from(rubrics).where(and(eq(rubrics.eventId, eventId), isNull(rubrics.roundId))).orderBy(asc(rubrics.createdAt)).get() ??
    null
  );
}

export function rubricWithCriteria(rubricId: string) {
  const rubric = db.select().from(rubrics).where(eq(rubrics.id, rubricId)).get();
  if (!rubric) return null;
  const criteria = db.select().from(rubricCriteria).where(eq(rubricCriteria.rubricId, rubricId)).orderBy(asc(rubricCriteria.order)).all();
  return { ...rubric, criteria };
}

/**
 * Leaderboard for a round. Defaults to the final round if it has scores,
 * otherwise the latest round with any submitted evaluation.
 */
export function computeResults(eventId: string, roundId?: string) {
  const rounds = db.select().from(eventRounds).where(eq(eventRounds.eventId, eventId)).orderBy(desc(eventRounds.order)).all();
  const submittedIn = (rid: string) =>
    !!db.select({ id: evaluations.id }).from(evaluations).where(and(eq(evaluations.roundId, rid), eq(evaluations.status, "submitted"))).get();
  const round =
    (roundId ? rounds.find((r) => r.id === roundId) : undefined) ??
    rounds.find((r) => r.isFinal && submittedIn(r.id)) ??
    rounds.find((r) => submittedIn(r.id)) ??
    null;
  if (!round) return { round: null, rounds, rows: [], criteria: [], pending: 0, assigned: 0 };

  const evals = db
    .select()
    .from(evaluations)
    .where(and(eq(evaluations.roundId, round.id), eq(evaluations.status, "submitted")))
    .all();
  const scoreRows = evals.length
    ? db.select().from(evaluationScores).where(or(...evals.map((e) => eq(evaluationScores.evaluationId, e.id)))).all()
    : [];
  const ranked = rankTeams(
    evals.map((e) => ({
      teamId: e.teamId,
      totalScore: e.totalScore ?? 0,
      scores: Object.fromEntries(scoreRows.filter((s) => s.evaluationId === e.id).map((s) => [s.criterionId, s.score])),
    })),
  );
  const teamRows = db.select().from(teams).where(eq(teams.eventId, eventId)).all();
  const rubric = rubricForRound(eventId, round.id);
  const criteria = rubric ? db.select().from(rubricCriteria).where(eq(rubricCriteria.rubricId, rubric.id)).orderBy(asc(rubricCriteria.order)).all() : [];
  const assigned = db.select({ id: judgeAssignments.id }).from(judgeAssignments).where(eq(judgeAssignments.roundId, round.id)).all().length;
  return {
    round,
    rounds,
    criteria,
    assigned,
    pending: Math.max(0, assigned - evals.length),
    rows: ranked.map((r) => {
      const t = teamRows.find((x) => x.id === r.teamId);
      return { ...r, teamName: t?.name ?? "Unknown team", code: t?.code ?? "", evaluations: evals.filter((e) => e.teamId === r.teamId) };
    }),
  };
}
