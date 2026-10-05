import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { evaluations, eventRounds, participants, problemStatements, rooms, submissions, teams, users } from "@/db/schema";
import { eventAccess } from "@/server/events";
import { mentorsForEvent } from "@/server/mentors";
import { bulkAssignTeam, deleteTeam, removeFromTeam, saveTeam } from "@/server/actions/operations";
import { ActionButton, ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Card, Forbidden, StatusBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export default async function TeamDetail({ params }: { params: Promise<{ eventId: string; teamId: string }> }) {
  const { eventId, teamId } = await params;
  const { has } = await eventAccess(eventId);
  if (!has("teams.view")) return <Forbidden />;
  const team = db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.eventId, eventId))).get();
  if (!team) notFound();
  const members = db
    .select({ p: participants, name: users.name, email: users.email })
    .from(participants)
    .innerJoin(users, eq(users.id, participants.userId))
    .where(eq(participants.teamId, teamId))
    .all();
  const unassigned = db
    .select({ value: participants.id, label: users.name })
    .from(participants)
    .innerJoin(users, eq(users.id, participants.userId))
    .where(and(eq(participants.eventId, eventId), isNull(participants.teamId)))
    .all();
  const roomOpts = db.select({ value: rooms.id, label: rooms.name }).from(rooms).where(eq(rooms.eventId, eventId)).all();
  const psOpts = db.select({ value: problemStatements.id, label: problemStatements.code }).from(problemStatements).where(eq(problemStatements.eventId, eventId)).all();
  const mentorOpts = mentorsForEvent().map((m) => ({ value: m.userId, label: m.name }));
  const rounds = db.select().from(eventRounds).where(eq(eventRounds.eventId, eventId)).orderBy(asc(eventRounds.order)).all();
  const subs = db.select().from(submissions).where(eq(submissions.teamId, teamId)).all();
  const evals = has("evaluations.view")
    ? db.select({ e: evaluations, judge: users.name }).from(evaluations).innerJoin(users, eq(users.id, evaluations.judgeUserId)).where(eq(evaluations.teamId, teamId)).all()
    : [];
  const canManage = has("teams.manage");
  return (
    <div className="space-y-6">
      <Link href={`/app/events/${eventId}/teams`} className="text-sm text-muted hover:text-brand-deep">
        ← All teams
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-extrabold">{team.name}</h2>
        <Badge tone="brand">{team.code}</Badge>
        <StatusBadge status={team.status} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="Members" eyebrow={`${members.length} people`}>
            <ul className="divide-y divide-line/70">
              {members.map((m) => (
                <li key={m.p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} size={30} />
                    <div>
                      <div className="text-sm font-semibold text-ink">
                        {m.name} {m.p.isTeamLead && <Badge tone="brand">Lead</Badge>}
                      </div>
                      <div className="text-xs text-muted">{m.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.p.checkedInAt ? <Badge tone="ok">Checked in</Badge> : <Badge>Not checked in</Badge>}
                    {canManage && (
                      <ActionButton action={removeFromTeam} hidden={{ eventId, participantId: m.p.id }} variant="ghost" confirm={`Remove ${m.name} from ${team.name}?`}>
                        Remove
                      </ActionButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {canManage && unassigned.length > 0 && (
              <ActionForm action={bulkAssignTeam} hidden={{ eventId, teamId }} className="mt-4 flex items-end gap-2 border-t border-line pt-4">
                <Field label="Add an unassigned participant" className="flex-1">
                  <Select name="ids" options={unassigned} placeholder="Choose…" required />
                </Field>
                <SubmitButton size="md" variant="outline">
                  Add to team
                </SubmitButton>
              </ActionForm>
            )}
          </Card>
          <Card title="Submissions & scores">
            <ul className="space-y-4">
              {rounds.map((r) => {
                const s = subs.find((x) => x.roundId === r.id);
                const ev = evals.filter((x) => x.e.roundId === r.id);
                return (
                  <li key={r.id} className="rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">{r.name}</span>
                      <StatusBadge status={s?.status ?? "not_started"} />
                    </div>
                    {s?.title && <div className="mt-1 text-sm">{s.title}</div>}
                    {s?.submittedAt && <div className="text-xs text-muted">Submitted {fmtDateTime(s.submittedAt)}</div>}
                    {ev.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ev.map((x) => (
                          <Badge key={x.e.id} tone={x.e.status === "submitted" ? "ok" : "warn"}>
                            {x.judge}: {x.e.status === "submitted" ? x.e.totalScore?.toFixed(1) : "draft"}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
        {canManage && (
          <aside className="space-y-6">
            <Card title="Team settings">
              <ActionForm action={saveTeam} hidden={{ eventId, teamId }} className="space-y-3" successMessage="Saved.">
                <Field label="Name">
                  <Input name="name" defaultValue={team.name} required />
                </Field>
                <Field label="Status">
                  <Select name="status" defaultValue={team.status} options={["active", "disqualified", "withdrawn"]} />
                </Field>
                <Field label="Room">
                  <Select name="roomId" defaultValue={team.roomId ?? ""} options={roomOpts} placeholder="Unassigned" />
                </Field>
                <Field label="Problem statement">
                  <Select name="problemStatementId" defaultValue={team.problemStatementId ?? ""} options={psOpts} placeholder="Not chosen" />
                </Field>
                <Field label="Mentor">
                  <Select name="mentorUserId" defaultValue={team.mentorUserId ?? ""} options={mentorOpts} placeholder="No mentor" />
                </Field>
                <SubmitButton>Save</SubmitButton>
              </ActionForm>
            </Card>
            <ActionButton action={deleteTeam} hidden={{ eventId, teamId }} variant="danger" confirm={`Delete ${team.name}? Members stay registered.`}>
              Delete team
            </ActionButton>
          </aside>
        )}
      </div>
    </div>
  );
}
