import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { qrCodes, QR_PURPOSES, rooms } from "@/db/schema";
import { eventAccess, roundsFor } from "@/server/events";
import { createQr, deleteQr, toggleQr } from "@/server/actions/operations";
import { ActionButton, ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { QrSvg } from "@/components/qr";
import { Badge, Card, EmptyState, Forbidden } from "@/components/ui";
import { humanize } from "@/lib/format";
import { appUrl } from "@/lib/utils";

export const metadata = { title: "QR codes" };

const QR_HELP: Record<string, string> = {
  registration: "Opens the public event page with the register button.",
  checkin: "Participants scan at the gate to check themselves in.",
  attendance: "Marks session attendance for the scanning participant.",
  room_entry: "Logs entry to a specific room.",
  submission: "Takes a team member straight to their submission form.",
  judge_evaluation: "Opens the judge dashboard for this event.",
  feedback: "Opens the event feedback form.",
  event_info: "Public event information page.",
  documentation: "Published documentation for this event.",
  schedule: "Live schedule.",
  team_verification: "Shows the scanner's team and members.",
  mentor_access: "Opens the mentor dashboard.",
};

export default async function QrPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { has } = await eventAccess(eventId);
  if (!has("qr.manage")) return <Forbidden />;
  const list = db.select().from(qrCodes).where(eq(qrCodes.eventId, eventId)).orderBy(desc(qrCodes.createdAt)).all();
  const roomRows = db.select().from(rooms).where(eq(rooms.eventId, eventId)).all();
  const rounds = roundsFor(eventId);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {list.length === 0 && <EmptyState title="No QR codes yet">Every code is tied to this event and a purpose — never generic.</EmptyState>}
        {list.map((q) => (
          <Card key={q.id} className={q.active ? "" : "opacity-60"}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <Badge tone="brand">{humanize(q.purpose)}</Badge>
                <div className="mt-2 font-bold text-ink">{q.label}</div>
                {q.roomId && <div className="text-xs text-muted">{roomRows.find((r) => r.id === q.roomId)?.name}</div>}
              </div>
              <Badge tone={q.active ? "ok" : "neutral"}>{q.active ? "Active" : "Disabled"}</Badge>
            </div>
            <div className="my-4 flex justify-center rounded-lg bg-white p-3">
              <QrSvg value={appUrl(`/q/${q.token}`)} size={150} />
            </div>
            <p className="text-xs text-muted">{QR_HELP[q.purpose]}</p>
            <div className="mt-1 break-all font-mono text-[11px] text-muted">{appUrl(`/q/${q.token}`)}</div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="text-sm">
                <b className="tabular">{q.scans}</b> <span className="text-muted">scans</span>
              </span>
              <div className="flex gap-1">
                <ActionButton action={toggleQr} hidden={{ eventId, qrId: q.id }} variant="ghost">
                  {q.active ? "Disable" : "Enable"}
                </ActionButton>
                <ActionButton action={deleteQr} hidden={{ eventId, qrId: q.id }} variant="ghost" confirm="Delete this QR code? Printed copies will stop working.">
                  Delete
                </ActionButton>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card title="Generate QR code">
        <ActionForm action={createQr} hidden={{ eventId }} resetOnSuccess className="space-y-3">
          <Field label="Purpose">
            <Select name="purpose" options={QR_PURPOSES.map((p) => ({ value: p, label: humanize(p) }))} />
          </Field>
          <Field label="Label" hint="Where it will be printed, e.g. “Main gate”.">
            <Input name="label" required />
          </Field>
          <Field label="Room" hint="Required for room entry.">
            <Select name="roomId" options={roomRows.map((r) => ({ value: r.id, label: r.name }))} placeholder="—" />
          </Field>
          <Field label="Round (optional)">
            <Select name="roundId" options={rounds.map((r) => ({ value: r.id, label: r.name }))} placeholder="—" />
          </Field>
          <SubmitButton className="w-full">Generate</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
