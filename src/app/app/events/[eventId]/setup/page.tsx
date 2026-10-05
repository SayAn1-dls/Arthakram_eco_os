import { eventAccess } from "@/server/events";
import { deleteEvent, setEventStatus, toggleRegistration, updateEvent } from "@/server/actions/events";
import { EventForm } from "@/components/event-form";
import { ActionButton, ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { Card, Forbidden, StatusBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Event setup" };

const NEXT: Record<string, { to: string; label: string; variant?: "primary" | "outline" }[]> = {
  draft: [{ to: "published", label: "Publish event" }],
  published: [
    { to: "live", label: "Go live" },
    { to: "draft", label: "Back to draft", variant: "outline" },
  ],
  live: [{ to: "completed", label: "Mark completed" }],
  completed: [
    { to: "archived", label: "Archive event" },
    { to: "live", label: "Reopen as live", variant: "outline" },
  ],
  archived: [{ to: "completed", label: "Unarchive", variant: "outline" }],
};

export default async function SetupPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ created?: string }> }) {
  const { eventId } = await params;
  const { created } = await searchParams;
  const { event, has } = await eventAccess(eventId);
  if (!has("events.edit")) return <Forbidden />;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {created && (
          <div className="rounded-xl border border-brand/30 bg-brand-wash px-4 py-3 text-sm text-brand-deep">
            <b>Event workspace created.</b> It’s a draft — configure rounds, rubric and judges, then publish when ready.
          </div>
        )}
        <Card title="Event configuration">
          <EventForm action={updateEvent} event={event} hidden={{ eventId }} submitLabel="Save changes" />
        </Card>
      </div>
      <aside className="space-y-6">
        <Card title="Lifecycle" eyebrow="Status">
          <div className="mb-4 flex items-center gap-2">
            <StatusBadge status={event.status} />
            <span className="text-sm text-muted">since {fmtDateTime(event.updatedAt ?? event.createdAt)}</span>
          </div>
          {has("events.publish") ? (
            <div className="flex flex-wrap gap-2">
              {(NEXT[event.status] ?? []).map((n) => (
                <ActionButton key={n.to} action={setEventStatus} hidden={{ eventId, status: n.to }} variant={n.variant ?? "primary"} size="md" confirm={`Move event to ${n.to}?`}>
                  {n.label}
                </ActionButton>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">You can edit this event but not change its status.</p>
          )}
        </Card>
        <Card title="Registration">
          <p className="mb-3 text-sm text-muted">
            Registration is <b className="text-ink">{event.registrationOpen ? "open" : "closed"}</b>
            {event.registrationDeadline && <> · deadline {fmtDateTime(event.registrationDeadline)}</>}.
          </p>
          <ActionButton action={toggleRegistration} hidden={{ eventId }} variant={event.registrationOpen ? "outline" : "primary"} size="md">
            {event.registrationOpen ? "Close registration" : "Open registration"}
          </ActionButton>
        </Card>
        {has("events.delete") && (
          <Card title="Danger zone">
            <ActionForm action={deleteEvent} hidden={{ eventId }} className="space-y-3">
              <p className="text-sm text-muted">Deleting removes every team, submission, evaluation and document. Archive instead if you want to keep the record.</p>
              <Field label={`Type “${event.title}” to confirm`}>
                <Input name="confirmTitle" autoComplete="off" />
              </Field>
              <SubmitButton variant="danger">Delete event permanently</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </aside>
    </div>
  );
}
