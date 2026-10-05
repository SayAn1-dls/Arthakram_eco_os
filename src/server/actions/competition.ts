"use server";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  awards,
  evaluations,
  evaluationScores,
  eventRounds,
  events,
  feedback,
  judgeAssignments,
  participants,
  roleAssignments,
  roles,
  rubricCriteria,
  rubrics,
  submissions,
  teams,
  timers,
  users,
} from "@/db/schema";
import { validateScores, weightedScore } from "@/lib/scoring";
import { newId } from "@/lib/utils";
import { act, UserError } from "../action";
import { audit } from "../audit";
import { requireUser } from "../auth";
import { storeUpload } from "../files";
import { notify } from "../notify";
import { can, eventScope, requireEventPermission } from "../rbac";
import { computeResults, rubricForRound } from "../results";

const rev = (eventId: string) => {
  revalidatePath(`/app/events/${eventId}`, "layout");
  revalidatePath("/app/judge", "layout");
};

/* ───────── Rubrics (admin / authorised organizer only) ───────── */

function hasSubmittedEvals(rubricId: string) {
  return !!db.select({ id: evaluations.id }).from(evaluations).where(and(eq(evaluations.rubricId, rubricId), eq(evaluations.status, "submitted"))).get();
}

function recomputeTotals(rubricId: string) {
  const crit = db.select().from(rubricCriteria).where(eq(rubricCriteria.rubricId, rubricId)).all();
  for (const ev of db.select().from(evaluations).where(eq(evaluations.rubricId, rubricId)).all()) {
    const scores = Object.fromEntries(
      db.select().from(evaluationScores).where(eq(evaluationScores.evaluationId, ev.id)).all().map((s) => [s.criterionId, s.score]),
    );
    db.update(evaluations).set({ totalScore: weightedScore(crit, scores) }).where(eq(evaluations.id, ev.id)).run();
  }
}

export const saveRubric = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("rubrics.manage", eventId);
  const data = z
    .object({
      name: z.string().trim().min(2).max(80),
      description: z.string().optional().transform((v) => v?.trim() || null),
      roundId: z.string().optional().transform((v) => v || null),
    })
    .parse(Object.fromEntries(fd));
  if (data.roundId && !db.select().from(eventRounds).where(and(eq(eventRounds.id, data.roundId), eq(eventRounds.eventId, eventId))).get())
    throw new UserError("Round not found.");
  const rubricId = String(fd.get("rubricId") ?? "");
  if (rubricId) db.update(rubrics).set(data).where(and(eq(rubrics.id, rubricId), eq(rubrics.eventId, eventId))).run();
  else db.insert(rubrics).values({ id: newId("rb_"), eventId, createdById: user.id, ...data }).run();
  audit({ actorId: user.id, action: rubricId ? "rubric.update" : "rubric.create", resourceType: "rubric", eventId, summary: `${user.name} ${rubricId ? "edited" : "created"} rubric ${data.name}` });
  rev(eventId);
  return { ok: true, message: "Rubric saved." };
});

export const deleteRubric = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("rubrics.manage", eventId);
  const r = db.select().from(rubrics).where(and(eq(rubrics.id, String(fd.get("rubricId"))), eq(rubrics.eventId, eventId))).get();
  if (!r) throw new UserError("Rubric not found.");
  if (db.select({ id: evaluations.id }).from(evaluations).where(eq(evaluations.rubricId, r.id)).get())
    throw new UserError("Judges have already used this rubric. It can't be deleted.");
  db.delete(rubrics).where(eq(rubrics.id, r.id)).run();
  audit({ actorId: user.id, action: "rubric.delete", resourceType: "rubric", eventId, summary: `${user.name} deleted rubric ${r.name}` });
  rev(eventId);
});

