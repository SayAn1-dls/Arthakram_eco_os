import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { participants, teams, users } from "@/db/schema";
import { eventAccess } from "@/server/events";
import { addParticipant, bulkAssignTeam, bulkParticipantStatus } from "@/server/actions/operations";
import { DataTable, type BulkAction } from "@/components/data-table";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { Card, Forbidden, Stat, StatRow } from "@/components/ui";
import { fmtTime } from "@/lib/format";

export const metadata = { title: "Participants" };

export default async function ParticipantsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { has } = await eventAccess(eventId);
  if (!has("participants.view")) return <Forbidden />;
  const rows = db
    .select({ p: participants, name: users.name, email: users.email, team: teams.name })
    .from(participants)
    .innerJoin(users, eq(users.id, participants.userId))
    .leftJoin(teams, eq(teams.id, participants.teamId))
    .where(eq(participants.eventId, eventId))
    .orderBy(asc(users.name))
    .all();
  const teamOpts = db.select({ value: teams.id, label: teams.name }).from(teams).where(eq(teams.eventId, eventId)).orderBy(asc(teams.name)).all();
  const bulk: BulkAction[] = [];
  if (has("participants.manage"))
    bulk.push({
      label: "Set status",
      action: bulkParticipantStatus,
      hidden: { eventId },
      select: { name: "status", placeholder: "Status…", options: ["registered", "confirmed", "waitlisted", "withdrawn"].map((s) => ({ value: s, label: s })) },
    });
  if (has("teams.manage")) bulk.push({ label: "Move to team", action: bulkAssignTeam, hidden: { eventId }, select: { name: "teamId", placeholder: "Team…", options: teamOpts } });
  const checked = rows.filter((r) => r.p.checkedInAt).length;
  return (
    <div className="space-y-6">
      <StatRow className="lg:grid-cols-4">
        <Stat value={rows.length} label="Registered" />
        <Stat value={rows.filter((r) => r.p.status === "confirmed").length} label="Confirmed" />
        <Stat value={rows.filter((r) => !r.p.teamId).length} label="Without a team" />
        <Stat value={`${checked}/${rows.length}`} label="Checked in" tone="brand" />
      </StatRow>
      <DataTable
        columns={[
          { key: "name", label: "Name" },
          { key: "email", label: "Email", kind: "muted" },
          { key: "college", label: "College" },
          { key: "team", label: "Team" },
          { key: "status", label: "Status", kind: "status" },
          { key: "checkin", label: "Check-in" },
        ]}
        rows={rows.map((r) => ({
          id: r.p.id,
          name: r.name + (r.p.isTeamLead ? " ★" : ""),
          email: r.email,
          college: r.p.college,
          team: r.team ?? "",
          status: r.p.status,
          checkin: r.p.checkedInAt ? `✓ ${fmtTime(r.p.checkedInAt)}` : "",
        }))}
        filters={[
          { key: "status", label: "Statuses", options: ["registered", "confirmed", "waitlisted", "withdrawn"] },
          { key: "team", label: "Teams", options: teamOpts.map((t) => t.label) },
        ]}
        bulkActions={bulk}
        exportHref={has("events.export") ? `/api/events/${eventId}/export?table=participants` : undefined}
        searchPlaceholder="Search name, email, college, team…"
      />
      {has("participants.manage") && (
        <Card title="Add participant" eyebrow="Manual registration">
          <ActionForm action={addParticipant} hidden={{ eventId }} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <Field label="Email of an Arthakram account">
              <Input type="email" name="email" required />
            </Field>
            <Field label="College">
              <Input name="college" />
            </Field>
            <Field label="Team (optional)">
              <Select name="teamId" options={teamOpts} placeholder="No team yet" />
            </Field>
            <SubmitButton>Add</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
