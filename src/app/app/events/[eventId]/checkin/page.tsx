import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { participants, teams, users } from "@/db/schema";
import { eventAccess } from "@/server/events";
import { checkInByCode, manualCheckIn, undoCheckIn } from "@/server/actions/operations";
import { ActionButton, ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { AutoRefresh } from "@/components/live";
import { Card, Forbidden, Progress, Stat, StatRow, Table, Td, Th } from "@/components/ui";
import { fmtTime, pct } from "@/lib/format";

export const metadata = { title: "Check-in" };

export default async function CheckinPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ q?: string }> }) {
  const { eventId } = await params;
  const { q } = await searchParams;
  const { has } = await eventAccess(eventId);
  if (!has("attendance.manage")) return <Forbidden />;
  const all = db
    .select({ id: participants.id, name: users.name, email: users.email, team: teams.name, at: participants.checkedInAt, status: participants.status })
    .from(participants)
    .innerJoin(users, eq(users.id, participants.userId))
    .leftJoin(teams, eq(teams.id, participants.teamId))
    .where(eq(participants.eventId, eventId))
    .orderBy(asc(users.name))
    .all()
    .filter((p) => p.status !== "withdrawn");
  const done = all.filter((p) => p.at).length;
  const needle = (q ?? "").toLowerCase();
  const list = needle ? all.filter((p) => [p.name, p.email, p.team].some((v) => v?.toLowerCase().includes(needle))) : all.filter((p) => !p.at);
  const recent = db
    .select({ name: users.name, at: participants.checkedInAt })
    .from(participants)
    .innerJoin(users, eq(users.id, participants.userId))
    .where(and(eq(participants.eventId, eventId), isNotNull(participants.checkedInAt)))
    .all()
    .sort((a, b) => b.at!.getTime() - a.at!.getTime())
    .slice(0, 8);
  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={10000} />
      <StatRow className="lg:grid-cols-3">
        <Stat value={`${done}/${all.length}`} label="Checked in" tone="brand" />
        <Stat value={all.length - done} label="Still expected" />
        <div>
          <div className="text-[2rem] font-extrabold leading-none">{pct(done, all.length)}%</div>
          <Progress value={done} max={all.length} className="mt-3" />
        </div>
      </StatRow>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card title="Scan or enter a pass" eyebrow="Participant QR">
            <p className="mb-3 text-sm text-muted">
              Each participant has a personal QR pass on their team page. Scan it with your phone camera (opens a confirm screen) or with a USB scanner into this box.
            </p>
            <ActionForm action={checkInByCode} hidden={{ eventId }} resetOnSuccess className="flex gap-2">
              <Input name="code" placeholder="Scan pass or paste code…" autoFocus autoComplete="off" />
              <SubmitButton>Check in</SubmitButton>
            </ActionForm>
          </Card>
          <form className="flex gap-2">
            <Input name="q" defaultValue={q} placeholder="Search everyone by name, email or team (shows checked-in too)…" />
          </form>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Team</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr>
                  <Td colSpan={4} className="py-8 text-center text-muted">
                    {needle ? "No matches." : "Everyone is checked in 🎉"}
                  </Td>
                </tr>
              )}
              {list.slice(0, 60).map((p) => (
                <tr key={p.id}>
                  <Td>
                    <div className="font-semibold text-ink">{p.name}</div>
                    <div className="text-xs text-muted">{p.email}</div>
                  </Td>
                  <Td>{p.team ?? "—"}</Td>
                  <Td>{p.at ? <span className="text-ok">✓ {fmtTime(p.at)}</span> : <span className="text-muted">Expected</span>}</Td>
                  <Td className="text-right">
                    {p.at ? (
                      <ActionButton action={undoCheckIn} hidden={{ eventId, participantId: p.id }} variant="ghost" confirm={`Undo check-in for ${p.name}?`}>
                        Undo
                      </ActionButton>
                    ) : (
                      <ActionButton action={manualCheckIn} hidden={{ eventId, participantId: p.id }} variant="primary">
                        Check in
                      </ActionButton>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <Card title="Latest arrivals">
          <ul className="space-y-2 text-sm">
            {recent.map((r, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-ink">{r.name}</span>
                <span className="text-muted tabular">{fmtTime(r.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