export const saveCriterion = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("rubrics.manage", eventId);
  const rubric = db.select().from(rubrics).where(and(eq(rubrics.id, String(fd.get("rubricId"))), eq(rubrics.eventId, eventId))).get();
  if (!rubric) throw new UserError("Rubric not found.");
  const data = z
    .object({
      name: z.string().trim().min(2).max(80),
      description: z.string().optional().transform((v) => v?.trim() || null),
      instructions: z.string().optional().transform((v) => v?.trim() || null),
      weight: z.coerce.number().min(0).max(100),
      minScore: z.coerce.number().int().min(0).max(100),
      maxScore: z.coerce.number().int().min(1).max(100),
      order: z.coerce.number().int().min(0).max(99).default(0),
    })
    .parse(Object.fromEntries(fd));
  if (data.maxScore <= data.minScore) throw new UserError("Maximum score must be greater than minimum.");
  const criterionId = String(fd.get("criterionId") ?? "");
  const locked = hasSubmittedEvals(rubric.id);
  if (criterionId) {
    const before = db.select().from(rubricCriteria).where(and(eq(rubricCriteria.id, criterionId), eq(rubricCriteria.rubricId, rubric.id))).get();
    if (!before) throw new UserError("Criterion not found.");
    if (locked && (before.minScore !== data.minScore || before.maxScore !== data.maxScore))
      throw new UserError("Scores already submitted: score ranges are locked. You can still change names, guidance and weights.");
    db.update(rubricCriteria).set(data).where(eq(rubricCriteria.id, criterionId)).run();
    if (before.weight !== data.weight) recomputeTotals(rubric.id);
    audit({ actorId: user.id, action: "rubric.criterion_update", resourceType: "rubric", resourceId: rubric.id, eventId, summary: `${user.name} edited criterion “${data.name}” in ${rubric.name}`, before: { weight: before.weight, min: before.minScore, max: before.maxScore }, after: { weight: data.weight, min: data.minScore, max: data.maxScore } });
  } else {
    if (locked) throw new UserError("Scores already submitted: criteria can't be added to this rubric.");
    db.insert(rubricCriteria).values({ id: newId("cr_"), rubricId: rubric.id, ...data }).run();
    audit({ actorId: user.id, action: "rubric.criterion_add", resourceType: "rubric", resourceId: rubric.id, eventId, summary: `${user.name} added criterion “${data.name}” (${data.weight}%) to ${rubric.name}` });
  }
  rev(eventId);
  return { ok: true, message: "Criterion saved." };
});

export const deleteCriterion = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("rubrics.manage", eventId);
  const c = db
    .select({ id: rubricCriteria.id, name: rubricCriteria.name, rubricId: rubricCriteria.rubricId })
    .from(rubricCriteria)
    .innerJoin(rubrics, eq(rubrics.id, rubricCriteria.rubricId))
    .where(and(eq(rubricCriteria.id, String(fd.get("criterionId"))), eq(rubrics.eventId, eventId)))
    .get();
  if (!c) throw new UserError("Criterion not found.");
  if (hasSubmittedEvals(c.rubricId)) throw new UserError("Scores already submitted: criteria can't be removed.");
  db.delete(rubricCriteria).where(eq(rubricCriteria.id, c.id)).run();
  audit({ actorId: user.id, action: "rubric.criterion_delete", resourceType: "rubric", resourceId: c.rubricId, eventId, summary: `${user.name} removed criterion “${c.name}”` });
  rev(eventId);
});

/* ───────── Judges ───────── */

export const inviteJudge = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("judges.manage", eventId);
  const email = z.string().trim().toLowerCase().email().parse(fd.get("email"));
  const u = db.select().from(users).where(eq(users.email, email)).get();
  if (!u) throw new UserError("No Arthakram account with that email. Ask them to sign up, then invite again.");
  const judgeRole = db.select().from(roles).where(eq(roles.key, "judge")).get()!;
  const existing = db
    .select()
    .from(roleAssignments)
    .where(and(eq(roleAssignments.userId, u.id), eq(roleAssignments.roleId, judgeRole.id), eq(roleAssignments.scopeType, "event"), eq(roleAssignments.scopeId, eventId), isNull(roleAssignments.revokedAt)))
    .get();
  if (existing) throw new UserError(`${u.name} is already a judge for this event.`);
  // judges.manage is a narrow delegation: it may grant exactly the Judge role, on this event only.
  db.insert(roleAssignments).values({ id: newId("ra_"), userId: u.id, roleId: judgeRole.id, scopeType: "event", scopeId: eventId, grantedById: user.id, note: "Invited as judge" }).run();
  const e = db.select({ title: events.title }).from(events).where(eq(events.id, eventId)).get()!;
  notify([u.id], { kind: "judge", title: `You're a judge for ${e.title}`, body: "Your assigned submissions will appear on your judge dashboard.", link: "/app/judge" });
  audit({ actorId: user.id, action: "access.grant", resourceType: "role_assignment", eventId, summary: `${user.name} granted Judge access on ${e.title} to ${u.name}` });
  rev(eventId);
  return { ok: true, message: `${u.name} is now a judge.` };
});

