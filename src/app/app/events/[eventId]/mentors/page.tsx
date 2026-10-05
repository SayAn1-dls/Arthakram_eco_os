import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { eventAccess } from "@/server/events";
import { mentorsForEvent } from "@/server/mentors";
import { assignMentor } from "@/server/actions/operations";
import { ActionForm, Select, SubmitButton } from "@/components/forms";
import { Avatar, Card, Forbidden, Table, Td, Th } from "@/components/ui";

export const metadata = { title: "Event mentors" };

export default async function EventMentorsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { has } = await eventAccess(eventId);
  if (!has("mentors.create")) return <Forbidden />;
  const mentors = mentorsForEvent();
  const teamRows = db.select().from(teams).where(eq(teams.eventId, eventId)).orderBy(asc(teams.code)).all();
  const load = new Map<string, number>();
  for (const t of teamRows) if (t.mentorUserId) load.set(t.mentorUserId, (load.get(t.mentorUserId) ?? 0) + 1);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Table>
        <thead>
          <tr>
            <Th>Team</Th>
            <Th>Mentor</Th>
          </tr>
        </thead>
        <tbody>
          {teamRows.map((t) => (
            <tr key={t.id}>
              <Td>
                <span className="font-semibold text-ink">{t.name}</span> <span className="text-xs text-muted">{t.code}</span>
              </Td>
              <Td>
                <ActionForm action={assignMentor} hidden={{ eventId, teamId: t.id }} className="flex items-center gap-2">
                  <Select name="mentorUserId" defaultValue={t.mentorUserId ?? ""} options={mentors.map((m) => ({ value: m.userId, label: m.name }))} placeholder="No mentor" className="!h-8 max-w-60" />
                  <SubmitButton size="sm" variant="outline">
                    Save
                  </SubmitButton>
                </ActionForm>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Card title="Mentor network" eyebrow="Approved mentors">
        <ul className="space-y-3">
          {mentors.map((m) => (
            <li key={m.userId} className="flex items-center gap-3">
              <Avatar name={m.name} size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{m.name}</div>
                <div className="truncate text-xs text-muted">{m.headline}</div>
              </div>
              <span className="text-xs tabular text-muted">{load.get(m.userId) ?? 0} teams</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
