import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { and, asc, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  announcements,
  auditLogs,
  clubs,
  colleges,
  evaluations,
  eventRounds,
  events,
  judgeAssignments,
  organizations,
  participants,
  roleAssignments,
  roles,
  rooms,
  scheduleItems,
  submissions,
  teams,
  timers,
  users,
} from "@/db/schema";
import { permissionSetAllows } from "@/lib/permissions";
import type { LiveTimer } from "@/components/live";
import { requireUser } from "./auth";
import { eventScopeOf, permissionsAt } from "./rbac";

export const getEvent = cache(async (eventId: string) => db.select().from(events).where(eq(events.id, eventId)).get() ?? null);

export type EventRow = NonNullable<Awaited<ReturnType<typeof getEvent>>>;

/** Load event + the current user's effective permissions on it. 404s if missing. */
export const eventAccess = cache(async (eventId: string) => {
  const user = await requireUser();
  const event = await getEvent(eventId);
  if (!event) notFound();
  const scope = eventScopeOf(event);
  const perms = await permissionsAt(user.id, scope);
  const has = (p: string) => permissionSetAllows(perms, p);
  return { user, event, scope, perms, has };
});

export function eventContext(e: EventRow) {
  const org = db.select({ name: organizations.name, slug: organizations.slug }).from(organizations).where(eq(organizations.id, e.organizationId)).get();
  const club = e.clubId ? db.select({ name: clubs.name, slug: clubs.slug }).from(clubs).where(eq(clubs.id, e.clubId)).get() : null;
  const college = e.collegeId ? db.select({ name: colleges.name }).from(colleges).where(eq(colleges.id, e.collegeId)).get() : null;
  return { org, club, college };
}

export function roundsFor(eventId: string) {
  return db.select().from(eventRounds).where(eq(eventRounds.eventId, eventId)).orderBy(asc(eventRounds.order)).all();
}

export function timersFor(eventId: string, participantView = false): LiveTimer[] {
  const rows = db
    .select()
    .from(timers)
    .where(participantView ? and(eq(timers.eventId, eventId), eq(timers.visibleToParticipants, true)) : eq(timers.eventId, eventId))
    .orderBy(asc(timers.createdAt))
    .all();
  return rows.map((t) => ({
    id: t.id,
    label: t.label,
    kind: t.kind,
    status: t.status,
    durationSec: t.durationSec,
    elapsedBeforeSec: t.elapsedBeforeSec,
    startedAt: t.startedAt ? t.startedAt.getTime() : null,
  }));
}

/** Users holding a given role key directly on this event. */
export function eventRoleHolders(eventId: string, roleKey: string) {
  return db
    .select({ id: users.id, name: users.name, email: users.email, headline: users.headline, assignmentId: roleAssignments.id })
    .from(roleAssignments)
    .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
    .innerJoin(users, eq(users.id, roleAssignments.userId))
    .where(
      and(
        eq(roleAssignments.scopeType, "event"),
        eq(roleAssignments.scopeId, eventId),
        eq(roles.key, roleKey),
        isNull(roleAssignments.revokedAt),
      ),
    )
    .orderBy(asc(users.name))
    .all();
}