export const removeJudge = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("judges.manage", eventId);
  const judgeId = String(fd.get("userId"));
  const judgeRole = db.select().from(roles).where(eq(roles.key, "judge")).get()!;
  db.update(roleAssignments)
    .set({ revokedAt: new Date(), revokedById: user.id })
    .where(and(eq(roleAssignments.userId, judgeId), eq(roleAssignments.roleId, judgeRole.id), eq(roleAssignments.scopeType, "event"), eq(roleAssignments.scopeId, eventId), isNull(roleAssignments.revokedAt)))
    .run();
  // Unstarted assignments are dropped; anything already scored stays for the record.
  const scored = new Set(
    db.select({ k: evaluations.teamId, r: evaluations.roundId }).from(evaluations).where(and(eq(evaluations.eventId, eventId), eq(evaluations.judgeUserId, judgeId))).all().map((x) => `${x.r}:${x.k}`),
  );
  for (const a of db.select().from(judgeAssignments).where(and(eq(judgeAssignments.eventId, eventId), eq(judgeAssignments.judgeUserId, judgeId))).all())
    if (!scored.has(`${a.roundId}:${a.teamId}`)) db.delete(judgeAssignments).where(eq(judgeAssignments.id, a.id)).run();
  const name = db.select({ name: users.name }).from(users).where(eq(users.id, judgeId)).get()?.name ?? "a judge";
  audit({ actorId: user.id, action: "access.revoke", resourceType: "role_assignment", eventId, summary: `${user.name} revoked Judge access from ${name}` });
  rev(eventId);
});

export const autoAssignJudges = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("judges.manage", eventId);
  const roundId = String(fd.get("roundId"));
  const perTeam = z.coerce.number().int().min(1).max(10).parse(fd.get("perTeam"));
  const round = db.select().from(eventRounds).where(and(eq(eventRounds.id, roundId), eq(eventRounds.eventId, eventId))).get();
  if (!round) throw new UserError("Choose a round.");
  const judgeIds = db
    .select({ id: roleAssignments.userId })
    .from(roleAssignments)
    .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
    .where(and(eq(roles.key, "judge"), eq(roleAssignments.scopeType, "event"), eq(roleAssignments.scopeId, eventId), isNull(roleAssignments.revokedAt)))
    .orderBy(asc(roleAssignments.createdAt))
    .all()
    .map((r) => r.id);
  if (judgeIds.length < perTeam) throw new UserError(`You need at least ${perTeam} judges on this event (have ${judgeIds.length}).`);
  const teamIds = db.select({ id: teams.id }).from(teams).where(and(eq(teams.eventId, eventId), eq(teams.status, "active"))).orderBy(asc(teams.code)).all().map((t) => t.id);
  const existing = db.select().from(judgeAssignments).where(eq(judgeAssignments.roundId, roundId)).all();
  const load = new Map(judgeIds.map((j) => [j, existing.filter((a) => a.judgeUserId === j).length]));
  let created = 0;
  for (const t of teamIds) {
    const have = new Set(existing.filter((a) => a.teamId === t).map((a) => a.judgeUserId));
    while (have.size < perTeam) {
      // least-loaded judge not yet on this team → balanced workload
      const next = [...load.entries()].filter(([j]) => !have.has(j)).sort((a, b) => a[1] - b[1])[0];
      if (!next) break;
      db.insert(judgeAssignments).values({ id: newId("ja_"), eventId, roundId, teamId: t, judgeUserId: next[0] }).run();
      have.add(next[0]);
      load.set(next[0], next[1] + 1);
      created++;
    }
  }
  if (created) notify(judgeIds, { kind: "judge", title: `New judging assignments for ${round.name}`, link: "/app/judge" });
  audit({ actorId: user.id, action: "judges.assign", resourceType: "round", resourceId: roundId, eventId, summary: `${user.name} auto-assigned ${created} judge slot(s) for ${round.name} (${perTeam} per team)` });
  rev(eventId);
  return { ok: true, message: created ? `Created ${created} assignments.` : "Every team already has enough judges." };
});

