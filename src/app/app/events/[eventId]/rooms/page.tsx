import { eventAccess, roomOccupancy } from "@/server/events";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deleteRoom, saveRoom } from "@/server/actions/operations";
import { ActionButton, ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { Card, EmptyState, Forbidden, Progress } from "@/components/ui";

export const metadata = { title: "Rooms" };

export default async function RoomsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { has } = await eventAccess(eventId);
  if (!has("rooms.manage")) return <Forbidden />;
  const occ = new Map(roomOccupancy(eventId).map((r) => [r.id, r]));
  const list = db.select().from(rooms).where(eq(rooms.eventId, eventId)).all();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-4 sm:grid-cols-2">
        {list.length === 0 && <EmptyState title="No rooms yet">Add rooms to allocate teams and generate room-entry QR codes.</EmptyState>}
        {list.map((r) => {
          const o = occ.get(r.id);
          return (
            <Card key={r.id} title={r.name} eyebrow={r.location ?? "Room"}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{o?.teams ?? 0} teams</span>
                <span className="tabular text-muted">
                  {o?.people ?? 0}/{r.capacity || "∞"} people
                </span>
              </div>
              <Progress value={o?.people ?? 0} max={r.capacity || 1} />
              {r.notes && <p className="mt-3 text-sm text-muted">{r.notes}</p>}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-brand-deep">Edit</summary>
                <ActionForm action={saveRoom} hidden={{ eventId, roomId: r.id }} className="mt-3 space-y-2">
                  <Input name="name" defaultValue={r.name} required />
                  <Input name="location" defaultValue={r.location ?? ""} placeholder="Location" />
                  <Input type="number" name="capacity" defaultValue={r.capacity} min={0} />
                  <Input name="notes" defaultValue={r.notes ?? ""} placeholder="Notes" />
                  <div className="flex justify-between">
                    <SubmitButton size="sm">Save</SubmitButton>
                  </div>
                </ActionForm>
                <div className="mt-2">
                  <ActionButton action={deleteRoom} hidden={{ eventId, roomId: r.id }} variant="ghost" confirm={`Delete ${r.name}? Teams in it become unassigned.`}>
                    Delete room
                  </ActionButton>
                </div>
              </details>
            </Card>
          );
        })}
      </div>
      <Card title="Add room">
        <ActionForm action={saveRoom} hidden={{ eventId }} resetOnSuccess className="space-y-3">
          <Field label="Name">
            <Input name="name" required />
          </Field>
          <Field label="Location">
            <Input name="location" />
          </Field>
          <Field label="Capacity">
            <Input type="number" name="capacity" min={0} defaultValue={20} />
          </Field>
          <Field label="Notes">
            <Input name="notes" />
          </Field>
          <SubmitButton>Add room</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