export function eventStats(eventId: string, roundId: string | null) {
  const n = (q: { n: number } | undefined) => q?.n ?? 0;
  const teamCount = n(db.select({ n: count() }).from(teams).where(and(eq(teams.eventId, eventId), eq(teams.status, "active"))).get());
  const participantCount = n(
    db.select({ n: count() }).from(participants).where(and(eq(participants.eventId, eventId), sql`${participants.status} != 'withdrawn'`)).get(),
  );
  const checkedIn = n(db.select({ n: count() }).from(participants).where(and(eq(participants.eventId, eventId), isNotNull(participants.checkedInAt))).get());
  const submitted = roundId
    ? n(
        db
          .select({ n: count() })
          .from(submissions)
          .where(and(eq(submissions.roundId, roundId), sql`${submissions.status} in ('submitted','under_review','reviewed','final')`))
          .get(),
      )
    : 0;
  const evalDone = roundId
    ? n(db.select({ n: count() }).from(evaluations).where(and(eq(evaluations.roundId, roundId), eq(evaluations.status, "submitted"))).get())
    : 0;
  const evalTotal = roundId ? n(db.select({ n: count() }).from(judgeAssignments).where(eq(judgeAssignments.roundId, roundId)).get()) : 0;
  const judgeCount = eventRoleHolders(eventId, "judge").length;
  const mentorCount = n(
    db.select({ n: sql<number>`count(distinct ${teams.mentorUserId})` }).from(teams).where(and(eq(teams.eventId, eventId), isNotNull(teams.mentorUserId))).get(),
  );
  const announcementCount = n(db.select({ n: count() }).from(announcements).where(eq(announcements.eventId, eventId)).get());
  return { teamCount, participantCount, checkedIn, submitted, evalDone, evalTotal, judgeCount, mentorCount, announcementCount };
}

export function roomOccupancy(eventId: string) {
  return db
    .select({
      id: rooms.id,
      name: rooms.name,
      capacity: rooms.capacity,
      // Correlated subqueries: reference the outer row explicitly (drizzle leaves single-table columns unqualified).
      teams: sql<number>`(select count(*) from teams t where t.room_id = "rooms"."id")`,
      people: sql<number>`(select count(*) from participants p join teams t on t.id = p.team_id where t.room_id = "rooms"."id")`,
    })
    .from(rooms)
    .where(eq(rooms.eventId, eventId))
    .orderBy(asc(rooms.name))
    .all();
}

export function recentActivity(eventId: string, limit = 8) {
  return db
    .select({ id: auditLogs.id, summary: auditLogs.summary, createdAt: auditLogs.createdAt, action: auditLogs.action })
    .from(auditLogs)
    .where(eq(auditLogs.eventId, eventId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .all();
}

export function nextScheduleItem(eventId: string) {
  return db
    .select()
    .from(scheduleItems)
    .where(and(eq(scheduleItems.eventId, eventId), sql`${scheduleItems.startsAt} >= ${Date.now()}`))
    .orderBy(asc(scheduleItems.startsAt))
    .limit(2)
    .all();
}

export function myParticipation(eventId: string, userId: string) {
  return db.select().from(participants).where(and(eq(participants.eventId, eventId), eq(participants.userId, userId))).get() ?? null;
}

export const EVENT_TABS: { href: string; label: string; perm: string }[] = [
  { href: "", label: "Control Room", perm: "events.view" },
  { href: "/setup", label: "Setup", perm: "events.edit" },
  { href: "/schedule", label: "Rounds & Schedule", perm: "events.view" },
  { href: "/participants", label: "Participants", perm: "participants.view" },
  { href: "/teams", label: "Teams", perm: "teams.view" },
  { href: "/checkin", label: "Check-in", perm: "attendance.manage" },
  { href: "/rooms", label: "Rooms", perm: "rooms.manage" },
  { href: "/timers", label: "Timers", perm: "events.view" },
  { href: "/qr", label: "QR Codes", perm: "qr.manage" },
  { href: "/announcements", label: "Announcements", perm: "events.view" },
  { href: "/docs", label: "Documents", perm: "documents.view" },
  { href: "/rubrics", label: "Rubrics", perm: "rubrics.view" },
  { href: "/judges", label: "Judges", perm: "judges.manage" },
  { href: "/mentors", label: "Mentors", perm: "mentors.create" },
  { href: "/submissions", label: "Submissions", perm: "submissions.view" },
  { href: "/results", label: "Results", perm: "evaluations.view" },
  { href: "/feedback", label: "Feedback", perm: "feedback.view" },
  { href: "/report", label: "Final Report", perm: "events.view" },
  { href: "/access", label: "Access", perm: "access.grant" },
  { href: "/audit", label: "Audit Log", perm: "audit.view" },
];