export const toggleAssignment = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("judges.manage", eventId);
  const roundId = String(fd.get("roundId"));
  const teamId = String(fd.get("teamId"));
  const judgeId = String(fd.get("judgeId"));
  const existing = db.select().from(judgeAssignments).where(and(eq(judgeAssignments.roundId, roundId), eq(judgeAssignments.teamId, teamId), eq(judgeAssignments.judgeUserId, judgeId))).get();
  if (existing) {
    if (db.select({ id: evaluations.id }).from(evaluations).where(and(eq(evaluations.roundId, roundId), eq(evaluations.teamId, teamId), eq(evaluations.judgeUserId, judgeId))).get())
      throw new UserError("This judge has already started scoring that team.");
    db.delete(judgeAssignments).where(eq(judgeAssignments.id, existing.id)).run();
  } else {
    const scope = await eventScope(eventId);
    if (!scope || !(await can(judgeId, "evaluations.submit", scope))) throw new UserError("That person isn't a judge on this event.");
    db.insert(judgeAssignments).values({ id: newId("ja_"), eventId, roundId, teamId, judgeUserId: judgeId }).run();
  }
  audit({ actorId: user.id, action: existing ? "judges.unassign" : "judges.assign", resourceType: "judge_assignment", eventId, summary: `${user.name} ${existing ? "unassigned" : "assigned"} a judge ${existing ? "from" : "to"} a team` });
  rev(eventId);
});

/* ───────── Evaluations (judges) ───────── */

