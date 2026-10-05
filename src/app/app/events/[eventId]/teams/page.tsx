import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { problemStatements, rooms, submissions, teams, users } from "@/db/schema";
import { eventAccess, roundsFor } from "@/server/events";
import { bulkAssignRoom, bulkTeamStatus, saveTeam } from "@/server/actions/operations";
import { DataTable, type BulkAction } from "@/components/data-table";
import { ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { Card, Forbidden } from "@/components/ui";

export const metadata = { title: "Teams" };

export default async function TeamsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, has } = await eventAccess(eventId);
  if (!has("teams.view")) return <Forbidden />;
  const rounds = roundsFor(eventId);
  const current = rounds.find((r) => r.id === event.currentRoundId) ?? rounds[0];
  const rows = db
    .select({
      t: teams,
      room: rooms.name,
      ps: problemStatements.code,
      mentor: users.name,
      members: sql<number>`(select count(*) from participants p where p.team_id = "teams"."id")`,
      present: sql<number>`(select count(*) from participants p where p.team_id = "teams"."id" and p.checked_in_at is not null)`,
    })
    .from(teams)
    .leftJoin(rooms, eq(rooms.id, teams.roomId))
    .leftJoin(problemStatements, eq(problemStatements.id, teams.problemStatementId))
    .leftJoin(users, eq(users.id, teams.mentorUserId))
    .where(eq(teams.eventId, eventId))
    .orderBy(asc(teams.code))
    .all();
  const subs = current ? db.select({ teamId: submissions.teamId, status: submissions.status }).from(submissions).where(eq(submissions.roundId, current.id)).all() : [];
  const subOf = new Map(subs.map((s) => [s.teamId, s.status]));
  const roomOpts = db.select({ value: rooms.id, label: rooms.name }).from(rooms).where(eq(rooms.eventId, eventId)).all();
  const bulk: BulkAction[] = [];
  if (has("rooms.manage")) bulk.push({ label: "Assign room", action: bulkAssignRoom, hidden: { eventId }, select: { name: "roomId", placeholder: "Room…", options: roomOpts } });
  if (has("teams.manage"))
    bulk.push({ label: "Set status", action: bulkTeamStatus, hidden: { eventId }, select: { name: "status", placeholder: "Status…", options: ["active", "disqualified", "withdrawn"].map((s) => ({ value: s, label: s })) } });
  return (
    <div className="space-y-6">
      <DataTable
        columns={[
          { key: "name", label: "Team" },
          { key: "code", label: "Code", kind: "muted" },
          { key: "members", label: "Members", kind: "number" },
          { key: "present", label: "Present", kind: "number" },
          { key: "room", label: "Room" },
          { key: "ps", label: "Problem" },
          { key: "mentor", label: "Mentor" },
          { key: "submission", label: current ? `Submission · ${current.name.split("·")[0]!.trim()}` : "Submission", kind: "status" },
          { key: "status", label: "Status", kind: "status" },
        ]}
        rows={rows.map((r) => ({
          id: r.t.id,
          href: `/app/events/${eventId}/teams/${r.t.id}`,
          name: r.t.name,
          code: r.t.code,
          members: r.members,
          present: r.present,
          room: r.room,
          ps: r.ps,
          mentor: r.mentor,
          submission: subOf.get(r.t.id) ?? "not_started",
          status: r.t.status,
        }))}
        filters={[
          { key: "room", label: "Rooms", options: roomOpts.map((r) => r.label) },
          { key: "submission", label: "Submissions", options: ["not_started", "draft", "submitted", "under_review", "reviewed", "final"] },
          { key: "status", label: "Statuses", options: ["active", "disqualified", "withdrawn"] },
        ]}
        bulkActions={bulk}
        exportHref={has("events.export") ? `/api/events/${eventId}/export?table=teams` : undefined}
        searchPlaceholder="Search teams, rooms, mentors…"
      />
      {has("teams.manage") && (
        <Card title="Create team">
          <ActionForm action={saveTeam} hidden={{ eventId, codePrefix: event.slug.slice(0, 2).toUpperCase() }} resetOnSuccess className="flex flex-wrap items-end gap-3">
            <Field label="Team name" className="min-w-64 flex-1">
              <Input name="name" required />
            </Field>
            <SubmitButton>Create team</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