export const saveEvaluation = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const roundId = String(fd.get("roundId"));
  const teamId = String(fd.get("teamId"));
  const op = z.enum(["draft", "submit"]).parse(fd.get("op"));
  const { user, scope } = await requireEventPermission("evaluations.submit", eventId);
  const assigned = db
    .select()
    .from(judgeAssignments)
    .where(and(eq(judgeAssignments.roundId, roundId), eq(judgeAssignments.teamId, teamId), eq(judgeAssignments.judgeUserId, user.id), eq(judgeAssignments.eventId, eventId)))
    .get();
  if (!assigned) throw new UserError("You're not assigned to evaluate this team in this round.");
  const event = db.select().from(events).where(eq(events.id, eventId)).get()!;
  const rubric = rubricForRound(eventId, roundId);
  if (!rubric) throw new UserError("The organizer hasn't published a rubric for this round yet.");
  const crit = db.select().from(rubricCriteria).where(eq(rubricCriteria.rubricId, rubric.id)).orderBy(asc(rubricCriteria.order)).all();
  if (!crit.length) throw new UserError("The rubric has no criteria yet.");
  const existing = db.select().from(evaluations).where(and(eq(evaluations.roundId, roundId), eq(evaluations.teamId, teamId), eq(evaluations.judgeUserId, user.id))).get();
  if (existing?.status === "submitted" && !event.allowJudgeEditAfterSubmit && !(await can(user.id, "evaluations.edit", scope)))
    throw new UserError("This evaluation is locked. Ask the organizer to reopen it if you need to change it.");

  const scores: Record<string, number> = {};
  const comments: Record<string, string> = {};
  for (const c of crit) {
    const raw = fd.get(`score_${c.id}`);
    if (raw !== null && raw !== "") scores[c.id] = Number(raw);
    const cm = String(fd.get(`comment_${c.id}`) ?? "").trim();
    if (cm) comments[c.id] = cm.slice(0, 1000);
  }
  if (op === "submit") {
    const err = validateScores(crit, scores);
    if (err) throw new UserError(err);
  } else {
    for (const c of crit) if (scores[c.id] != null && (scores[c.id]! < c.minScore || scores[c.id]! > c.maxScore)) throw new UserError(`“${c.name}” must be between ${c.minScore} and ${c.maxScore}.`);
  }
  const total = weightedScore(crit, scores);
  const fb = String(fd.get("feedback") ?? "").trim().slice(0, 4000) || null;
  const notes = String(fd.get("privateNotes") ?? "").trim().slice(0, 4000) || null;
  const id = existing?.id ?? newId("evl_");
  const now = new Date();
  db.transaction((tx) => {
    if (existing)
      tx.update(evaluations)
        .set({ status: op === "submit" ? "submitted" : existing.status === "submitted" ? "submitted" : "draft", totalScore: total, feedback: fb, privateNotes: notes, rubricId: rubric.id, updatedAt: now, submittedAt: op === "submit" ? now : existing.submittedAt })
        .where(eq(evaluations.id, id))
        .run();
    else
      tx.insert(evaluations)
        .values({ id, eventId, roundId, teamId, judgeUserId: user.id, rubricId: rubric.id, status: op === "submit" ? "submitted" : "draft", totalScore: total, feedback: fb, privateNotes: notes, updatedAt: now, submittedAt: op === "submit" ? now : null })
        .run();
    tx.delete(evaluationScores).where(eq(evaluationScores.evaluationId, id)).run();
    const rows = Object.entries(scores).map(([criterionId, score]) => ({ evaluationId: id, criterionId, score, comment: comments[criterionId] ?? null }));
    if (rows.length) tx.insert(evaluationScores).values(rows).run();
    if (op === "submit")
      tx.update(submissions).set({ status: "under_review" }).where(and(eq(submissions.roundId, roundId), eq(submissions.teamId, teamId), eq(submissions.status, "submitted"))).run();
  });
  if (op === "submit") {
    const team = db.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId)).get();
    const round = db.select({ name: eventRounds.name }).from(eventRounds).where(eq(eventRounds.id, roundId)).get();
    audit({ actorId: user.id, action: "evaluation.submit", resourceType: "evaluation", resourceId: id, eventId, summary: `${user.name} submitted evaluation for ${team?.name} (${round?.name})`, after: { totalScore: total } });
  }
  rev(eventId);
  return { ok: true, message: op === "submit" ? `Submitted · weighted score ${total.toFixed(1)}/100` : "Draft saved." };
});

export const reopenEvaluation = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("evaluations.edit", eventId);
  const ev = db.select().from(evaluations).where(and(eq(evaluations.id, String(fd.get("evaluationId"))), eq(evaluations.eventId, eventId))).get();
  if (!ev) throw new UserError("Evaluation not found.");
  db.update(evaluations).set({ status: "draft" }).where(eq(evaluations.id, ev.id)).run();
  notify([ev.judgeUserId], { kind: "judge", title: "An evaluation was reopened for edits", link: `/app/judge/${eventId}/${ev.roundId}/${ev.teamId}` });
  audit({ actorId: user.id, action: "evaluation.reopen", resourceType: "evaluation", resourceId: ev.id, eventId, summary: `${user.name} reopened an evaluation for editing` });
  rev(eventId);
});

/* ───────── Submissions (teams) ───────── */

function submissionWindow(roundId: string): { open: false; reason: string } | { open: true; round: typeof eventRounds.$inferSelect } {
  const round = db.select().from(eventRounds).where(eq(eventRounds.id, roundId)).get();
  if (!round) return { open: false, reason: "Round not found." };
  if (round.status !== "active") return { open: false, reason: `${round.name} is not accepting submissions (${round.status}).` };
  if (round.submissionDeadline && round.submissionDeadline.getTime() < Date.now()) return { open: false, reason: "The submission deadline has passed." };
  const closed = db
    .select()
    .from(timers)
    .where(and(eq(timers.roundId, roundId), inArray(timers.kind, ["round", "submission"]), eq(timers.status, "ended")))
    .get();
  if (closed) return { open: false, reason: `The ${closed.label} timer has ended.` };
  return { open: true, round };
}

export const saveSubmission = act(async (fd) => {
  const user = await requireUser();
  const teamId = String(fd.get("teamId"));
  const roundId = String(fd.get("roundId"));
  const op = z.enum(["draft", "submit"]).parse(fd.get("op"));
  const me = db.select().from(participants).where(and(eq(participants.teamId, teamId), eq(participants.userId, user.id), eq(participants.status, "confirmed"))).get();
  if (!me) throw new UserError("Only confirmed members of this team can submit.");
  const team = db.select().from(teams).where(eq(teams.id, teamId)).get()!;
  if (team.status !== "active") throw new UserError("This team is not active.");
  const win = submissionWindow(roundId);
  if (!win.open) throw new UserError(win.reason);
  if (win.round.eventId !== team.eventId) throw new UserError("Round and team don't match.");
  const url = z.string().trim().url().or(z.literal("")).optional().transform((v) => v || null);
  const data = z
    .object({ title: z.string().trim().min(2).max(140), description: z.string().max(5000).optional().transform((v) => v?.trim() || null), repoUrl: url, demoUrl: url, deckUrl: url, videoUrl: url, docsUrl: url })
    .parse(Object.fromEntries(fd));
  if (op === "submit" && !data.repoUrl && !data.demoUrl && !data.deckUrl && !data.videoUrl && !data.docsUrl && !(fd.get("file") as File | null)?.size)
    throw new UserError("Add at least one link or file before submitting.");
  const existing = db.select().from(submissions).where(and(eq(submissions.roundId, roundId), eq(submissions.teamId, teamId))).get();
  if (existing && ["under_review", "reviewed", "final"].includes(existing.status)) throw new UserError("This submission is already being reviewed and can't be changed.");
  const id = existing?.id ?? newId("sb_");
  const patch = { ...data, status: op === "submit" ? ("submitted" as const) : ("draft" as const), updatedAt: new Date(), ...(op === "submit" ? { submittedAt: new Date(), submittedById: user.id } : {}) };
  if (existing) db.update(submissions).set(patch).where(eq(submissions.id, id)).run();
  else db.insert(submissions).values({ id, eventId: team.eventId, roundId, teamId, ...patch }).run();
  const file = fd.get("file") as File | null;
  if (file && file.size) await storeUpload(file, { eventId: team.eventId, submissionId: id, uploadedById: user.id });
  audit({ actorId: user.id, action: `submission.${op}`, resourceType: "submission", resourceId: id, eventId: team.eventId, summary: `${user.name} ${op === "submit" ? "submitted" : "saved a draft for"} ${team.name} — ${win.round.name}` });
  revalidatePath(`/app/team/${teamId}`);
  rev(team.eventId);
  return { ok: true, message: op === "submit" ? "Submitted! Judges will see it once judging opens." : "Draft saved." };
});

export const setSubmissionStatus = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("submissions.manage", eventId);
  const status = z.enum(["draft", "submitted", "under_review", "reviewed", "final"]).parse(fd.get("status"));
  const list = String(fd.get("ids") ?? "").split(",").filter(Boolean);
  db.update(submissions).set({ status, updatedAt: new Date() }).where(and(eq(submissions.eventId, eventId), inArray(submissions.id, list))).run();
  audit({ actorId: user.id, action: "submission.status", resourceType: "submission", eventId, summary: `${user.name} set ${list.length} submission(s) to ${status}` });
  rev(eventId);
});

/* ───────── Results ───────── */

export const verifyResults = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("results.edit", eventId);
  const res = computeResults(eventId);
  if (!res.rows.length) throw new UserError("No submitted evaluations to verify yet.");
  if (res.pending > 0) throw new UserError(`${res.pending} evaluation(s) in ${res.round?.name} are still pending.`);
  db.update(events).set({ resultsVerifiedAt: new Date() }).where(eq(events.id, eventId)).run();
  audit({ actorId: user.id, action: "results.verify", resourceType: "event", resourceId: eventId, eventId, summary: `${user.name} verified results for ${res.round?.name}`, after: res.rows.slice(0, 5).map((r) => ({ team: r.teamName, rank: r.rank, avg: r.average })) });
  rev(eventId);
  return { ok: true, message: "Results verified. An admin or club lead can now publish them." };
});

export const publishResults = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("results.publish", eventId);
  const publish = fd.get("publish") === "1";
  const e = db.select().from(events).where(eq(events.id, eventId)).get()!;
  if (publish) {
    if (!e.resultsVerifiedAt) throw new UserError("Results must be verified before publishing.");
    const res = computeResults(eventId);
    if (res.pending > 0) throw new UserError(`${res.pending} evaluation(s) in ${res.round?.name} are still pending. Finish judging before publishing.`);
    const titles = ["Winner", "1st Runner-up", "2nd Runner-up"];
    db.transaction((tx) => {
      tx.delete(awards).where(eq(awards.eventId, eventId)).run();
      for (const r of res.rows.filter((x) => x.rank <= 3)) {
        const members = tx.select({ userId: participants.userId }).from(participants).where(eq(participants.teamId, r.teamId)).all();
        for (const m of members)
          tx.insert(awards).values({ id: newId("aw_"), userId: m.userId, eventId, teamId: r.teamId, title: `${titles[r.rank - 1]} · ${e.title}`, rank: r.rank }).run();
      }
      tx.update(events).set({ resultsPublished: true }).where(eq(events.id, eventId)).run();
    });
    const everyone = db.select({ id: participants.userId }).from(participants).where(eq(participants.eventId, eventId)).all().map((x) => x.id);
    notify(everyone, { kind: "results", title: `Results are out: ${e.title}`, link: `/events/${e.slug}` });
  } else {
    db.update(events).set({ resultsPublished: false }).where(eq(events.id, eventId)).run();
    db.delete(awards).where(eq(awards.eventId, eventId)).run();
  }
  audit({ actorId: user.id, action: publish ? "results.publish" : "results.unpublish", resourceType: "event", resourceId: eventId, eventId, summary: `${user.name} ${publish ? "published" : "unpublished"} results for ${e.title}` });
  rev(eventId);
  revalidatePath(`/events/${e.slug}`);
  return { ok: true, message: publish ? "Results are public." : "Results hidden." };
});

/* ───────── Feedback ───────── */

export const submitFeedback = act(async (fd) => {
  const user = await requireUser();
  const eventId = String(fd.get("eventId"));
  const e = db.select().from(events).where(eq(events.id, eventId)).get();
  if (!e) throw new UserError("Event not found.");
  const data = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().max(2000).optional().transform((v) => v?.trim() || null) }).parse(Object.fromEntries(fd));
  const isParticipant = db.select({ id: participants.id }).from(participants).where(and(eq(participants.eventId, eventId), eq(participants.userId, user.id))).get();
  const isJudge = db.select({ id: judgeAssignments.id }).from(judgeAssignments).where(and(eq(judgeAssignments.eventId, eventId), eq(judgeAssignments.judgeUserId, user.id))).get();
  const isMentor = db.select({ id: teams.id }).from(teams).where(and(eq(teams.eventId, eventId), eq(teams.mentorUserId, user.id))).get();
  const role = isParticipant ? "participant" : isJudge ? "judge" : isMentor ? "mentor" : "guest";
  const prev = db.select().from(feedback).where(and(eq(feedback.eventId, eventId), eq(feedback.userId, user.id))).get();
  if (prev) db.update(feedback).set({ ...data, role, createdAt: new Date() }).where(eq(feedback.id, prev.id)).run();
  else db.insert(feedback).values({ id: newId("fb_"), eventId, userId: user.id, role, ...data }).run();
  return { ok: true, message: "Thanks — your feedback goes straight to the organizers." };
});
